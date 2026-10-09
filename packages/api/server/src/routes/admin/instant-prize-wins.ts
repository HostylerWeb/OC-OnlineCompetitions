import {
  Competition,
  CompetitionInstantPrize,
  InstantPrize,
  InstantPrizeWin,
  Profile,
  Ticket,
} from "@oc/api-db/models";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex, substringRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import { Hono } from "hono";
import type { PipelineStage } from "mongoose";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireManager);

const CIP_COLLECTION = CompetitionInstantPrize.collection.name;
const PRIZE_COLLECTION = InstantPrize.collection.name;
const COMP_COLLECTION = Competition.collection.name;
const PROFILE_COLLECTION = Profile.collection.name;
const TICKET_COLLECTION = Ticket.collection.name;

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: [
        "wonAt",
        "claimedAt",
        "ticketNumber",
        "claimed",
        "prizeTitle",
        "prizeValue",
        "prizeType",
        "competitionTitle",
        "userEmail",
        "entryNumber",
      ],
      defaultSort: { wonAt: -1 },
    });
    await dbConnect();

    const showDeleted = c.req.query("showDeleted") === "true";
    const query: Record<string, unknown> = {};
    if (!showDeleted) {
      query.deletedAt = null;
    }
    const competitionId = c.req.query("competitionId");
    const userId = c.req.query("userId");
    const claimed = c.req.query("claimed");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if (userId) {
      query.userId = new mongoose.Types.ObjectId(userId);
    }
    if (claimed !== undefined) {
      query.claimed = claimed === "true";
    }
    if (startDate || endDate) {
      query.wonAt = {};
      if (startDate) {
        (query.wonAt as Record<string, Date>).$gte = new Date(startDate);
      }
      if (endDate) {
        (query.wonAt as Record<string, Date>).$lte = new Date(endDate);
      }
    }
    const search = c.req.query("search");

    // Base pipeline without sort/skip/limit
    const basePipeline: PipelineStage[] = [
      { $match: query },

      // Lookup CompetitionInstantPrize (bridge to competition)
      {
        $lookup: {
          from: CIP_COLLECTION,
          localField: "competitionInstantPrizeId",
          foreignField: "_id",
          as: "cip",
        },
      },
      { $unwind: { path: "$cip", preserveNullAndEmptyArrays: true } },
    ];

    // Filter by competition after the CIP join
    if (competitionId) {
      basePipeline.push({
        $match: { "cip.competitionId": new mongoose.Types.ObjectId(competitionId) },
      });
    }

    // Add remaining lookups and project
    basePipeline.push(
      // Lookup InstantPrize
      {
        $lookup: {
          from: PRIZE_COLLECTION,
          localField: "cip.instantPrizeId",
          foreignField: "_id",
          as: "prize",
        },
      },
      { $unwind: { path: "$prize", preserveNullAndEmptyArrays: true } },

      // Lookup Competition
      {
        $lookup: {
          from: COMP_COLLECTION,
          localField: "cip.competitionId",
          foreignField: "_id",
          as: "comp",
        },
      },
      { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },

      // Lookup Profile
      {
        $lookup: {
          from: PROFILE_COLLECTION,
          localField: "userId",
          foreignField: "_id",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // Lookup Ticket
      {
        $lookup: {
          from: TICKET_COLLECTION,
          localField: "entryId",
          foreignField: "_id",
          as: "ticket",
        },
      },
      { $unwind: { path: "$ticket", preserveNullAndEmptyArrays: true } },

      // Project final shape
      {
        $project: {
          _id: 1,
          userId: 1,
          ticketNumber: 1,
          claimed: 1,
          claimedAt: 1,
          wonAt: 1,
          entryId: 1,
          grantedEntryIds: 1,
          prizeTitle: { $ifNull: ["$prize.title", ""] },
          prizeValue: { $ifNull: ["$prize.value", 0] },
          prizeType: { $ifNull: ["$prize.type", "prize"] },
          competitionTitle: { $ifNull: ["$comp.title", ""] },
          userEmail: { $ifNull: ["$profile.email", ""] },
          userFirstName: { $ifNull: ["$profile.firstName", ""] },
          userLastName: { $ifNull: ["$profile.lastName", ""] },
          entryNumber: {
            $cond: {
              if: { $and: [{ $ne: ["$ticket", null] }, { $ne: ["$ticket", undefined] }] },
              then: "$ticket.number",
              else: "$ticketNumber",
            },
          },
        },
      },
      ...(() => {
        if (!search) return [];
        return [
          {
            $match: {
              $or: [
                {
                  $expr: {
                    $regexMatch: {
                      input: { $toString: "$ticketNumber" },
                      regex: escapeRegex(search),
                      options: "i",
                    },
                  },
                },
                { userEmail: { $regex: substringRegex(search), $options: "i" } },
                { prizeTitle: { $regex: substringRegex(search), $options: "i" } },
                { competitionTitle: { $regex: substringRegex(search), $options: "i" } },
              ],
            },
          },
        ];
      })()
    );

    // Count pipeline — same post-lookup search filter as data pipeline
    const searchFilter: PipelineStage[] = search
      ? [
          {
            $match: {
              $or: [
                {
                  $expr: {
                    $regexMatch: {
                      input: { $toString: "$ticketNumber" },
                      regex: escapeRegex(search),
                      options: "i",
                    },
                  },
                },
                { userEmail: { $regex: substringRegex(search), $options: "i" } },
                { prizeTitle: { $regex: substringRegex(search), $options: "i" } },
                { competitionTitle: { $regex: substringRegex(search), $options: "i" } },
              ],
            },
          },
        ]
      : [];

    const baseCountPipeline: PipelineStage[] = [
      { $match: query },
      {
        $lookup: {
          from: CIP_COLLECTION,
          localField: "competitionInstantPrizeId",
          foreignField: "_id",
          as: "cip",
        },
      },
      { $unwind: { path: "$cip", preserveNullAndEmptyArrays: true } },
    ];

    if (competitionId) {
      baseCountPipeline.push({
        $match: { "cip.competitionId": new mongoose.Types.ObjectId(competitionId) },
      });
    }
    baseCountPipeline.push(...searchFilter);

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      user: { groupKey: "$userId", groupLabel: "$userEmail" },
      prize: { groupKey: "$prizeTitle", groupLabel: "$prizeTitle" },
    };

    const { dataPipeline, countPipeline } = applyGroupBy(
      basePipeline,
      baseCountPipeline,
      groupBy,
      GROUPING_CONFIG,
      page,
      limit,
      sortObj,
      sortDir
    );

    const [wins, total] = await Promise.all([
      InstantPrizeWin.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      InstantPrizeWin.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const totalCount = total.length > 0 ? (total[0] as { total: number }).total : 0;

    return paginated(c, wins, totalCount, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing instant prize wins:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizeWins.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/deleted", async (c) => {
  try {
    await dbConnect();
    const items = await InstantPrizeWin.findDeleted().sort({ deletedAt: -1 }).limit(50).lean();
    return success(c, items);
  } catch (err: unknown) {
    console.error("Error listing deleted instant prize wins:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizeWins.listDeleted",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const [win] = await InstantPrizeWin.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id), deletedAt: null } },

      // Lookup CompetitionInstantPrize
      {
        $lookup: {
          from: CIP_COLLECTION,
          localField: "competitionInstantPrizeId",
          foreignField: "_id",
          as: "cip",
        },
      },
      { $unwind: { path: "$cip", preserveNullAndEmptyArrays: true } },

      // Lookup InstantPrize
      {
        $lookup: {
          from: PRIZE_COLLECTION,
          localField: "cip.instantPrizeId",
          foreignField: "_id",
          as: "prize",
        },
      },
      { $unwind: { path: "$prize", preserveNullAndEmptyArrays: true } },

      // Lookup Competition
      {
        $lookup: {
          from: COMP_COLLECTION,
          localField: "cip.competitionId",
          foreignField: "_id",
          as: "comp",
        },
      },
      { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },

      // Lookup Profile
      {
        $lookup: {
          from: PROFILE_COLLECTION,
          localField: "userId",
          foreignField: "_id",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // Lookup Ticket
      {
        $lookup: {
          from: TICKET_COLLECTION,
          localField: "entryId",
          foreignField: "_id",
          as: "ticket",
        },
      },
      { $unwind: { path: "$ticket", preserveNullAndEmptyArrays: true } },

      // Project final shape
      {
        $project: {
          _id: 1,
          ticketNumber: 1,
          claimed: 1,
          claimedAt: 1,
          wonAt: 1,
          entryId: 1,
          grantedEntryIds: 1,
          prizeTitle: { $ifNull: ["$prize.title", ""] },
          prizeValue: { $ifNull: ["$prize.value", 0] },
          prizeImages: { $ifNull: ["$prize.images", []] },
          prizeType: { $ifNull: ["$prize.type", "prize"] },
          competitionTitle: { $ifNull: ["$comp.title", ""] },
          competitionSlug: { $ifNull: ["$comp.slug", ""] },
          userEmail: { $ifNull: ["$profile.email", ""] },
          userFirstName: { $ifNull: ["$profile.firstName", ""] },
          userLastName: { $ifNull: ["$profile.lastName", ""] },
          entryNumber: {
            $cond: {
              if: { $and: [{ $ne: ["$ticket", null] }, { $ne: ["$ticket", undefined] }] },
              then: "$ticket.number",
              else: "$ticketNumber",
            },
          },
        },
      },
    ])
      .option({ maxTimeMS: 5000 })
      .exec();

    if (!win) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize win not found", 404);
    }

    return success(c, win);
  } catch (err: unknown) {
    console.error("Error fetching instant prize win:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizeWins.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.patch("/:id/claim", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const win = await InstantPrizeWin.findById(id);
    if (!win) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize win not found", 404);
    }

    win.claimed = true;
    win.claimedAt = new Date();
    await win.save();
    void invalidateUser(win.userId.toString()).catch(() => {});
    void invalidateByChannelSafe(CH.instantPrizes).catch(() => {});

    return success(c, { _id: win._id, claimed: win.claimed, claimedAt: win.claimedAt });
  } catch (err: unknown) {
    console.error("Error claiming instant prize win:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizeWins.claim",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const win = await InstantPrizeWin.findById(id).lean();
    if (!win) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize win not found", 404);
    }
    if (win.deletedAt) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize win not found", 404);
    }
    if (win.claimed === true) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Cannot delete a claimed win record", 400);
    }

    const deleted = await InstantPrizeWin.softDelete(id, c.get("userId") ?? undefined);
    if (!deleted) {
      return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to delete win record", 500);
    }

    void invalidateByChannelSafe(CH.instantPrizes).catch(() => {});
    void invalidateUser(win.userId.toString()).catch(() => {});

    return success(c, { _id: deleted._id });
  } catch (err: unknown) {
    console.error("Error deleting instant prize win:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizeWins.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const restored = await InstantPrizeWin.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize win not found", 404);
    }
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring instant prize win:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizeWins.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
