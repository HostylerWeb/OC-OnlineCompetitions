import { Competition, Ticket, Winner } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import {
  buildCursorFilter,
  decodeCursor,
  getNextCursor,
  isPaginationRequested,
  parseCursorPagination,
  parsePagination,
} from "@oc/api-infra/pagination";
import { cursorPaginated, error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { auth } from "@oc/api-server/middleware/auth";
import { type TicketLike, ticketsToEntryDtos } from "@oc/api-tickets/ticket-mapper";
import type { MyEntriesStats } from "@oc/types";
import { Hono } from "hono";
import mongoose from "mongoose";

const STATS_QUERY_MAX_TIME_MS = 15_000;
const ENTRIES_LIST_MAX_TIME_MS = 15_000;
const STATS_CACHE_TTL_MS = 5_000;
const DRAW_WINNER_ENTRY_LIMIT = 2_000;

const myEntriesStatsCache = new Map<string, { data: MyEntriesStats; expiresAt: number }>();
const entriesTotalCache = new Map<string, { total: number; expiresAt: number }>();

const ENTRIES_CACHE_MAX_SIZE = 1000;

function evictStaleCacheEntries() {
  const now = Date.now();
  for (const [key, entry] of myEntriesStatsCache) {
    if (entry.expiresAt < now) myEntriesStatsCache.delete(key);
  }
  for (const [key, entry] of entriesTotalCache) {
    if (entry.expiresAt < now) entriesTotalCache.delete(key);
  }
  if (myEntriesStatsCache.size > ENTRIES_CACHE_MAX_SIZE) {
    const entries = [...myEntriesStatsCache.entries()];
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toDelete = entries.slice(0, entries.length - ENTRIES_CACHE_MAX_SIZE);
    for (const [key] of toDelete) myEntriesStatsCache.delete(key);
  }
  if (entriesTotalCache.size > ENTRIES_CACHE_MAX_SIZE) {
    const entries = [...entriesTotalCache.entries()];
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toDelete = entries.slice(0, entries.length - ENTRIES_CACHE_MAX_SIZE);
    for (const [key] of toDelete) entriesTotalCache.delete(key);
  }
}

setInterval(evictStaleCacheEntries, 60_000);

/** Clears in-memory caches (for tests). */
export function clearMyEntriesCaches(): void {
  myEntriesStatsCache.clear();
  entriesTotalCache.clear();
}

const app = new Hono();

app.use("*", auth);

const ticketPopulate = {
  path: "competitionId" as const,
  select: "title slug prizeImageUrl imageUrl status drawDate maxTickets",
};

export function buildSoldEntriesFilter(userId: string, competitionId?: string) {
  return {
    ownerId: new mongoose.Types.ObjectId(userId),
    ...(competitionId ? { competitionId: new mongoose.Types.ObjectId(competitionId) } : {}),
    status: "sold" as const,
  };
}

export async function getMyEntriesStats(userId: string): Promise<MyEntriesStats> {
  const now = Date.now();
  const cached = myEntriesStatsCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const userOid = new mongoose.Types.ObjectId(userId);
  const userFilter = buildSoldEntriesFilter(userId);

  const [totalTickets, prizeWins, drawWinners, distinctCompetitionIds] = await Promise.all([
    Ticket.countDocuments(userFilter).maxTimeMS(STATS_QUERY_MAX_TIME_MS),
    Ticket.countDocuments({
      ...userFilter,
      instantPrizeWinId: { $exists: true, $ne: null },
    }).maxTimeMS(STATS_QUERY_MAX_TIME_MS),
    Winner.find({ userId: userOid })
      .select("entryId")
      .limit(DRAW_WINNER_ENTRY_LIMIT)
      .maxTimeMS(STATS_QUERY_MAX_TIME_MS)
      .lean(),
    Ticket.distinct("competitionId", userFilter, { maxTimeMS: STATS_QUERY_MAX_TIME_MS }),
  ]);

  const competitionCount = distinctCompetitionIds.length;

  const activeCompetitionIds =
    distinctCompetitionIds.length > 0
      ? (
          await Competition.find({
            _id: { $in: distinctCompetitionIds },
            status: "active",
          })
            .select("_id")
            .maxTimeMS(STATS_QUERY_MAX_TIME_MS)
            .lean()
        ).map((competition) => competition._id)
      : [];

  const activeTickets =
    activeCompetitionIds.length > 0
      ? await Ticket.countDocuments({
          ...userFilter,
          competitionId: { $in: activeCompetitionIds },
        }).maxTimeMS(STATS_QUERY_MAX_TIME_MS)
      : 0;

  const drawWinnerEntryIds = drawWinners
    .map((winner) => winner.entryId?.toString())
    .filter((id): id is string => Boolean(id));

  const data: MyEntriesStats = {
    totalTickets,
    activeTickets,
    competitionCount,
    prizeWins,
    drawWinnerEntryIds,
    byCompetition: [],
  };

  if (distinctCompetitionIds.length > 0) {
    const competitionStats = await Ticket.aggregate(
      [
        { $match: { ownerId: userOid, status: "sold" } },
        {
          $group: {
            _id: "$competitionId",
            totalTickets: { $sum: 1 },
            prizeWins: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$instantPrizeWinId", null] },
                      { $ifNull: ["$instantPrizeWinId", false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ],
      { maxTimeMS: STATS_QUERY_MAX_TIME_MS }
    );

    data.byCompetition = competitionStats.map((stat) => ({
      competitionId: stat._id.toString(),
      totalTickets: stat.totalTickets,
      prizeWins: stat.prizeWins,
    }));
  }

  myEntriesStatsCache.set(userId, { data, expiresAt: now + STATS_CACHE_TTL_MS });
  entriesTotalCache.set(userId, { total: totalTickets, expiresAt: now + STATS_CACHE_TTL_MS });

  return data;
}

async function resolveEntriesListTotal(
  userId: string,
  userFilter: ReturnType<typeof buildSoldEntriesFilter>,
  page: number
): Promise<number> {
  const now = Date.now();
  const cached = entriesTotalCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.total;
  }
  if (page > 1 && cached) {
    return cached.total;
  }

  const total = await Ticket.countDocuments(userFilter).maxTimeMS(ENTRIES_LIST_MAX_TIME_MS);
  entriesTotalCache.set(userId, { total, expiresAt: now + STATS_CACHE_TTL_MS });
  return total;
}

app.get("/stats", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();
    return success(c, await getMyEntriesStats(userId));
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.entries.stats",
    });
    console.error("Error fetching entry stats:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();

    const userFilter = buildSoldEntriesFilter(userId);

    if (c.req.query("cursor") !== undefined) {
      const { limit, cursor, sortField, sortDir } = parseCursorPagination(c, {
        defaultSortField: "soldAt",
        defaultSortDir: -1,
      });
      const cursorData = cursor ? decodeCursor<Record<string, unknown>>(cursor) : null;
      const cursorFilter = buildCursorFilter(sortField, sortDir as 1 | -1, cursorData);

      const filter: Record<string, unknown> = { ...userFilter };
      if (cursorFilter) {
        filter.$and = [cursorFilter];
      }

      const tickets = await Ticket.find(filter)
        .populate(ticketPopulate.path, ticketPopulate.select)
        .sort({ [sortField]: sortDir as 1 | -1, _id: sortDir as 1 | -1 })
        .limit(limit + 1)
        .lean();

      const hasMore = tickets.length > limit;
      const pageItems = hasMore ? tickets.slice(0, limit) : tickets;
      const entries = ticketsToEntryDtos(pageItems as TicketLike[]);
      const nextCursor = getNextCursor(
        pageItems as unknown as Record<string, unknown>[],
        sortField,
        hasMore
      );

      return cursorPaginated(c, entries, { limit, hasMore, nextCursor });
    }

    const { limit, page, skip } = parsePagination(c);

    const ticketsPromise = Ticket.find(userFilter)
      .populate(ticketPopulate.path, ticketPopulate.select)
      .sort({ soldAt: -1 })
      .skip(skip)
      .limit(limit)
      .maxTimeMS(ENTRIES_LIST_MAX_TIME_MS)
      .lean();

    const [tickets, total] = await Promise.all([
      ticketsPromise,
      resolveEntriesListTotal(userId, userFilter, page),
    ]);

    return paginated(c, ticketsToEntryDtos(tickets as unknown as TicketLike[]), total, page, limit);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.entries.list",
    });
    console.error("Error fetching entries:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/competition/:competitionId", async (c) => {
  try {
    const competitionId = c.req.param("competitionId");
    const userId = c.get("userId")!;
    await dbConnect();

    const baseFilter = buildSoldEntriesFilter(userId, competitionId);

    if (!isPaginationRequested(c)) {
      const tickets = await Ticket.find(baseFilter).sort({ number: 1 }).lean();
      const entries = ticketsToEntryDtos(tickets as unknown as TicketLike[]);
      const totalTickets = entries.length;
      const ticketNumbers = entries.map((e) => e.ticketNumber);

      return success(c, { entries, totalTickets, ticketNumbers });
    }

    if (c.req.query("cursor") !== undefined) {
      const { limit, cursor, sortField, sortDir } = parseCursorPagination(c, {
        defaultSortField: "number",
        defaultSortDir: 1,
      });
      const cursorData = cursor ? decodeCursor<Record<string, unknown>>(cursor) : null;
      const cursorFilter = buildCursorFilter(sortField, sortDir as 1 | -1, cursorData);

      const filter: Record<string, unknown> = { ...baseFilter };
      if (cursorFilter) {
        filter.$and = [cursorFilter];
      }

      const tickets = await Ticket.find(filter)
        .sort({ [sortField]: sortDir as 1 | -1, _id: sortDir as 1 | -1 })
        .limit(limit + 1)
        .lean();

      const hasMore = tickets.length > limit;
      const pageItems = hasMore ? tickets.slice(0, limit) : tickets;
      const entries = ticketsToEntryDtos(pageItems as TicketLike[]);
      const nextCursor = getNextCursor(
        pageItems as unknown as Record<string, unknown>[],
        sortField,
        hasMore
      );

      return cursorPaginated(c, entries, { limit, hasMore, nextCursor });
    }

    const { limit, page, skip } = parsePagination(c);

    const [tickets, total] = await Promise.all([
      Ticket.find(baseFilter).sort({ number: 1 }).skip(skip).limit(limit).lean(),
      Ticket.countDocuments(baseFilter).maxTimeMS(5000),
    ]);

    return paginated(c, ticketsToEntryDtos(tickets as unknown as TicketLike[]), total, page, limit);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.entries.listByCompetition",
    });
    console.error("Error fetching entries:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
