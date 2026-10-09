import {
  Competition,
  CompetitionInstantPrize,
  InstantPrize,
  InstantPrizeWin,
} from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { Hono } from "hono";
import mongoose, { Types } from "mongoose";

const app = new Hono();

const PRIZE_COLLECTION = InstantPrize.collection.name;
const WIN_COLLECTION = InstantPrizeWin.collection.name;
const COMP_COLLECTION = Competition.collection.name;

app.get(
  "/",
  redisCacheRoute({
    route: "competition:instant-prizes",
    scope: "public",
    ttlSeconds: 30,
    resourceIdResolver: (c) => c.req.param("competitionId"),
  }),
  async (c) => {
    try {
      const param = c.req.param("competitionId");
      if (!param) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Missing competition ID", 400);
      }
      const { limit, skip, page } = parsePagination(c);
      await dbConnect();

      let competitionObjectId: Types.ObjectId;
      if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
        competitionObjectId = new Types.ObjectId(param);
      } else {
        const competition = await Competition.findOne({ slug: param, status: "active" })
          .select("_id")
          .lean();
        if (!competition) {
          return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
        }
        competitionObjectId = competition._id as Types.ObjectId;
      }

      const total = await CompetitionInstantPrize.countDocuments({
        competitionId: competitionObjectId,
      }).maxTimeMS(5000);

      const pipeline: mongoose.PipelineStage[] = [
        { $match: { competitionId: competitionObjectId } },
        { $sort: { sortOrder: 1, _id: 1 } },
        { $skip: skip },
        { $limit: limit },

        // Lookup InstantPrize
        {
          $lookup: {
            from: PRIZE_COLLECTION,
            localField: "instantPrizeId",
            foreignField: "_id",
            as: "prize",
          },
        },
        { $unwind: { path: "$prize", preserveNullAndEmptyArrays: true } },

        // Lookup InstantPrizeWin (wins for this CIP)
        {
          $lookup: {
            from: WIN_COLLECTION,
            localField: "_id",
            foreignField: "competitionInstantPrizeId",
            as: "wins",
          },
        },

        // Lookup linked Competition (only for competition_ticket type)
        {
          $lookup: {
            from: COMP_COLLECTION,
            let: { linkedId: "$prize.linkedCompetitionId" },
            pipeline: [
              { $match: { _id: "$$linkedId" } },
              { $project: { imageUrl: 1, title: 1, slug: 1 } },
            ],
            as: "linkedComp",
          },
        },
        { $unwind: { path: "$linkedComp", preserveNullAndEmptyArrays: true } },

        // Lookup Profile for each win's userId
        {
          $lookup: {
            from: "profiles",
            localField: "wins.userId",
            foreignField: "_id",
            as: "winProfiles",
          },
        },

        // Project final shape
        {
          $project: {
            _id: 1,
            winningEntryNumbers: { $ifNull: ["$winningEntryNumbers", []] },
            quantity: 1,
            claimedCount: 1,
            isArchived: { $ifNull: ["$isArchived", false] },
            instantPrize: {
              title: { $ifNull: ["$prize.title", ""] },
              description: { $ifNull: ["$prize.description", ""] },
              images: { $ifNull: ["$prize.images", []] },
              value: { $ifNull: ["$prize.value", 0] },
              type: { $ifNull: ["$prize.type", "prize"] },
              linkedCompetitionId: {
                $cond: {
                  if: { $eq: [{ $ifNull: ["$prize.type", ""] }, "competition_ticket"] },
                  then: { $toString: { $ifNull: ["$prize.linkedCompetitionId", null] } },
                  else: null,
                },
              },
              linkedCompetition: {
                id: {
                  $cond: {
                    if: { $eq: [{ $ifNull: ["$prize.type", ""] }, "competition_ticket"] },
                    then: { $toString: { $ifNull: ["$prize.linkedCompetitionId", null] } },
                    else: null,
                  },
                },
                title: {
                  $cond: {
                    if: { $eq: [{ $ifNull: ["$prize.type", ""] }, "competition_ticket"] },
                    then: { $ifNull: ["$linkedComp.title", ""] },
                    else: null,
                  },
                },
                slug: {
                  $cond: {
                    if: { $eq: [{ $ifNull: ["$prize.type", ""] }, "competition_ticket"] },
                    then: { $ifNull: ["$linkedComp.slug", null] },
                    else: null,
                  },
                },
                imageUrl: {
                  $cond: {
                    if: { $eq: [{ $ifNull: ["$prize.type", ""] }, "competition_ticket"] },
                    then: { $ifNull: ["$linkedComp.imageUrl", null] },
                    else: null,
                  },
                },
              },
              ticketCount: { $ifNull: ["$prize.ticketCount", null] },
            },
            winnerEntries: {
              $map: {
                input: "$wins",
                as: "win",
                in: {
                  ticketNumber: "$$win.ticketNumber",
                  userFullName: {
                    $let: {
                      vars: {
                        profile: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$winProfiles",
                                as: "p",
                                cond: { $eq: ["$$p._id", "$$win.userId"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: {
                        $cond: {
                          if: {
                            $and: [{ $ne: ["$$profile", null] }, { $ne: ["$$profile", undefined] }],
                          },
                          then: {
                            $trim: {
                              input: {
                                $concat: [
                                  { $ifNull: ["$$profile.firstName", ""] },
                                  " ",
                                  { $ifNull: ["$$profile.lastName", ""] },
                                ],
                              },
                            },
                          },
                          else: "Anonymous",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ];

      const result = await CompetitionInstantPrize.aggregate(pipeline)
        .option({ maxTimeMS: 5000 })
        .exec();

      // Post-process: trim and filter empty names
      const cleaned = result.map((cip: Record<string, unknown>) => ({
        ...cip,
        id: (cip._id as mongoose.Types.ObjectId).toString(),
        winnerEntries: (
          cip.winnerEntries as Array<{ ticketNumber: number; userFullName: string }>
        ).map((w: { ticketNumber: number; userFullName: string }) => ({
          ticketNumber: w.ticketNumber,
          userFullName: w.userFullName?.trim() || "Anonymous",
        })),
      }));

      return paginated(c, cleaned, total, page, limit);
    } catch (err: unknown) {
      console.error("Error fetching competition instant prizes:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "competitions.instantPrizes.list",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
