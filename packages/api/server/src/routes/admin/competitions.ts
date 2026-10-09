import {
  Competition,
  CompetitionBonusAwardAssignment,
  CompetitionInstantPrize,
  FrameExtractionJob,
  type ICompetition,
  Order,
  OrderItem,
  Ticket,
  Winner,
} from "@oc/api-db/models";
import type { CompetitionStatus } from "@oc/api-db/models/Competition";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { substringRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { created, error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { rollbackOrderRefund } from "@oc/api-payment-core";
import { buildRefundDeps } from "@oc/api-server/lib/payment/build-refund-deps";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { onProgress } from "@oc/api-server/lib/utils/extraction-events";
import { runExtraction } from "@oc/api-server/lib/utils/frame-extractor";
import { requireAdmin, requireStaff } from "@oc/api-server/middleware/auth";
import type { Context, Next } from "hono";
import { extractKeyFromUrl } from "@oc/api-storage/s3";
import {
  enrichCompetitionsWithTicketStats,
  enrichCompetitionWithTicketStats,
} from "@oc/api-tickets/competition-stats";
import {
  backpropagateCompetitionToWinners,
  type CompetitionWinnerSnapshot,
  countActiveCompetitionInstantPrizes,
  countInstantPrizesLinkedToCompetition,
} from "@oc/api-tickets/competitions";
import { getMinimumAllowedMaxTickets, provisionTickets } from "@oc/api-tickets/ticket-service";
import { validateBody } from "@oc/api-validation";
import {
  type CreateCompetitionInput,
  createCompetitionSchema,
  type UpdateCompetitionInput,
  updateCompetitionSchema,
} from "@oc/api-validation/schemas/competitions";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { PipelineStage } from "mongoose";
import mongoose, { Types } from "mongoose";

// Startup recovery: mark stale running jobs as abandoned on restart
(async () => {
  try {
    await dbConnect();
    const result = await FrameExtractionJob.updateMany(
      { status: "running" },
      { $set: { status: "abandoned", errorMessage: "Server restarted during extraction" } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[startup] Marked ${result.modifiedCount} stale extraction job(s) as abandoned`);
    }
  } catch {
    // Non-critical — DB may not be ready at import time
  }
})();

const app = new Hono();

app.use("*", requireStaff);

// Admin-only writes for a specific competition (and its sub-resources). Managers
// may read competitions and run draws (POST /:id/end-draw, POST /winners) but
// must not create/edit/delete competitions or their landing videos.
async function requireAdminForCompetitionSubRoutes(c: Context, next: Next) {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    return next();
  }
  if (c.req.path.endsWith("/end-draw")) {
    return next();
  }
  return requireAdmin(c, next);
}

app.use("/:id", requireAdminForCompetitionSubRoutes);
app.use("/:id/*", requireAdminForCompetitionSubRoutes);

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: [
        "title",
        "slug",
        "status",
        "category",
        "prizeValue",
        "ticketPrice",
        "maxTickets",
        "drawDate",
        "createdAt",
        "ticketsSold",
      ],
      defaultSort: { createdAt: -1 },
    });
    await dbConnect();

    const showDeleted = c.req.query("showDeleted") === "true";
    const query: Record<string, unknown> = {};
    if (!showDeleted) {
      query.deletedAt = null;
    }
    const status = c.req.query("status");
    if (status && status !== "all") {
      if (status === "need_draw") {
        query.status = "pending_draw";
      } else {
        const parts = status
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        query.status = parts.length > 1 ? { $in: parts } : parts[0];
      }
    } else {
      query.status = { $nin: ["drawn", "cancelled"] };
    }
    const search = c.req.query("search");
    if (search) {
      const textConditions: Record<string, unknown>[] = [
        { title: { $regex: substringRegex(search), $options: "i" } },
        { slug: { $regex: substringRegex(search), $options: "i" } },
        { shortDescription: { $regex: substringRegex(search), $options: "i" } },
        { description: { $regex: substringRegex(search), $options: "i" } },
        { category: { $regex: substringRegex(search), $options: "i" } },
        { status: { $regex: substringRegex(search), $options: "i" } },
      ];
      query.$or = textConditions;
    }

    const basePipeline: PipelineStage[] = [{ $match: query }];
    const baseCountPipeline: PipelineStage[] = [{ $match: query }];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      status: { groupKey: "$status", groupLabel: "$status" },
      category: { groupKey: "$category", groupLabel: "$category" },
    };

    const { dataPipeline, countPipeline, isGrouped } = applyGroupBy(
      basePipeline,
      baseCountPipeline,
      groupBy,
      GROUPING_CONFIG,
      page,
      limit,
      sortObj,
      sortDir
    );

    const [competitions, totalResult] = await Promise.all([
      Competition.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      Competition.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    let result: unknown[];
    if (isGrouped) {
      result = await Promise.all(
        (competitions as Array<{ items: Record<string, unknown>[] }>).map(async (group) => ({
          ...group,
          items: await enrichCompetitionsWithTicketStats(
            group.items as Parameters<typeof enrichCompetitionsWithTicketStats>[0]
          ),
        }))
      );
    } else {
      result = await enrichCompetitionsWithTicketStats(
        competitions as Parameters<typeof enrichCompetitionsWithTicketStats>[0]
      );
    }

    return paginated(c, result, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing competitions:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/deleted", async (c) => {
  try {
    await dbConnect();
    const items = await Competition.findDeleted().sort({ deletedAt: -1 }).limit(50).lean();
    return success(c, items);
  } catch (err: unknown) {
    console.error("Error listing deleted competitions:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.listDeleted",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const param = c.req.param("id");
    await dbConnect();

    let competition: Awaited<ReturnType<typeof Competition.findById>> | null = null;
    if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
      competition = await Competition.findById(param).lean();
    } else {
      competition = await Competition.findOne({ slug: param }).lean();
    }

    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    return success(
      c,
      await enrichCompetitionWithTicketStats(
        competition as Pick<ICompetition, "maxTickets"> & { _id: mongoose.Types.ObjectId }
      )
    );
  } catch (err: unknown) {
    console.error("Error fetching competition:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  requireAdmin,
  async (c, next) => validateBody(c, next, createCompetitionSchema),
  async (c) => {
    try {
      const body = c.get("body") as CreateCompetitionInput;
      await dbConnect();

      const competition = await Competition.create(body);
      const inserted = await provisionTickets(competition._id, competition.maxTickets);
      await invalidateByChannelSafe(CH.competitions, CH.competitionFeatured, CH.entries);
      const ticketsInDb = await Ticket.countDocuments({ competitionId: competition._id });
      if (inserted !== competition.maxTickets || ticketsInDb !== competition.maxTickets) {
        console.error(
          `[admin.competitions.create] ticket provisioning mismatch: compId=${competition._id.toString()} expected=${competition.maxTickets} inserted=${inserted} ticketsInDb=${ticketsInDb}`
        );
      }

      return created(
        c,
        await enrichCompetitionWithTicketStats(
          competition.toObject() as Pick<ICompetition, "maxTickets"> & {
            _id: mongoose.Types.ObjectId;
          }
        )
      );
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Competition slug already exists", 409);
      }
      console.error("Error creating competition:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.competitions.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:id",
  async (c, next) => validateBody(c, next, updateCompetitionSchema),
  async (c) => {
    try {
      const param = c.req.param("id");
      const body = c.get("body") as UpdateCompetitionInput;
      await dbConnect();

      let existing: (ICompetition & { _id: Types.ObjectId }) | null = null;
      if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
        existing = (await Competition.findById(param).lean()) as
          | (ICompetition & { _id: Types.ObjectId })
          | null;
      } else {
        existing = (await Competition.findOne({ slug: param }).lean()) as
          | (ICompetition & { _id: Types.ObjectId })
          | null;
      }

      if (!existing) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      if (existing.status === "drawn" || existing.status === "cancelled") {
        const nonStatusFields = Object.keys(body).filter((k) => k !== "status");
        if (nonStatusFields.length > 0) {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `Cannot modify a ${existing.status} competition`,
            400
          );
        }
        if (body.status && body.status !== "cancelled") {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `Cannot transition from ${existing.status} to ${body.status}`,
            400
          );
        }
        if (body.status === "cancelled" && existing.status === "cancelled") {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Competition is already cancelled", 400);
        }
      }

      const STATUS_TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
        draft: ["active", "cancelled"],
        active: ["paused", "ended", "cancelled"],
        paused: ["active", "ended", "cancelled"],
        ended: ["pending_draw", "cancelled"],
        pending_draw: ["drawn", "cancelled"],
        drawn: ["cancelled"],
        cancelled: [],
      };
      if (body.status && body.status !== existing.status) {
        const allowed = STATUS_TRANSITIONS[existing.status as CompetitionStatus];
        if (!allowed?.includes(body.status as CompetitionStatus)) {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `Invalid status transition: ${existing.status} → ${body.status}. Allowed transitions: ${(allowed ?? []).join(", ") || "none (terminal state)"}`,
            400
          );
        }
      }

      if (body.maxTickets != null && body.maxTickets < existing.maxTickets) {
        const minAllowed = await getMinimumAllowedMaxTickets(existing._id);
        if (body.maxTickets < minAllowed) {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `maxTickets cannot be reduced below ${minAllowed} (sold/held tickets or instant prize winning numbers exceed the new cap)`,
            400
          );
        }
      }

      // HEAD-check every provided image URL against S3. Broken URLs (404)
      // are STRIPPED from prizeImages in the saved payload (self-healing)
      // — but kept as informational log so the admin knows. Transient S3
      // errors are logged and the URL is kept (don't break saves on flaky
      // storage). If the URL was previously in the DB but no longer exists
      // in S3, we silently remove it.
      const reqIdHead = c.get("requestId") || "no-reqid";
      const urlsToCheck: string[] = [];
      if (typeof body.imageUrl === "string" && body.imageUrl) urlsToCheck.push(body.imageUrl);
      if (typeof body.heroImageUrl === "string" && body.heroImageUrl)
        urlsToCheck.push(body.heroImageUrl);
      if (typeof body.ogImageUrl === "string" && body.ogImageUrl) urlsToCheck.push(body.ogImageUrl);
      if (typeof body.refOgImageUrl === "string" && body.refOgImageUrl)
        urlsToCheck.push(body.refOgImageUrl);
      if (typeof body.prizeImageUrl === "string" && body.prizeImageUrl)
        urlsToCheck.push(body.prizeImageUrl);
      if (Array.isArray(body.prizeImages)) urlsToCheck.push(...body.prizeImages);
      if (Array.isArray(body.prizeImagesRemote)) urlsToCheck.push(...body.prizeImagesRemote);

      const bodyDump = {
        imageUrl: body.imageUrl,
        heroImageUrl: body.heroImageUrl,
        prizeImageUrl: body.prizeImageUrl,
        prizeImages: body.prizeImages,
        prizeImagesRemote: body.prizeImagesRemote,
      };
      console.log(
        `[admin.competitions.update] ${reqIdHead} body image fields: ${JSON.stringify(bodyDump)}`
      );
      console.log(
        `[admin.competitions.update] ${reqIdHead} HEAD-check urlsToCheck (${urlsToCheck.length}): ${JSON.stringify(urlsToCheck)}`
      );

      const brokenUrls = new Set<string>();
      if (urlsToCheck.length > 0) {
        const headCheck = async (
          url: string
        ): Promise<{ url: string; ok: boolean; status: number }> => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(url, { method: "HEAD", signal: controller.signal });
            clearTimeout(timer);
            console.log(`[admin.competitions.update] ${reqIdHead} HEAD ${url} => ${res.status}`);
            return { url, ok: res.status !== 404, status: res.status };
          } catch (err) {
            console.error(`[admin.competitions.update] ${reqIdHead} HEAD failed for ${url}:`, err);
            return { url, ok: true, status: -1 };
          }
        };

        const results = await Promise.all(urlsToCheck.map((u) => headCheck(u)));
        for (const r of results) {
          console.log(
            `[admin.competitions.update] ${reqIdHead} HEAD result url=${r.url} ok=${r.ok} status=${r.status}`
          );
          if (!r.ok) {
            brokenUrls.add(r.url);
            console.warn(
              `[admin.competitions.update] ${reqIdHead} stripped broken image URL: ${r.url}`
            );
          }
        }
      }
      console.log(
        `[admin.competitions.update] ${reqIdHead} brokenUrls=${brokenUrls.size > 0 ? JSON.stringify([...brokenUrls]) : "none"}`
      );

      // Strip broken URLs from the saved payload. Only the fields the form
      // sent are touched. This is the self-healing path for stale references.
      const updatePayload: Record<string, unknown> = { ...body };
      if (brokenUrls.size > 0) {
        if (Array.isArray(updatePayload.prizeImages)) {
          updatePayload.prizeImages = (updatePayload.prizeImages as string[]).filter(
            (u) => !brokenUrls.has(u)
          );
        }
        if (Array.isArray(updatePayload.prizeImagesRemote)) {
          updatePayload.prizeImagesRemote = (updatePayload.prizeImagesRemote as string[]).filter(
            (u) => !brokenUrls.has(u)
          );
        }
        if (typeof updatePayload.imageUrl === "string" && brokenUrls.has(updatePayload.imageUrl)) {
          updatePayload.imageUrl = "";
        }
        if (
          typeof updatePayload.heroImageUrl === "string" &&
          brokenUrls.has(updatePayload.heroImageUrl)
        ) {
          updatePayload.heroImageUrl = "";
        }
        if (
          typeof updatePayload.ogImageUrl === "string" &&
          brokenUrls.has(updatePayload.ogImageUrl)
        ) {
          updatePayload.ogImageUrl = "";
        }
        if (
          typeof updatePayload.refOgImageUrl === "string" &&
          brokenUrls.has(updatePayload.refOgImageUrl)
        ) {
          updatePayload.refOgImageUrl = "";
        }
        if (
          typeof updatePayload.prizeImageUrl === "string" &&
          brokenUrls.has(updatePayload.prizeImageUrl)
        ) {
          updatePayload.prizeImageUrl = "";
        }
      }
      if (
        body.landingPageVideoUrl != null &&
        body.landingPageVideoUrl !== existing.landingPageVideoUrl &&
        existing.landingPageVideoUrl
      ) {
        const { deleteAsset } = await import("@oc/api-storage/s3");
        const priorKey = extractKeyFromUrl(existing.landingPageVideoUrl);
        if (priorKey)
          await deleteAsset(priorKey).catch((err) => console.error("S3 delete failed:", err));
        const { deleteFrames } = await import("@oc/api-server/lib/utils/frame-extraction");
        await deleteFrames(existing._id.toString()).catch((err) =>
          console.error("S3 delete failed:", err)
        );
        // Clear frame fields so stale data isn't left behind if the new video fails
        updatePayload.landingPageVideoFramesPrefix = null;
        updatePayload.landingPageVideoFrameCount = null;
      }

      let competition: (ICompetition & { _id: Types.ObjectId }) | null = null;
      if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
        competition = (await Competition.findByIdAndUpdate(existing._id, updatePayload, {
          returnDocument: "after",
        }).lean()) as (ICompetition & { _id: Types.ObjectId }) | null;
      } else {
        competition = (await Competition.findOneAndUpdate({ slug: param }, updatePayload, {
          returnDocument: "after",
        }).lean()) as (ICompetition & { _id: Types.ObjectId }) | null;
      }

      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      const winnerSnapshot: CompetitionWinnerSnapshot = {};
      if (existing.title !== competition.title) {
        winnerSnapshot.prizeTitle = competition.title;
      }
      if (existing.prizeValue !== competition.prizeValue) {
        winnerSnapshot.prizeValue = competition.prizeValue;
      }

      if (Object.keys(winnerSnapshot).length > 0) {
        await backpropagateCompetitionToWinners(competition._id, winnerSnapshot);
      }

      if (competition.status === "cancelled") {
        await Ticket.updateMany(
          { competitionId: competition._id, status: "held" },
          { $set: { status: "available" } }
        );

        const items = await OrderItem.find(
          { competitionId: competition._id },
          { orderId: 1 }
        ).lean();
        const orderIds = [...new Set(items.map((i) => i.orderId.toString()))];
        if (orderIds.length > 0) {
          await Order.updateMany(
            { _id: { $in: orderIds }, status: "pending" },
            { $set: { status: "failed" } }
          );
        }

        await CompetitionInstantPrize.updateMany(
          { competitionId: competition._id, isArchived: false },
          { $set: { isArchived: true } }
        );

        console.log(
          `[cancelled] Competition "${competition.title}" (${competition._id}) cancelled. Released held tickets, failed pending orders, archived CIPs.`
        );
      }

      const updated = competition as Pick<ICompetition, "maxTickets"> & {
        _id: mongoose.Types.ObjectId;
      };
      if (body.maxTickets != null) {
        await provisionTickets(updated._id, updated.maxTickets);
      }

      await invalidateByChannelSafe(
        CH.competitions,
        CH.competitionDetail,
        CH.competitionFeatured,
        CH.landingPage,
        CH.entries,
        CH.instantPrizes
      );

      if (body.status === "active" && existing.status === "draft") {
        void sendPushNotification(
          {
            title: `New competition: ${competition.title}`,
            body: `${competition.title} is now live! Enter now for a chance to win.`,
            type: "marketing",
            url: `/competitions/${competition.slug ?? competition._id}`,
            image: competition.imageUrl ?? undefined,
            tag: `new-comp-${competition._id.toString()}`,
          },
          {}
        ).catch(() => {});
      }

      return success(c, await enrichCompetitionWithTicketStats(updated));
    } catch (err: unknown) {
      console.error("Error updating competition:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.competitions.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/:id", async (c) => {
  try {
    const param = c.req.param("id");
    await dbConnect();

    let competition: (ICompetition & { _id: Types.ObjectId }) | null = null;
    if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
      competition = (await Competition.findById(param).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    } else {
      competition = (await Competition.findOne({ slug: param }).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    }

    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    const templateCount = await countInstantPrizesLinkedToCompetition(competition._id);
    if (templateCount > 0) {
      return error(
        c,
        ErrorCodes.CONFLICT,
        `Cannot delete this competition because it is linked to ${templateCount} instant prize template(s). Reassign or remove those instant prizes first.`,
        409
      );
    }

    const cipCount = await countActiveCompetitionInstantPrizes(competition._id);
    if (cipCount > 0) {
      return error(
        c,
        ErrorCodes.CONFLICT,
        `Cannot delete this competition because it has ${cipCount} active instant prize bridge record(s). Archive or remove those instant prizes first.`,
        409
      );
    }

    const bonusAssignmentCount = await CompetitionBonusAwardAssignment.countDocuments({
      competitionId: competition._id,
      deletedAt: null,
    });
    if (bonusAssignmentCount > 0) {
      return error(
        c,
        ErrorCodes.CONFLICT,
        `Cannot delete this competition because it has ${bonusAssignmentCount} bonus award assignment(s). Remove those assignments first.`,
        409
      );
    }

    // ─── Refund tickets and mark orders as refunded ──────────────────────
    const soldTicketCount = await Ticket.countDocuments({
      competitionId: competition._id,
      status: "sold",
    });

    if (soldTicketCount > 0) {
      const soldTickets = await Ticket.find({
        competitionId: competition._id,
        status: "sold",
      })
        .select("orderId")
        .lean();

      const uniqueOrderIds = [
        ...new Set(
          soldTickets.map((t) => t.orderId?.toString()).filter((id): id is string => !!id)
        ),
      ];
      const orderObjectIds = uniqueOrderIds.map((id) => new Types.ObjectId(id));

      await Ticket.updateMany(
        { competitionId: competition._id, status: "sold" },
        {
          $set: { status: "available" },
          $unset: {
            ownerId: 1,
            orderId: 1,
            answerIndex: 1,
            answerCorrect: 1,
            reservedAt: 1,
            soldAt: 1,
            instantPrizeWinId: 1,
          },
        }
      );

      await Competition.updateOne(
        { _id: competition._id },
        { $inc: { ticketsSold: -soldTicketCount } }
      );

      let refundedOrdersCount = 0;
      if (orderObjectIds.length > 0) {
        const orders = await Order.find({ _id: { $in: orderObjectIds } })
          .select("userId status total items referralBalanceUsed metadata")
          .lean();

        const completedOrders = orders.filter((o) => o.status === "completed");
        const nonCompletedOrders = orders.filter((o) => o.status !== "completed");

        if (nonCompletedOrders.length > 0) {
          await Order.updateMany(
            { _id: { $in: nonCompletedOrders.map((o) => o._id) } },
            {
              $set: {
                status: "failed",
                "metadata.refundedVia": "competition_deletion",
                "metadata.refundedAt": new Date().toISOString(),
              },
            }
          );
        }

        for (const order of completedOrders) {
          await Order.updateOne(
            { _id: order._id },
            {
              $set: {
                status: "refunded",
                "metadata.refundedVia": "competition_deletion",
                "metadata.refundedAt": new Date().toISOString(),
              },
            }
          );

          const result = await rollbackOrderRefund(
            order._id.toString(),
            order.userId.toString(),
            c.get("userId") as string | null,
            `Competition soft-deleted: ${competition.title}`,
            buildRefundDeps()
          );

          if (!result.success) {
            console.error(
              `[competition.delete] rollbackOrderRefund failed for order ${order._id}: ${result.error}`
            );
          } else {
            refundedOrdersCount++;
          }
        }
      }

      console.log(
        `[competition.delete] Released ${soldTicketCount} tickets and refunded ${refundedOrdersCount} order(s) for competition ${competition._id}`
      );
    }

    // Cascade delete S3 media
    const { deleteAsset } = await import("@oc/api-storage/s3");
    const { deleteFrames } = await import("@oc/api-server/lib/utils/frame-extraction");
    const compId = competition!._id;

    async function isUrlReferencedByOtherCompetition(url: string): Promise<boolean> {
      const count = await Competition.countDocuments({
        _id: { $ne: compId },
        deletedAt: null,
        $or: [
          { imageUrl: url },
          { prizeImageUrl: url },
          { heroImageUrl: url },
          { prizeImagesSource: url },
          { prizeImages: url },
          { prizeImagesRemote: url },
        ],
      }).maxTimeMS(5000);
      return count > 0;
    }

    async function deleteAssetIfNotShared(url: string | undefined | null): Promise<void> {
      if (!url) return;
      if (await isUrlReferencedByOtherCompetition(url)) {
        console.warn(
          `[competition.delete] Skipping deletion of shared S3 object: ${url} (referenced by other active competitions)`
        );
        return;
      }
      const key = extractKeyFromUrl(url);
      if (key) {
        await deleteAsset(key).catch((err) => console.error("S3 delete failed:", err));
      }
    }

    const s3Urls = [
      competition.landingPageVideoUrl,
      competition.imageUrl,
      competition.prizeImageUrl,
      competition.heroImageUrl,
    ];
    for (const url of s3Urls) {
      await deleteAssetIfNotShared(url);
    }

    if (competition.prizeImages?.length) {
      for (const url of competition.prizeImages) {
        await deleteAssetIfNotShared(url);
      }
    }

    if (competition.prizeImagesRemote?.length) {
      for (const url of competition.prizeImagesRemote) {
        await deleteAssetIfNotShared(url);
      }
    }

    if (competition.prizeImagesSource) {
      await deleteAssetIfNotShared(competition.prizeImagesSource);
    }

    await deleteFrames(compId.toString()).catch((err) => console.error("S3 delete failed:", err));

    await Competition.softDelete(compId, c.get("userId") ?? undefined);

    await invalidateByChannelSafe(
      CH.competitions,
      CH.competitionDetail,
      CH.competitionFeatured,
      CH.landingPage,
      CH.entries
    );

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting competition:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

// ─── Landing Page Video ────────────────────────────────────────────────────────

const VIDEO_MAX_SIZE = 100 * 1024 * 1024; // 100 MB
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

app.post("/:id/landing-video", async (c) => {
  try {
    const param = c.req.param("id");
    await dbConnect();

    let competition: (ICompetition & { _id: Types.ObjectId }) | null = null;
    if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
      competition = (await Competition.findById(param).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    } else {
      competition = (await Competition.findOne({ slug: param }).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    }

    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return error(c, ErrorCodes.MISSING_PARAMS, "file is required", 400);
    }

    if (!VIDEO_TYPES.includes(file.type)) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Only video files (mp4, webm, quicktime) are allowed",
        400
      );
    }

    if (file.size > VIDEO_MAX_SIZE) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "File too large. Max 100MB.", 400);
    }

    const { uploadFile, buildAssetUrl, deleteAsset } = await import("@oc/api-storage/s3");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    const random = Math.random().toString(36).slice(2);
    let key = `landing-videos/${competition._id.toString()}/${Date.now()}-${random}.${ext}`;

    // Delete prior video and frames if replacing
    const priorUrl = competition.landingPageVideoUrl;
    if (priorUrl) {
      const priorKey = extractKeyFromUrl(priorUrl);
      if (priorKey)
        await deleteAsset(priorKey).catch((err) => console.error("S3 delete failed:", err));
      // Also delete prior frames
      const { deleteFrames } = await import("@oc/api-server/lib/utils/frame-extraction");
      await deleteFrames(competition._id.toString()).catch((err) =>
        console.error("S3 delete failed:", err)
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let bytes = new Uint8Array(arrayBuffer);
    let contentType = file.type;

    const { transformUploadBytes } = await import("@oc/api-server/lib/media-converter/transform");
    const transformed = await transformUploadBytes({ key, bytes, contentType });
    key = transformed.key;
    bytes = transformed.bytes;
    contentType = transformed.contentType;

    await uploadFile(key, bytes, contentType);

    const url = buildAssetUrl(key);

    // Extract frames synchronously — the response only returns when frames are ready
    const { extractFrames } = await import("@oc/api-server/lib/utils/frame-extraction");
    const { prefix, count, fps, metadata } = await extractFrames(url, competition._id.toString());

    await Competition.findByIdAndUpdate(competition._id, {
      landingPageVideoUrl: url,
      landingPageVideoFramesPrefix: prefix,
      landingPageVideoFrameCount: count,
      landingPageVideoFps: fps,
      landingPageVideoMetadata: metadata,
    });

    return success(c, {
      url,
      landingPageVideoFramesPrefix: prefix,
      landingPageVideoFrameCount: count,
      landingPageVideoFps: fps,
    });
  } catch (err: unknown) {
    console.error("Error uploading landing video:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.uploadLandingVideo",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id/landing-video/presign", async (c) => {
  try {
    const param = c.req.param("id");
    const { "content-type": contentType } = c.req.query();

    if (!contentType) {
      return error(c, ErrorCodes.MISSING_PARAMS, "content-type query param is required", 400);
    }

    await dbConnect();

    let competition: (ICompetition & { _id: Types.ObjectId }) | null = null;
    if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
      competition = (await Competition.findById(param).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    } else {
      competition = (await Competition.findOne({ slug: param }).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    }

    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    const ext = contentType === "video/quicktime" ? "mov" : (contentType.split("/")[1] ?? "mp4");
    const random = Math.random().toString(36).slice(2);
    const key = `landing-videos/${competition._id.toString()}/${Date.now()}-${random}.${ext}`;

    const { getPresignedUploadUrl, buildAssetUrl } = await import("@oc/api-storage/s3");
    const uploadUrl = await getPresignedUploadUrl(key, contentType);
    const publicUrl = buildAssetUrl(key);

    return success(c, {
      uploadUrl,
      publicUrl,
      key,
      priorUrl: competition.landingPageVideoUrl ?? null,
    });
  } catch (err: unknown) {
    console.error("Error generating presigned URL:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.generatePresignedUrl",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/landing-video/confirm", async (c) => {
  try {
    const param = c.req.param("id");
    const body = await c.req.json<{ key: string }>();

    if (!body.key || typeof body.key !== "string") {
      return error(c, ErrorCodes.MISSING_PARAMS, "key is required", 400);
    }

    await dbConnect();

    let competition: (ICompetition & { _id: Types.ObjectId }) | null = null;
    if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
      competition = (await Competition.findById(param).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    } else {
      competition = (await Competition.findOne({ slug: param }).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    }

    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    // Security: validate the key belongs to this competition
    const expectedPrefix = `landing-videos/${competition._id.toString()}/`;
    if (!body.key.startsWith(expectedPrefix)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid key", 400);
    }

    const { buildAssetUrl, deleteAsset } = await import("@oc/api-storage/s3");
    const { normalizeObjectAtKey } = await import("@oc/api-server/lib/media-converter/transform");

    let storageKey = body.key;
    try {
      const normalized = await normalizeObjectAtKey(body.key);
      storageKey = normalized.key;
    } catch (err) {
      console.error("[confirm] media converter normalize failed:", err);
    }

    const priorUrl = competition.landingPageVideoUrl;

    // Delete prior video and frames after new one is safely committed to DB
    if (priorUrl) {
      const priorKey = extractKeyFromUrl(priorUrl);
      if (priorKey)
        await deleteAsset(priorKey).catch((err) => console.error("S3 delete failed:", err));
      const { deleteFrames } = await import("@oc/api-server/lib/utils/frame-extraction");
      await deleteFrames(competition._id.toString()).catch((err) =>
        console.error("S3 delete failed:", err)
      );
    }

    const url = buildAssetUrl(storageKey);

    // Upsert: atomically creates a new job or resets an existing (possibly abandoned) one.
    // This avoids E11000 duplicate key errors from the unique competitionId index.
    const job = await FrameExtractionJob.findOneAndUpdate(
      { competitionId: competition._id },
      {
        competitionId: competition._id,
        videoUrl: url,
        status: "pending",
        framesExtracted: 0,
        framesTotal: null,
        percentage: 0,
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      },
      { upsert: true, returnDocument: "after" }
    );

    console.log("[confirm] jobId:", job?._id?.toString());

    // Update competition with video URL + job reference
    // Using doc.save() to avoid Mongoose 9 update casting issues with ObjectId fields
    const competitionDoc = await Competition.findById(competition._id);
    if (!competitionDoc) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }
    competitionDoc.landingPageVideoUrl = url;
    competitionDoc.frameExtractionJobId = job._id;
    await competitionDoc.save();

    // Start extraction in-process (fire-and-forget)
    runExtraction(job._id.toString(), competition._id.toString(), url).catch((err) => {
      console.error("[extraction] unexpected error:", err);
    });

    await invalidateByChannelSafe(CH.landingPage, CH.competitionDetail);

    // Return immediately — frontend connects to /extract-stream for progress
    return success(c, {
      jobId: job._id.toString(),
      status: "pending",
      message: "Frame extraction started in background",
    });
  } catch (err: unknown) {
    console.error("Error confirming landing video:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.confirmLandingVideo",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

// ─── Frame Extraction SSE Stream ──────────────────────────────────────────────

app.get("/:id/landing-video/extract-stream", async (c) => {
  try {
    const param = c.req.param("id");
    await dbConnect();

    let competition: (ICompetition & { _id: Types.ObjectId }) | null = null;
    if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
      competition = (await Competition.findById(param).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    } else {
      competition = (await Competition.findOne({ slug: param }).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    }

    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    const job = await FrameExtractionJob.findOne({ competitionId: competition._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!job) {
      return success(c, { status: "no_video" });
    }

    // Terminal state — return directly (no SSE needed)
    if (["completed", "failed", "abandoned"].includes(job.status)) {
      const { buildAssetUrl } = await import("@oc/api-storage/s3");
      return success(c, {
        jobId: job._id.toString(),
        status: job.status,
        framesExtracted: job.framesExtracted,
        framesTotal: job.framesTotal,
        percentage: job.percentage,
        startedAt: job.startedAt?.toISOString() ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
        errorMessage: job.errorMessage,
        hasFrames: job.status === "completed" && job.framesExtracted > 0,
        landingPageVideoFramesPrefix:
          job.status === "completed"
            ? buildAssetUrl(`frames/${competition._id.toString()}/frame_`)
            : null,
        landingPageVideoFrameCount: job.status === "completed" ? job.framesExtracted : null,
        landingPageVideoFps:
          job.status === "completed" && competition?.landingPageVideoFps != null
            ? (competition as ICompetition & { landingPageVideoFps: number }).landingPageVideoFps
            : null,
      });
    }

    return streamSSE(c, async (stream) => {
      const jobId = job._id.toString();
      const unsubscribe = onProgress(jobId, (data) => {
        stream
          .writeSSE({ data: JSON.stringify(data), event: "progress" })
          .catch((err) => console.error("SSE write failed:", err));
      });

      stream.onAbort(() => unsubscribe());

      // Send current state as first event
      const current = await FrameExtractionJob.findById(job._id).lean();
      if (current) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "state",
            status: current.status,
            framesExtracted: current.framesExtracted,
            framesTotal: current.framesTotal,
            percentage: current.percentage,
            errorMessage: current.errorMessage,
            jobId: current._id.toString(),
          }),
          event: "state",
        });
      }

      // Keep connection open until client disconnects
      while (!stream.closed) {
        await stream.sleep(1000);
      }
    });
  } catch (err: unknown) {
    console.error("Error in extraction stream:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

// ─── Delete Landing Video ───────────────────────────────────────────────────────

app.delete("/:id/landing-video", async (c) => {
  try {
    const param = c.req.param("id");
    await dbConnect();

    let competition: (ICompetition & { _id: Types.ObjectId }) | null = null;
    if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
      competition = (await Competition.findById(param).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    } else {
      competition = (await Competition.findOne({ slug: param }).lean()) as
        | (ICompetition & { _id: Types.ObjectId })
        | null;
    }

    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    const priorUrl = competition.landingPageVideoUrl;
    if (priorUrl) {
      const { deleteAsset } = await import("@oc/api-storage/s3");
      const priorKey = extractKeyFromUrl(priorUrl);
      if (priorKey)
        await deleteAsset(priorKey).catch((err) => console.error("S3 delete failed:", err));
    }

    // Delete all frame files from CDN
    const { deleteFrames } = await import("@oc/api-server/lib/utils/frame-extraction");
    await deleteFrames(competition._id.toString()).catch((err) =>
      console.error("S3 delete failed:", err)
    );

    await Competition.findByIdAndUpdate(competition._id, {
      $unset: {
        landingPageVideoUrl: 1,
        landingPageVideoFramesPrefix: 1,
        landingPageVideoFrameCount: 1,
        frameExtractionJobId: 1,
      },
    });

    await invalidateByChannelSafe(CH.landingPage, CH.competitionDetail);

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting landing video:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.deleteLandingVideo",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const restored = await Competition.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }
    await invalidateByChannelSafe(CH.competitions, CH.competitionFeatured, CH.landingPage);
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring competition:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/undraw", async (c) => {
  try {
    const { id } = c.req.param();
    const userId = c.get("userId");
    await dbConnect();

    const body = await c.req.json();

    if (!body.reason || !["technical_error", "wrong_winner", "system_bug"].includes(body.reason)) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Valid reason required: technical_error, wrong_winner, or system_bug"
      );
    }

    if (!body.note || typeof body.note !== "string" || body.note.trim().length < 10) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Admin note must be at least 10 characters");
    }

    const competition = await Competition.findById(id);
    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    if (competition.status !== "drawn") {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Competition is not in drawn status");
    }

    await Winner.updateMany(
      { competitionId: id, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );

    if (competition.winnerTicketNumber != null) {
      await Ticket.updateOne(
        { competitionId: id, number: competition.winnerTicketNumber },
        { $set: { status: "available" }, $unset: { ownerId: 1 } }
      );
    }

    await Competition.findByIdAndUpdate(id, {
      $set: { status: "pending_draw" },
      $unset: { winnerTicketNumber: "", winnerId: "" },
      $push: {
        undrawHistory: {
          undrawnAt: new Date(),
          undrawnBy: userId,
          reason: body.reason,
          note: body.note.trim(),
        },
      },
    });

    await invalidateByChannelSafe(
      CH.competitions,
      CH.competitionDetail,
      CH.competitionFeatured,
      CH.landingPage,
      CH.entries,
      CH.instantPrizes
    );

    return success(c, { status: "pending_draw" });
  } catch (err: unknown) {
    console.error("Error undrawing competition:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.undraw",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

// Draw-time action: pause a competition before running its draw. Narrower than
// the general PUT /:id update — managers may call it while running a livestream.
app.post("/:id/end-draw", async (c) => {
  try {
    const { id } = c.req.param();
    await dbConnect();

    const competition = await Competition.findById(id);
    if (!competition) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
    }

    if (!["active", "paused"].includes(competition.status)) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Cannot end draw for competition in ${competition.status} status`
      );
    }

    await Competition.findByIdAndUpdate(id, { status: "paused" });

    await invalidateByChannelSafe(
      CH.competitions,
      CH.competitionDetail,
      CH.competitionFeatured,
      CH.landingPage,
      CH.entries,
      CH.instantPrizes
    );

    return success(c, { status: "paused" });
  } catch (err: unknown) {
    console.error("Error ending draw for competition:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.competitions.endDraw",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
