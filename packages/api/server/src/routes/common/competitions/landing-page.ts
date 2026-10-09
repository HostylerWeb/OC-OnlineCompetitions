import type { ICompetition } from "@oc/api-db/models";
import {
  Competition,
  CompetitionInstantPrize,
  InstantPrize,
  InstantPrizeWin,
  Winner,
} from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { enrichCompetitionWithTicketStats } from "@oc/api-tickets/competition-stats";
import { Hono } from "hono";
import mongoose, { Types } from "mongoose";

const app = new Hono();

const PRIZE_COLLECTION = InstantPrize.collection.name;
const WIN_COLLECTION = InstantPrizeWin.collection.name;
const COMP_COLLECTION = Competition.collection.name;

app.get(
  "/",
  redisCacheRoute({
    route: "landing-page:competition",
    scope: "public",
    ttlSeconds: 60,
    resourceIdResolver: (c) => c.req.param("slug"),
  }),
  async (c) => {
    try {
      const param = c.req.param("slug");
      if (!param) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Missing competition slug or ID", 400);
      }
      await dbConnect();

      const { limit = 20, skip } = parsePagination(c);

      let compId: Types.ObjectId;
      let competition: ICompetition | null = null;

      if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
        compId = new Types.ObjectId(param);
        competition = await Competition.findOne({ _id: compId, status: "active" }).lean();
      } else {
        competition = await Competition.findOne({ slug: param, status: "active" }).lean();
        if (competition) {
          compId = competition._id as Types.ObjectId;
        } else {
          return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
        }
      }

      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      const compMeta = competition as Pick<
        ICompetition,
        "maxTickets" | "status" | "_id" | "maxTicketsPerUser"
      >;

      const [enriched, cipsPipeline, cipsTotal, winners, winnerAgg, otherCompetitions, grantedAgg] =
        await Promise.all([
          enrichCompetitionWithTicketStats(compMeta),
          CompetitionInstantPrize.aggregate([
            { $match: { competitionId: compId } },
            { $sort: { _id: 1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: PRIZE_COLLECTION,
                localField: "instantPrizeId",
                foreignField: "_id",
                as: "prize",
              },
            },
            { $unwind: { path: "$prize", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: WIN_COLLECTION,
                localField: "_id",
                foreignField: "competitionInstantPrizeId",
                as: "wins",
              },
            },
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
            {
              $lookup: {
                from: "profiles",
                localField: "wins.userId",
                foreignField: "_id",
                as: "winProfiles",
              },
            },
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
                                $and: [
                                  { $ne: ["$$profile", null] },
                                  { $ne: ["$$profile", undefined] },
                                ],
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
          ])
            .option({ maxTimeMS: 10000 })
            .exec(),
          CompetitionInstantPrize.countDocuments({ competitionId: compId }).maxTimeMS(5000),
          Winner.find({ competitionId: compId })
            .populate("userId", "firstName lastName avatarUrl")
            .sort({ drawnAt: -1 })
            .lean(),
          Winner.aggregate([
            { $match: { competitionId: compId, deletedAt: null } },
            { $group: { _id: null, total: { $sum: "$prizeValue" } } },
          ])
            .option({ maxTimeMS: 5000 })
            .exec(),
          Competition.find({
            status: "active",
            _id: { $ne: compId },
          })
            .sort({ displayOrder: 1, drawDate: 1 })
            .limit(20)
            .select("slug title imageUrl prizeValue ticketPrice")
            .lean(),
          CompetitionInstantPrize.aggregate([
            { $match: { competitionId: compId, isArchived: { $ne: true } } },
            {
              $lookup: {
                from: PRIZE_COLLECTION,
                localField: "instantPrizeId",
                foreignField: "_id",
                as: "prize",
              },
            },
            { $unwind: { path: "$prize", preserveNullAndEmptyArrays: true } },
            { $match: { "prize.type": "competition_ticket" } },
            {
              $group: {
                _id: null,
                totalGranted: {
                  $sum: {
                    $multiply: [
                      { $size: { $ifNull: ["$winningEntryNumbers", []] } },
                      { $ifNull: ["$prize.ticketCount", 1] },
                    ],
                  },
                },
              },
            },
          ])
            .option({ maxTimeMS: 5000 })
            .exec(),
        ]);

      const { getCompetitionTicketStats } = await import("@oc/api-tickets/ticket-service");

      const [stats] = await Promise.all([
        getCompetitionTicketStats(compId.toString(), {
          status: compMeta.status,
          maxTickets: compMeta.maxTickets,
        }),
      ]);

      return success(c, {
        competition: enriched,
        instantPrizes: cipsPipeline,
        instantPrizesTotal: cipsTotal,
        winners,
        totalPrizeValue: winnerAgg[0]?.total || 0,
        totalGrantedTickets: grantedAgg[0]?.totalGranted || 0,
        otherCompetitions,
        stats,
      });
    } catch (err: unknown) {
      console.error("Error fetching landing page data:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "competitions.landingPage.get",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
