import { Profile, Winner } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { defaultCountMaxTimeMS } from "@oc/api-infra/mongo-query-options";
import { success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { getGlobalScopedTicketStatusTotals } from "@oc/api-tickets/scoped-ticket-stats";
import { Hono } from "hono";

const app = new Hono();

app.get(
  "/",
  redisCacheRoute({
    route: "stats",
    scope: "public",
    ttlSeconds: 60,
  }),
  async (c) => {
    try {
      await dbConnect();

      const [prizeValueResult, usersResult, ticketTotals] = await Promise.all([
        Winner.aggregate([
          { $match: { deletedAt: null } },
          { $group: { _id: null, total: { $sum: "$prizeValue" } } },
        ]),
        Profile.countDocuments({
          isGuestCheckout: { $ne: true },
          email: { $not: { $regex: /@guest\.onlinecompetitions\.local$/i } },
        }).maxTimeMS(defaultCountMaxTimeMS()),
        getGlobalScopedTicketStatusTotals(),
      ]);

      const totalEntries = ticketTotals.sold;
      const totalHeldEntries = ticketTotals.held;

      const result = {
        totalPrizeValue: prizeValueResult[0]?.total || 0,
        totalUsers: usersResult,
        totalEntries,
        totalHeldEntries,
        totalTakenEntries: totalEntries + totalHeldEntries,
      };

      return success(c, result);
    } catch (err: unknown) {
      console.error("[/api/stats] Error:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "stats.fetch",
      });
      return success(c, {
        competitors: 0,
        activeCompetitions: 0,
        totalEntries: 0,
        totalHeldEntries: 0,
        totalTakenEntries: 0,
      });
    }
  }
);

export default app;
