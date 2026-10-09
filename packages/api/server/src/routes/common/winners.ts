import { Profile, Winner } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { publicFeedRateLimit } from "@oc/api-server/middleware/rate-limit";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", publicFeedRateLimit());

function formatPublicWinnerDisplayName(input: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  showLastName?: boolean | null;
}): string {
  if (input.displayName?.trim()) return input.displayName.trim();
  const firstName = input.firstName?.trim() || "Winner";
  const lastName = input.lastName?.trim();
  const showLastName = input.showLastName ?? true;
  if (showLastName && lastName) return `${firstName} ${lastName}`;
  if (lastName) return `${firstName} ${lastName[0]}.`;
  return firstName;
}

function resolveCompetitionImageUrl(competition: {
  imageUrl?: string | null;
  prizeImageUrl?: string | null;
} | null): string | null {
  if (!competition) return null;
  if (competition.prizeImageUrl && competition.prizeImageUrl.length > 0) {
    return competition.prizeImageUrl;
  }
  return competition.imageUrl ?? null;
}

function mapPublicWinner(
  winner: {
    _id?: mongoose.Types.ObjectId;
    displayName?: string | null;
    prizeTitle?: string | null;
    prizeValue?: number | null;
    prizeImageUrl?: string | null;
    winnerPhotoUrl?: string | null;
    location?: string | null;
    testimonial?: string | null;
    ticketNumber: number;
    drawnAt: Date;
  },
  competition: {
    title?: string;
    slug?: string;
    imageUrl?: string | null;
    prizeImageUrl?: string | null;
  } | null,
  displayName: string,
  avatarUrl?: string | null,
  competitionId?: string | null
) {
  const competitionImageUrl = resolveCompetitionImageUrl(competition);
  const prizeImageUrl = winner.prizeImageUrl?.trim() || competitionImageUrl || null;
  return {
    _id: winner._id?.toString(),
    competitionId: competitionId ?? undefined,
    displayName,
    prizeTitle: winner.prizeTitle ?? null,
    prizeValue: winner.prizeValue ?? null,
    prizeImageUrl,
    winnerPhotoUrl: winner.winnerPhotoUrl?.trim() || null,
    avatarUrl: avatarUrl?.trim() || null,
    location: winner.location ?? null,
    testimonial: winner.testimonial ?? null,
    ticketNumber: winner.ticketNumber,
    drawnAt: winner.drawnAt,
    competition: competition
      ? {
          title: competition.title ?? "",
          slug: competition.slug ?? "",
          imageUrl: competitionImageUrl,
          prizeImageUrl: competitionImageUrl,
        }
      : null,
  };
}

app.get(
  "/",
  redisCacheRoute({
    route: "winners:list",
    scope: "public",
    ttlSeconds: 60,
  }),
  async (c) => {
    try {
      const { limit, page, skip } = parsePagination(c);
      await dbConnect();

      const [winners, total] = await Promise.all([
        Winner.find()
          .populate("competitionId", "title imageUrl prizeImageUrl slug")
          .sort({ drawnAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Winner.countDocuments().maxTimeMS(5000),
      ]);

      const userIds = winners
        .map((w) => w.userId)
        .filter(Boolean)
        .filter((id): id is NonNullable<typeof id> => !!id);
      const profiles =
        userIds.length > 0
          ? await Profile.find({ _id: { $in: userIds } })
              .select("firstName lastName showLastName avatarUrl")
              .lean()
          : [];
      const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));

      for (const winner of winners) {
        if (!winner.displayName && winner.userId) {
          const profile = profileMap.get(winner.userId.toString());
          winner.displayName = formatPublicWinnerDisplayName({
            displayName: winner.displayName,
            firstName: profile?.firstName,
            lastName: profile?.lastName,
            showLastName: profile?.showLastName,
          });
        }
      }

      const publicWinners = winners.map((w) => {
        const comp = w.competitionId as
          | {
              title?: string;
              slug?: string;
              imageUrl?: string | null;
              prizeImageUrl?: string | null;
            }
          | null
          | undefined;
        const compObj = comp && typeof comp === "object" ? comp : null;
        const name =
          w.displayName?.trim() ||
          formatPublicWinnerDisplayName({ displayName: w.displayName });
        const profile = w.userId ? profileMap.get(w.userId.toString()) : undefined;
        const competitionId =
          compObj && "_id" in compObj && compObj._id
            ? String(compObj._id)
            : w.competitionId
              ? String(w.competitionId)
              : null;
        return mapPublicWinner(
          w,
          compObj,
          name,
          profile?.avatarUrl ?? null,
          competitionId
        );
      });

      return paginated(c, publicWinners, total, page, limit);
    } catch (err: unknown) {
      console.error("Error fetching winners:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "winners.list",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/competition/:competitionId",
  redisCacheRoute({
    route: "winners:by-competition",
    scope: "public",
    ttlSeconds: 60,
    resourceIdResolver: (c) => c.req.param("competitionId"),
  }),
  async (c) => {
    try {
      const competitionId = c.req.param("competitionId");
      if (!mongoose.Types.ObjectId.isValid(competitionId)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid competition id", 400);
      }
      await dbConnect();

      const winners = await Winner.find({ competitionId })
        .select("displayName prizeTitle prizeValue drawnAt ticketNumber showFullName")
        .sort({ drawnAt: -1 })
        .limit(100)
        .lean();

      const publicWinners = winners.map((w) =>
        mapPublicWinner(
          w,
          null,
          w.displayName?.trim() ||
            formatPublicWinnerDisplayName({ displayName: w.displayName }),
          null,
          null
        )
      );

      return success(c, publicWinners);
    } catch (err: unknown) {
      console.error("Error fetching competition winners:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "winners.byCompetition",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/stats",
  redisCacheRoute({
    route: "winners:stats",
    scope: "public",
    ttlSeconds: 60,
  }),
  async (c) => {
    try {
      await dbConnect();

      const winnersCount = await Winner.countDocuments().maxTimeMS(5000);
      const prizeAgg = await Winner.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: null, total: { $sum: "$prizeValue" } } },
      ]).exec();

      return success(c, {
        totalWinners: winnersCount,
        totalPrizeValue: prizeAgg[0]?.total || 0,
        totalWinnersAllTime: winnersCount,
      });
    } catch (err: unknown) {
      console.error("Error fetching winner stats:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "winners.stats",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
