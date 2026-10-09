import { Competition, Order, Profile, Winner } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import { getGlobalScopedTicketStatusTotals } from "@oc/api-tickets/scoped-ticket-stats";
import { Hono } from "hono";

const app = new Hono();

const ORDER_SORTABLE = ["createdAt", "total", "status", "email"] as const;
const WINNER_SORTABLE = ["drawnAt", "prizeValue", "competitionTitle", "email"] as const;

let dashboardCache: {
  data: Record<string, unknown>;
  expiresAt: number;
} | null = null;
const CACHE_TTL_MS = 60_000;

app.use("*", requireManager);

app.get("/stats", async (c) => {
  try {
    const sortField = c.req.query("sortField");
    const sortDir = c.req.query("sortDir") === "asc" ? 1 : -1;
    const hasSort = !!sortField;

    const cacheNow = Date.now();
    if (!hasSort && dashboardCache && dashboardCache.expiresAt > cacheNow) {
      return success(c, dashboardCache.data);
    }

    await dbConnect();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const orderSort: Record<string, 1 | -1> = {};
    const winnerSort: Record<string, 1 | -1> = {};
    if (sortField) {
      const orderSortFields: Record<string, string> = {
        createdAt: "createdAt",
        total: "total",
        status: "status",
        email: "email",
      };
      const winnerSortFields: Record<string, string> = {
        drawnAt: "drawnAt",
        prizeValue: "prizeValue",
        competitionTitle: "competitionTitle",
        email: "email",
      };
      const orderField = orderSortFields[sortField];
      const winnerField = winnerSortFields[sortField];
      if (orderField) orderSort[orderField] = sortDir;
      if (winnerField) winnerSort[winnerField] = sortDir;
    } else {
      orderSort.createdAt = -1;
      winnerSort.drawnAt = -1;
    }

    const [
      totalUsers,
      activeCompetitions,
      totalCompetitions,
      totalOrders,
      ticketTotals,
      last30DaysRevenueResult,
      monthlyRevenueResult,
      newUsersThisMonthResult,
      totalPrizeValueResult,
      recentOrdersResult,
      recentWinnersResult,
    ] = await Promise.all([
      Profile.countDocuments({
        isGuestCheckout: { $ne: true },
        email: { $not: { $regex: /@guest\.onlinecompetitions\.local$/i } },
      }).maxTimeMS(5000),
      Competition.countDocuments({ status: "active" }).maxTimeMS(5000),
      Competition.countDocuments().maxTimeMS(5000),
      Order.countDocuments().maxTimeMS(5000),
      getGlobalScopedTicketStatusTotals({ activeCompetitionsOnly: true }),
      Order.aggregate([
        { $match: { status: "completed", paidAt: { $gte: thirtyDaysAgo }, deletedAt: null } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.aggregate([
        { $match: { status: "completed", paidAt: { $gte: startOfMonth }, deletedAt: null } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Profile.countDocuments({
        createdAt: { $gte: startOfMonth },
        isGuestCheckout: { $ne: true },
        email: { $not: { $regex: /@guest\.onlinecompetitions\.local$/i } },
      }).maxTimeMS(5000),
      Competition.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: null, total: { $sum: "$prizeValue" } } },
      ]),
      Order.aggregate([
        { $match: { status: "completed", deletedAt: null } },
        { $sort: orderSort },
        { $limit: 5 },
        {
          $lookup: {
            from: "profiles",
            localField: "userId",
            foreignField: "_id",
            as: "profile",
          },
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            orderNumber: 1,
            total: 1,
            status: 1,
            createdAt: 1,
            email: "$profile.email",
          },
        },
      ]),
      Winner.aggregate([
        { $match: { deletedAt: null } },
        { $sort: winnerSort },
        { $limit: 5 },
        {
          $lookup: {
            from: "competitions",
            localField: "competitionId",
            foreignField: "_id",
            as: "competition",
          },
        },
        { $unwind: { path: "$competition", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "profiles",
            localField: "userId",
            foreignField: "_id",
            as: "profile",
          },
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            "profile.isGuestCheckout": { $ne: true },
            "profile.email": { $not: { $regex: /@guest\.onlinecompetitions\.local$/i } },
          },
        },
        {
          $project: {
            displayName: 1,
            prizeValue: 1,
            drawnAt: 1,
            competitionTitle: "$competition.title",
            email: "$profile.email",
          },
        },
      ]),
    ]);

    const ticketsSold = ticketTotals.sold;
    const ticketsHeld = ticketTotals.held;
    const last30DaysRevenue = (last30DaysRevenueResult[0]?.total as number) ?? 0;
    const monthlyRevenue = (monthlyRevenueResult[0]?.total as number) ?? 0;
    const totalPrizeValue = (totalPrizeValueResult[0]?.total as number) ?? 0;

    const recentOrders = recentOrdersResult.map(
      (o: {
        orderNumber: number;
        total: number;
        status: string;
        createdAt: Date;
        email?: string;
      }) => ({
        orderNumber: o.orderNumber,
        email: o.email ?? "",
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
      })
    );

    const recentWinners = recentWinnersResult.map(
      (w: {
        competitionTitle?: string;
        email?: string;
        displayName?: string;
        prizeValue?: number;
        drawnAt: Date;
      }) => ({
        competitionTitle: w.competitionTitle ?? "",
        email: w.email ?? "",
        displayName: w.displayName ?? "",
        prizeValue: w.prizeValue ?? 0,
        drawnAt: w.drawnAt,
      })
    );

    const payload = {
      totalRevenue: last30DaysRevenue,
      totalUsers,
      activeCompetitions,
      totalCompetitions,
      totalOrders,
      ticketsSold,
      ticketsHeld,
      monthlyRevenue,
      newUsersThisMonth: newUsersThisMonthResult as number,
      totalPrizeValue,
      recentOrders,
      recentWinners,
      _sortableFields: { recentOrders: ORDER_SORTABLE, recentWinners: WINNER_SORTABLE },
    };

    dashboardCache = { data: payload, expiresAt: cacheNow + CACHE_TTL_MS };

    return success(c, payload);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.dashboard.stats",
    });
    console.error("Error fetching dashboard stats:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
