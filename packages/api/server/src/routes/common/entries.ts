import { Competition, Order, ReferralPurchase, Ticket } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex } from "@oc/api-infra/fuzzy-search";
import {
  defaultAggregateOptions,
  defaultCountMaxTimeMS,
} from "@oc/api-infra/mongo-query-options";
import {
  buildCursorFilter,
  decodeCursor,
  getNextCursor,
  parseCursorPagination,
  parsePagination,
} from "@oc/api-infra/pagination";
import { cursorPaginated, error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { publicFeedRateLimit } from "@oc/api-server/middleware/rate-limit";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", publicFeedRateLimit());

function formatPublicDisplayName(
  firstName: string,
  lastName?: string | null,
  showLastName?: boolean | null
): string {
  if (showLastName && lastName) return `${firstName} ${lastName}`;
  if (lastName) return `${firstName} ${lastName[0]}.`;
  return firstName;
}

const PUBLIC_ENTRY_SORT_FIELDS = ["entryNumber", "createdAt"] as const;

function parsePublicEntryCursor(
  cursor: string | undefined
): { entryNumber: number; _id: string } | null {
  if (!cursor) return null;
  const data = decodeCursor<Record<string, unknown>>(cursor);
  if (!data) return null;
  const entryNumber = data.entryNumber;
  const id = data._id;
  if (typeof entryNumber !== "number" || !Number.isFinite(entryNumber)) return null;
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) return null;
  return { entryNumber, _id: id };
}

function mapPublicEntry(entry: Record<string, unknown>) {
  const firstName = entry.firstName as string;
  const lastName = entry.lastName as string | null | undefined;
  const showLastName = entry.showLastName as boolean | null | undefined;

  return {
    id: (entry._id as mongoose.Types.ObjectId).toString(),
    ticketNumber: entry.entryNumber as number,
    orderNumber: entry.orderNumber as number | null,
    firstName,
    displayName: formatPublicDisplayName(firstName, lastName, showLastName),
    createdAt: entry.createdAt as string,
  };
}

function parseEntrySearchDigits(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function buildEntrySearchStages(
  searchPattern: string,
  searchRaw: string
): mongoose.PipelineStage[] {
  const ticketOrOrder = parseEntrySearchDigits(searchRaw);
  const orClauses: Record<string, unknown>[] = [
    { firstName: { $regex: searchPattern, $options: "i" } },
    { lastName: { $regex: searchPattern, $options: "i" } },
    { city: { $regex: searchPattern, $options: "i" } },
    { displayName: { $regex: searchPattern, $options: "i" } },
  ];
  if (ticketOrOrder != null) {
    orClauses.push({ entryNumber: ticketOrOrder }, { orderNumber: ticketOrOrder });
  }
  return [
    {
      $addFields: {
        displayName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$firstName", ""] },
                " ",
                { $ifNull: ["$lastName", ""] },
              ],
            },
          },
        },
      },
    },
    { $match: { $or: orClauses } },
  ];
}

async function resolveMissingOrderNumbers(entries: Record<string, unknown>[]): Promise<void> {
  const nullOrder = entries.filter((e) => e.orderNumber == null && e.ownerId) as Record<
    string,
    unknown
  >[];
  if (nullOrder.length === 0) return;

  const ownerObjIds = [
    ...new Set(nullOrder.map((e) => (e.ownerId as mongoose.Types.ObjectId).toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const rps = await ReferralPurchase.find({
    $or: [{ referrerId: { $in: ownerObjIds } }, { referredUserId: { $in: ownerObjIds } }],
    deletedAt: null,
  })
    .sort({ purchasedAt: -1 })
    .maxTimeMS(5000)
    .lean();

  if (rps.length === 0) return;

  const orderIds = [...new Set(rps.map((rp) => rp.orderId.toString()))];
  const orders = await Order.find({
    _id: { $in: orderIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("orderNumber")
    .maxTimeMS(5000)
    .lean();

  const orderNumByOrderId = new Map<string, number>(
    orders.map((o) => [o._id.toString(), o.orderNumber])
  );

  const orderNumByOwnerId = new Map<string, number | null>();
  for (const rp of rps) {
    for (const field of ["referrerId", "referredUserId"] as const) {
      const key = rp[field]?.toString();
      if (key && !orderNumByOwnerId.has(key)) {
        orderNumByOwnerId.set(key, orderNumByOrderId.get(rp.orderId.toString()) ?? null);
      }
    }
  }

  for (const entry of nullOrder) {
    const ownerKey = (entry.ownerId as mongoose.Types.ObjectId).toString();
    const val = orderNumByOwnerId.get(ownerKey);
    if (val != null) {
      entry.orderNumber = val;
    }
  }
}

app.get(
  "/",
  redisCacheRoute({
    route: "entries:list",
    scope: "public",
    ttlSeconds: 30,
  }),
  async (c) => {
    try {
      const competitionId = c.req.query("competitionId");
      if (!competitionId) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "competitionId is required", 400);
      }

      const searchRaw = c.req.query("search")?.trim() || undefined;
      const search =
        searchRaw && searchRaw.length <= 64 ? escapeRegex(searchRaw.slice(0, 64)) : undefined;
      await dbConnect();

      const competition = await Competition.findById(competitionId).lean();
      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      const objectId = new mongoose.Types.ObjectId(competitionId);
      const baseStages = [
        { $match: { competitionId: objectId, status: "sold" } },
        {
          $lookup: {
            from: "profiles",
            localField: "ownerId",
            foreignField: "_id",
            as: "profile",
            pipeline: [
              {
                $match: {
                  $expr: { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
                },
              },
              { $project: { firstName: 1, lastName: 1, showLastName: 1, city: 1 } },
            ],
          },
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            entryNumber: "$number",
            orderNumber: 1,
            ownerId: 1,
            firstName: {
              $ifNull: ["$entryFirstName", { $ifNull: ["$profile.firstName", "Anonymous"] }],
            },
            lastName: { $ifNull: ["$entryLastName", "$profile.lastName"] },
            showLastName: {
              $ifNull: ["$entryShowLastName", { $ifNull: ["$profile.showLastName", true] }],
            },
            city: "$profile.city",
            createdAt: { $ifNull: ["$soldAt", "$$NOW"] },
          },
        },
      ];

      const searchStages =
        search && searchRaw ? buildEntrySearchStages(search, searchRaw) : [];

      if (c.req.query("cursor") !== undefined) {
        const { limit, cursor, sortField, sortDir } = parseCursorPagination(c, {
          defaultSortField: "entryNumber",
          defaultSortDir: 1,
          allowedSortFields: PUBLIC_ENTRY_SORT_FIELDS,
        });
        const cursorData = parsePublicEntryCursor(cursor);
        const cursorFilter = buildCursorFilter(
          sortField,
          sortDir as 1 | -1,
          cursorData as Record<string, unknown> | null
        );

        if (search) {
          const pipeline = [
            ...baseStages,
            ...searchStages,
            ...(cursorFilter ? [{ $match: cursorFilter }] : []),
            { $sort: { [sortField]: sortDir as 1 | -1, _id: sortDir as 1 | -1 } },
            {
              $facet: {
                data: [{ $limit: limit + 1 }],
                total: [{ $count: "total" }],
              },
            },
          ] as mongoose.PipelineStage[];

          const [facetResult] = await Ticket.aggregate(pipeline).option(defaultAggregateOptions());
          const entriesResult = (facetResult?.data ?? []) as Record<string, unknown>[];
          const total = (facetResult?.total?.[0]?.total as number) ?? 0;
          await resolveMissingOrderNumbers(entriesResult);

          const hasMore = entriesResult.length > limit;
          const pageItems = hasMore ? entriesResult.slice(0, limit) : entriesResult;

          const publicEntries = pageItems.map((entry: Record<string, unknown>) => ({
            ...mapPublicEntry(entry),
            _id: entry._id,
            entryNumber: entry.entryNumber,
          }));

          const nextCursor = getNextCursor(
            publicEntries as Record<string, unknown>[],
            sortField,
            hasMore
          );

          return cursorPaginated(
            c,
            publicEntries.map(({ _id, entryNumber, ...rest }) => rest),
            { limit, hasMore, nextCursor, total }
          );
        }

        const pipeline = [
          ...baseStages,
          ...(cursorFilter ? [{ $match: cursorFilter }] : []),
          { $sort: { [sortField]: sortDir as 1 | -1, _id: sortDir as 1 | -1 } },
          { $limit: limit + 1 },
        ] as mongoose.PipelineStage[];

        const totalPromise = Ticket.countDocuments({
          competitionId: objectId,
          status: "sold",
        }).maxTimeMS(defaultCountMaxTimeMS());

        const [entriesResult, total] = await Promise.all([
          Ticket.aggregate(pipeline).option(defaultAggregateOptions()),
          totalPromise,
        ]);
        await resolveMissingOrderNumbers(entriesResult);
        const hasMore = entriesResult.length > limit;
        const pageItems = hasMore ? entriesResult.slice(0, limit) : entriesResult;

        const publicEntries = pageItems.map((entry: Record<string, unknown>) => ({
          ...mapPublicEntry(entry),
          _id: entry._id,
          entryNumber: entry.entryNumber,
        }));

        const nextCursor = getNextCursor(
          publicEntries as Record<string, unknown>[],
          sortField,
          hasMore
        );

        return cursorPaginated(
          c,
          publicEntries.map(({ _id, entryNumber, ...rest }) => rest),
          { limit, hasMore, nextCursor, total }
        );
      }

      const { limit, page, skip } = parsePagination(c);

      if (search) {
        const [facetResult] = await Ticket.aggregate([
          ...baseStages,
          ...searchStages,
          { $sort: { entryNumber: 1 } },
          {
            $facet: {
              data: [{ $skip: skip }, { $limit: limit }],
              total: [{ $count: "total" }],
            },
          },
        ] as mongoose.PipelineStage[]).option(defaultAggregateOptions());

        const entriesResult = (facetResult?.data ?? []) as Record<string, unknown>[];
        const total = (facetResult?.total?.[0]?.total as number) ?? 0;
        await resolveMissingOrderNumbers(entriesResult);
        const publicEntries = entriesResult.map((entry: Record<string, unknown>) =>
          mapPublicEntry(entry)
        );

        return paginated(c, publicEntries, total, page, limit);
      }

      const totalPromise = Ticket.countDocuments({
        competitionId: objectId,
        status: "sold",
      }).maxTimeMS(defaultCountMaxTimeMS());

      const [entriesResult, total] = await Promise.all([
        Ticket.aggregate([
          ...baseStages,
          { $sort: { entryNumber: 1 } },
          { $skip: skip },
          { $limit: limit },
        ] as mongoose.PipelineStage[]).option(defaultAggregateOptions()),
        totalPromise,
      ]);
      await resolveMissingOrderNumbers(entriesResult);

      const publicEntries = entriesResult.map((entry: Record<string, unknown>) =>
        mapPublicEntry(entry)
      );

      return paginated(c, publicEntries, total, page, limit);
    } catch (err: unknown) {
      console.error("Error fetching public entries:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "entries.list",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/competitions",
  redisCacheRoute({
    route: "entries:competitions",
    scope: "public",
    ttlSeconds: 30,
  }),
  async (c) => {
    try {
      await dbConnect();

      const competitions = await Competition.find({ status: "active" })
        .select(
          "title prizeImageUrl imageUrl heroImageUrl prizeImages status drawDate maxTickets ticketsSold"
        )
        .maxTimeMS(10000)
        .lean();

      if (competitions.length === 0) {
        return success(c, [], {
          summary: {
            totalEntries: 0,
            competitionCount: 0,
            activeCount: 0,
            drawnCount: 0,
          },
        });
      }

      const result = competitions.map((comp) => {
        const imageUrl =
          comp.prizeImageUrl && comp.prizeImageUrl.length > 0
            ? comp.prizeImageUrl
            : (comp.imageUrl ?? null);
        return {
          id: comp._id.toString(),
          title: comp.title,
          prizeImageUrl: comp.prizeImageUrl,
          imageUrl,
          status: comp.status,
          drawDate: comp.drawDate,
          maxTickets: comp.maxTickets,
          ticketsSold: comp.ticketsSold ?? 0,
          ticketCount: comp.ticketsSold ?? 0,
        };
      });

      const totalEntries = result.reduce((sum, comp) => sum + comp.ticketsSold, 0);
      const activeCount = result.filter((comp) => comp.status === "active").length;
      const drawnCount = await Competition.countDocuments({ status: "drawn" }).maxTimeMS(10000);

      return success(c, result, {
        summary: {
          totalEntries,
          competitionCount: result.length,
          activeCount,
          drawnCount,
        },
      });
    } catch (err: unknown) {
      console.error("Error fetching competitions with entries:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "entries.competitions",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
