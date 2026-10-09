import { Category, Competition, type ICompetition } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { onCompetitionUpdate } from "@oc/api-server/lib/utils/competition-events";
import { resolveSession } from "@oc/api-server/middleware/auth";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import {
  enrichCompetitionsWithTicketStats,
  enrichCompetitionWithTicketStats,
} from "@oc/api-tickets/competition-stats";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import mongoose from "mongoose";
import { competitionsBonusAwardsPublic } from "./competitions/bonus-awards";

const log = createLogger("competitions");
const app = new Hono();
const MAX_AVAILABILITY_IDS = 100;

app.get(
  "/",
  redisCacheRoute({
    route: "competitions:list",
    scope: "public",
    ttlSeconds: 15,
  }),
  async (c) => {
    try {
      log.debug("listing competitions");
      const { limit, page, skip } = parsePagination(c);
      await dbConnect();

      const query: Record<string, unknown> = {};
      query.status = "active";
      query.drawDate = { $gte: new Date() };

      const category = c.req.query("category");
      if (category) query.category = category;

      const exclude = c.req.query("exclude");
      if (exclude) query._id = { $ne: exclude };

      const [competitions, total] = await Promise.all([
        Competition.find(query)
          .sort({ displayOrder: 1, drawDate: 1 })
          .skip(skip)
          .limit(limit)
          .select(
            "_id slug title ticketPrice prizeValue prizeImageUrl imageUrl status category drawDate displayOrder isFeatured isCashOnly heroImageUrl heroDisplayOrder isHeroFeatured maxTickets maxTicketsPerUser ticketsSold ticketsHeld question questionOptions startDate endDate originalPrice currency"
          )
          .lean(),
        Competition.countDocuments(query).maxTimeMS(5000),
      ]);

      const enriched = await enrichCompetitionsWithTicketStats(competitions);

      c.res.headers.set(
        "Cache-Control",
        "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
      );
      return paginated(c, enriched, total, page, limit);
    } catch (err: unknown) {
      log.error("Error fetching competitions:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/featured",
  redisCacheRoute({
    route: "competitions:featured",
    scope: "public",
    ttlSeconds: 15,
  }),
  async (c) => {
    try {
      log.debug("fetching featured competitions");
      await dbConnect();

      const competitions = await Competition.find({
        status: "active",
        isFeatured: true,
        drawDate: { $gte: new Date() },
      })
        .sort({ displayOrder: 1, drawDate: 1 })
        .limit(6)
        .select(
          "_id slug title ticketPrice prizeValue prizeImageUrl imageUrl status category drawDate displayOrder isFeatured isCashOnly heroImageUrl heroDisplayOrder isHeroFeatured maxTickets maxTicketsPerUser ticketsSold ticketsHeld questionOptions startDate endDate originalPrice currency"
        )
        .lean();

      const enriched = await enrichCompetitionsWithTicketStats(competitions);

      c.res.headers.set(
        "Cache-Control",
        "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
      );
      return success(c, enriched);
    } catch (err: unknown) {
      log.error("Error fetching featured competitions:", err);
      captureRouteError(err, { path: c.req.path, userId: c.get("userId") ?? null });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/categories",
  redisCacheRoute({
    route: "competitions:categories",
    scope: "public",
    ttlSeconds: 300,
  }),
  async (c) => {
    try {
      log.debug("fetching competition categories");
      await dbConnect();

      const categorySlugs = (
        await Competition.distinct("category", {
          status: "active",
        })
      ).filter(Boolean);

      const categories = await Category.find({
        slug: { $in: categorySlugs },
        isActive: true,
      })
        .sort({ displayOrder: 1 })
        .select("slug name label iconName description displayOrder")
        .lean();

      c.res.headers.set(
        "Cache-Control",
        "public, max-age=300, s-maxage=600, stale-while-revalidate=3600"
      );
      return success(c, categories);
    } catch (err: unknown) {
      log.error("Error fetching categories:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/availability",
  redisCacheRoute({
    route: "competitions:availability-batch",
    scope: "public",
    ttlSeconds: 5,
  }),
  async (c) => {
    try {
      log.debug("fetching batched availability");
      const idsParam = c.req.query("ids");
      if (!idsParam?.trim()) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "ids query parameter is required", 400);
      }

      const ids = idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (ids.length === 0) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "ids query parameter is required", 400);
      }
      if (ids.length > MAX_AVAILABILITY_IDS) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `ids query parameter accepts up to ${MAX_AVAILABILITY_IDS} ids`,
          400
        );
      }

      await dbConnect();

      const objectIds = [...new Set(ids)].filter(
        (id) => mongoose.Types.ObjectId.isValid(id) && id.length === 24
      );
      const competitions = await Competition.find({ _id: { $in: objectIds } })
        .select("maxTickets maxTicketsPerUser status")
        .lean();

      const { getCompetitionTicketStatsBatch } = await import("@oc/api-tickets/ticket-service");
      const statsMap = await getCompetitionTicketStatsBatch(
        competitions.map((competition) => ({
          id: competition._id.toString(),
          maxTickets: competition.maxTickets,
          status: competition.status,
        }))
      );

      const availability: Record<
        string,
        {
          available: number;
          total: number;
          sold: number;
          held: number;
          taken: number;
          percentageSold: number;
          percentageTaken: number;
          maxPerUser: number;
          isActive: boolean;
        }
      > = {};

      for (const competition of competitions) {
        const id = competition._id.toString();
        const stats = statsMap.get(id);
        if (!stats) continue;

        availability[id] = {
          available: stats.available,
          total: competition.maxTickets,
          sold: stats.sold,
          held: stats.held,
          taken: stats.taken,
          percentageSold: stats.percentageSold,
          percentageTaken: stats.percentageTaken,
          maxPerUser: competition.maxTicketsPerUser,
          isActive: stats.isActive,
        };
      }

      return success(c, availability);
    } catch (err: unknown) {
      log.error("Error fetching batched availability:", err);
      captureRouteError(err, { path: c.req.path, userId: c.get("userId") ?? null });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/buying-power-batch",
  redisCacheRoute({
    route: "competitions:buying-power-batch",
    scope: "user",
    ttlSeconds: 15,
  }),
  async (c) => {
    try {
      log.debug("fetching buying power batch");
      const idsParam = c.req.query("ids");
      if (!idsParam) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "ids query parameter is required", 400);
      }

      const rawIds = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (rawIds.length === 0 || rawIds.length > MAX_AVAILABILITY_IDS) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `ids must contain 1-${MAX_AVAILABILITY_IDS} comma-separated ObjectIds`,
          400
        );
      }

      await dbConnect();

      const { getCompetitionTicketStats, countOwnedByUser, getCartQtyForUser } = await import(
        "@oc/api-tickets/ticket-service"
      );

      let userId: string | null = null;
      try {
        await resolveSession(c);
        userId = c.get("userId");
      } catch {
        // Session is optional on this public endpoint.
      }

      const competitions = await Competition.find({ _id: { $in: rawIds } })
        .select("_id maxTickets maxTicketsPerUser status")
        .lean();

      const competitionMap = new Map(competitions.map((comp) => [comp._id.toString(), comp]));

      const { Profile } = await import("@oc/api-db/models");
      let walletBalance = 0;
      if (userId) {
        const profile = await Profile.findById(userId).select("referralTierAwardedTickets").lean();
        walletBalance = profile?.referralTierAwardedTickets ?? 0;
      }

      const result: Record<
        string,
        {
          competitionId: string;
          available: number;
          maxPerUser: number;
          userOwned: number;
          inCart: number;
          remainingForUser: number;
          maxPurchasable: number;
          walletSpendable: number;
          isActive: boolean;
        }
      > = {};

      await Promise.all(
        rawIds.map(async (id) => {
          const comp = competitionMap.get(id);
          if (!comp) return;

          const stats = await getCompetitionTicketStats(id, {
            status: comp.status,
            maxTickets: comp.maxTickets,
          });

          const userOwned = userId ? await countOwnedByUser(id, userId) : 0;
          const inCart = userId ? await getCartQtyForUser(id, userId) : 0;
          const remainingForUser =
            comp.maxTicketsPerUser > 0
              ? Math.max(0, comp.maxTicketsPerUser - userOwned - inCart)
              : stats.available;
          const maxPurchasable = Math.min(stats.available, remainingForUser);
          const walletSpendable =
            userId && remainingForUser > 0 ? Math.min(walletBalance, remainingForUser) : 0;

          result[id] = {
            competitionId: id,
            available: stats.available,
            maxPerUser: comp.maxTicketsPerUser,
            userOwned,
            inCart,
            remainingForUser,
            maxPurchasable,
            walletSpendable,
            isActive: stats.isActive,
          };
        })
      );

      return success(c, result);
    } catch (err: unknown) {
      log.error("Error fetching buying power batch:", err);
      captureRouteError(err, { path: c.req.path, userId: c.get("userId") ?? null });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get("/stream", async (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = onCompetitionUpdate((data) => {
      stream
        .writeSSE({
          data: JSON.stringify(data),
          event: "competition-update",
        })
        .catch(() => {});
    });
    stream.onAbort(() => {
      unsubscribe();
    });
    while (!stream.closed) {
      // SSE comment heartbeat keeps intermediaries (e.g. the Coolify/Nginx
      // proxy) from closing the connection on read timeout when no
      // competition update fires within the idle window.
      await stream.write(": keep-alive\n\n").catch(() => {});
      await stream.sleep(5000);
    }
  });
});

app.get(
  "/:slug",
  redisCacheRoute({
    route: "competition:detail",
    scope: "public",
    ttlSeconds: 15,
    resourceIdResolver: (c) => c.req.param("slug"),
  }),
  async (c) => {
    try {
      log.debug("fetching competition by slug:", c.req.param("slug"));
      const param = c.req.param("slug");
      await dbConnect();

      let competition: Awaited<ReturnType<typeof Competition.findById>> | null = null;
      if (mongoose.Types.ObjectId.isValid(param) && param.length === 24) {
        competition = await Competition.findOne({
          _id: param,
          status: "active",
          drawDate: { $gte: new Date() },
        }).lean();
      } else {
        competition = await Competition.findOne({
          slug: param,
          status: "active",
          drawDate: { $gte: new Date() },
        }).lean();
      }

      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      const typedCompetition = competition as ICompetition & { _id: mongoose.Types.ObjectId };
      if (typedCompetition.prizeImages?.length) {
        const headCheck = async (url: string): Promise<boolean> => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(url, { method: "HEAD", signal: controller.signal });
            clearTimeout(timer);
            return res.status !== 404;
          } catch (err) {
            log.error(`[competition:detail] HEAD check failed for ${url}:`, err);
            return true;
          }
        };
        const checks = await Promise.all(
          typedCompetition.prizeImages.map((u: string) =>
            headCheck(u).then((ok) => ({ url: u, ok }))
          )
        );
        typedCompetition.prizeImages = checks.filter((c) => c.ok).map((c) => c.url);
      }

      c.res.headers.set(
        "Cache-Control",
        "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
      );
      return success(c, await enrichCompetitionWithTicketStats(typedCompetition));
    } catch (err: unknown) {
      log.error("Error fetching competition:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/:id/availability",
  redisCacheRoute({
    route: "competition:availability",
    scope: "user",
    ttlSeconds: 5,
    resourceIdResolver: (c) => c.req.param("id"),
  }),
  async (c) => {
    try {
      log.debug("fetching availability for:", c.req.param("id"));
      const id = c.req.param("id");
      await dbConnect();

      const competition = await Competition.findById(id)
        .select("maxTickets maxTicketsPerUser status")
        .lean();

      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      const { getCompetitionTicketStats, countOwnedByUser, getCartQtyForUser } = await import(
        "@oc/api-tickets/ticket-service"
      );
      const stats = await getCompetitionTicketStats(id, {
        status: competition.status,
        maxTickets: competition.maxTickets,
      });

      let userId: string | null = null;
      try {
        await resolveSession(c);
        userId = c.get("userId");
      } catch {
        // Session is optional on this public endpoint.
      }

      const response: {
        available: number;
        total: number;
        sold: number;
        held: number;
        taken: number;
        percentageSold: number;
        percentageTaken: number;
        maxPerUser: number;
        isActive: boolean;
        userOwned?: number;
        inCart?: number;
        remainingForUser?: number;
        maxPurchasable?: number;
      } = {
        available: stats.available,
        total: competition.maxTickets,
        sold: stats.sold,
        held: stats.held,
        taken: stats.taken,
        percentageSold: stats.percentageSold,
        percentageTaken: stats.percentageTaken,
        maxPerUser: competition.maxTicketsPerUser,
        isActive: stats.isActive,
      };

      if (userId) {
        const userOwned = await countOwnedByUser(id, userId);
        const inCart = await getCartQtyForUser(id, userId);
        response.userOwned = userOwned;
        response.inCart = inCart;
        if (competition.maxTicketsPerUser > 0) {
          const remaining = Math.max(0, competition.maxTicketsPerUser - userOwned - inCart);
          response.remainingForUser = remaining;
          response.maxPurchasable = Math.min(stats.available, remaining);
        } else {
          response.maxPurchasable = stats.available;
        }
      }

      return success(c, response);
    } catch (err: unknown) {
      log.error("Error fetching availability:", err);
      captureRouteError(err, { path: c.req.path, userId: c.get("userId") ?? null });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/:id/buying-power",
  redisCacheRoute({
    route: "competition:buying-power",
    scope: "user",
    ttlSeconds: 15,
    resourceIdResolver: (c) => c.req.param("id"),
  }),
  async (c) => {
    try {
      log.debug("fetching buying power for:", c.req.param("id"));
      const id = c.req.param("id");
      await dbConnect();

      const competition = await Competition.findById(id)
        .select("maxTickets maxTicketsPerUser status")
        .lean();
      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      const { getCompetitionTicketStats, countOwnedByUser, getCartQtyForUser } = await import(
        "@oc/api-tickets/ticket-service"
      );
      const stats = await getCompetitionTicketStats(id, {
        status: competition.status,
        maxTickets: competition.maxTickets,
      });

      let userId: string | null = null;
      try {
        await resolveSession(c);
        userId = c.get("userId");
      } catch {
        // Session is optional on this public endpoint.
      }

      const userOwned = userId ? await countOwnedByUser(id, userId) : 0;
      const inCart = userId ? await getCartQtyForUser(id, userId) : 0;
      const remainingForUser =
        competition.maxTicketsPerUser > 0
          ? Math.max(0, competition.maxTicketsPerUser - userOwned - inCart)
          : stats.available;
      const maxPurchasable = Math.min(stats.available, remainingForUser);

      let walletSpendable = 0;
      if (userId && remainingForUser > 0) {
        const { Profile } = await import("@oc/api-db/models");
        const profile = await Profile.findById(userId).lean();
        const walletBalance = profile?.referralTierAwardedTickets ?? 0;
        walletSpendable = Math.min(walletBalance, remainingForUser);
      }

      return success(c, {
        competitionId: id,
        available: stats.available,
        maxPerUser: competition.maxTicketsPerUser,
        userOwned,
        inCart,
        remainingForUser,
        maxPurchasable,
        walletSpendable,
        isActive: stats.isActive,
      });
    } catch (err: unknown) {
      log.error("Error fetching buying power:", err);
      captureRouteError(err, { path: c.req.path, userId: c.get("userId") ?? null });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.route("/:id/bonus-awards", competitionsBonusAwardsPublic);

export default app;
