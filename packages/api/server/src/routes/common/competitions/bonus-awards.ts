import { BonusAwardWin, CompetitionBonusAwardAssignment, Profile } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import type { PublicBonusAwardEntry, PublicBonusAwardWinDTO } from "@oc/types";
import { Hono } from "hono";
import { Types } from "mongoose";

const app = new Hono();

app.get(
  "/",
  redisCacheRoute({
    route: "competition:bonus-awards",
    scope: "public",
    ttlSeconds: 60,
    resourceIdResolver: (c) => c.req.param("id"),
  }),
  async (c) => {
    try {
      const competitionId = c.req.param("id");
      if (!competitionId || !Types.ObjectId.isValid(competitionId)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid competition ID", 400);
      }

      await dbConnect();

      const assignments = await CompetitionBonusAwardAssignment.find({
        competitionId: new Types.ObjectId(competitionId),
        isArchived: false,
      })
        .populate("bonusAwardId")
        .sort({ milestonePct: 1 })
        .lean();

      const results: PublicBonusAwardEntry[] = assignments.map((a) => {
        const ba = a.bonusAwardId as unknown as {
          _id: Types.ObjectId;
          title: string;
          description?: string;
          value?: number;
          images: string[];
          type: "prize" | "competition_ticket";
          ticketCount?: number;
        };
        return {
          assignment: {
            _id: a._id.toString(),
            milestonePct: a.milestonePct,
            thresholdNumber: a.thresholdNumber,
            quantity: a.quantity,
            wonCount: a.wonCount,
            firedAt: a.firedAt?.toISOString(),
          },
          bonusAward: {
            _id: ba._id.toString(),
            title: ba.title,
            description: ba.description,
            value: ba.value,
            images: ba.images ?? [],
            type: ba.type ?? "prize",
            ticketCount: ba.ticketCount,
          },
        };
      });

      return success(c, results);
    } catch (err: unknown) {
      console.error("Error fetching bonus awards:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "competitions.bonusAwards.list",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/wins",
  redisCacheRoute({
    route: "competition:bonus-award-wins",
    scope: "public",
    ttlSeconds: 60,
    resourceIdResolver: (c) => c.req.param("id"),
  }),
  async (c) => {
    try {
      const competitionId = c.req.param("id");
      if (!competitionId || !Types.ObjectId.isValid(competitionId)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid competition ID", 400);
      }

      await dbConnect();

      const compId = new Types.ObjectId(competitionId);

      const wins = await BonusAwardWin.aggregate([
        { $match: { competitionId: compId, deletedAt: null } },
        {
          $lookup: {
            from: CompetitionBonusAwardAssignment.collection.name,
            localField: "assignmentId",
            foreignField: "_id",
            as: "_assignment",
          },
        },
        { $unwind: { path: "$_assignment", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: Profile.collection.name,
            localField: "userId",
            foreignField: "_id",
            as: "_profile",
          },
        },
        { $unwind: { path: "$_profile", preserveNullAndEmptyArrays: true } },
        { $sort: { wonAt: -1 } },
        { $limit: 50 },
      ]).exec();

      const result: PublicBonusAwardWinDTO[] = wins.map((w: any) => ({
        id: w._id.toString(),
        competitionId,
        ticketNumber: w.ticketNumber,
        milestonePct: w._assignment?.milestonePct ?? 0,
        displayName: w._profile
          ? [w._profile.firstName, w._profile.lastName].filter(Boolean).join(" ") || undefined
          : undefined,
        wonAt: w.wonAt.toISOString(),
        prizeTitle: w.prizeTitle,
        prizeValue: w.prizeValue,
        prizeImage: w.prizeImage ?? undefined,
        claimed: w.claimed ?? false,
      }));

      return success(c, result);
    } catch (err: unknown) {
      console.error("Error fetching bonus award wins:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "competitions.bonusAwards.wins",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export const competitionsBonusAwardsPublic = app;
