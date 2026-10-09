import { ComplianceAuditLog, ReferralPurchase, ReferralSettings } from "@oc/api-db/models";
import { modelAggregateAnalytics } from "@oc/api-infra/mongo-aggregate";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { substringRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import {
  buildColumnSearchQuery,
  parsePagination,
  parseSearch,
  parseSort,
} from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import {
  reconcileReferralCountOnDelete,
  reconcileReferralCountOnRestore,
} from "@oc/api-referrals/referral-counter";
import { requireManager } from "@oc/api-server/middleware/auth";
import { ADMIN_REFERRAL_PURCHASE_TABLE } from "@oc/types";
import { Hono } from "hono";
import type { PipelineStage } from "mongoose";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireManager);

type ReferralPurchaseGroupedRow = {
  _id: { referrerId: mongoose.Types.ObjectId; referredUserId: mongoose.Types.ObjectId };
  referrerEmail: string;
  referredEmail: string;
  purchaseCount: number;
  activePurchaseCount: number;
  purchasedAt: Date;
  createdAt: Date;
  latestDeletedAt: Date | null;
  orderIds: mongoose.Types.ObjectId[];
  referralPurchaseIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  commissionAmount: number;
  ticketsAwarded: number;
  signupReferrerId?: mongoose.Types.ObjectId;
};

function mapGroupedReferralRow(p: ReferralPurchaseGroupedRow) {
  return {
    _id: `${p._id.referrerId.toString()}:${p._id.referredUserId.toString()}`,
    referrerId: p._id.referrerId.toString(),
    referrerEmail: p.referrerEmail,
    referredUserId: p._id.referredUserId.toString(),
    referredEmail: p.referredEmail,
    orderIds: p.orderIds.map((id) => id.toString()),
    referralPurchaseIds:
      (p as ReferralPurchaseGroupedRow).referralPurchaseIds?.map((id) => id.toString()) ?? [],
    purchaseCount: p.purchaseCount,
    activePurchaseCount: p.activePurchaseCount ?? p.purchaseCount,
    latestDeletedAt: p.latestDeletedAt ? p.latestDeletedAt.toISOString() : null,
    purchasedAt: p.purchasedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    commissionAmount: p.commissionAmount,
    ticketsAwarded: p.ticketsAwarded,
    isActive: p.isActive,
    referrerReferralCode:
      ((p as Record<string, unknown>).referrerReferralCode as string | null) ?? null,
  };
}

function buildStatusFilterStages(status: string): mongoose.PipelineStage[] {
  if (status === "active") {
    return [{ $match: { isActive: true } }];
  }

  if (status === "inactive") {
    return [{ $match: { isActive: false } }];
  }

  return [];
}

function buildWindowEndExpr(
  mode: "rolling" | "fixed_day_of_month",
  windowDays: number,
  cutoffDay: number,
  grace: { enabled?: boolean; days?: number }
): Record<string, unknown> {
  let baseEnd: Record<string, unknown>;
  if (mode === "fixed_day_of_month") {
    baseEnd = {
      $dateFromParts: {
        year: {
          $cond: [
            { $eq: [{ $month: "$referredProfile.createdAt" }, 12] },
            { $add: [{ $year: "$referredProfile.createdAt" }, 1] },
            { $year: "$referredProfile.createdAt" },
          ],
        },
        month: {
          $cond: [
            { $eq: [{ $month: "$referredProfile.createdAt" }, 12] },
            1,
            { $add: [{ $month: "$referredProfile.createdAt" }, 1] },
          ],
        },
        day: cutoffDay,
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
      },
    };
  } else {
    baseEnd = {
      $dateAdd: {
        startDate: "$referredProfile.createdAt",
        unit: "day",
        amount: windowDays,
      },
    };
  }

  if (grace.enabled && (grace.days ?? 0) > 0) {
    return {
      $dateAdd: {
        startDate: baseEnd,
        unit: "day",
        amount: grace.days ?? 0,
      },
    };
  }

  return baseEnd;
}

app.get("/", async (c) => {
  try {
    const referredBy = c.req.query("referredBy");
    const status = c.req.query("status") || "all";
    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: [...ADMIN_REFERRAL_PURCHASE_TABLE.sortableFields],
      defaultSort: { isActive: -1, createdAt: -1 },
    });
    const { columnSearch, globalSearch } = parseSearch(c);

    const showDeleted = c.req.query("showDeleted") === "true";

    await dbConnect();

    const settings = await ReferralSettings.findById("referral_settings").lean();
    const minSpend = (settings?.minFirstOrderSpend as number) ?? 1;
    const activityWindowDays = (settings?.activityWindowDays as number) ?? 30;
    const activityWindowMode =
      (settings?.activityWindowMode as "rolling" | "fixed_day_of_month" | undefined) ?? "rolling";
    const monthlyCutoffDay = (settings?.monthlyCutoffDay as number) ?? 25;
    const graceData = (settings?.gracePeriod as
      | { enabled?: boolean; days?: number; countsToward?: string }
      | undefined) ?? { enabled: false, days: 0 };

    const matchStage: Record<string, unknown> = {};
    if (!showDeleted) {
      matchStage.deletedAt = null;
    }
    if (referredBy) {
      matchStage.referrerId = new mongoose.Types.ObjectId(referredBy);
    }

    buildColumnSearchQuery(
      columnSearch,
      ADMIN_REFERRAL_PURCHASE_TABLE.searchableFields,
      matchStage
    );

    if (globalSearch) {
      matchStage.$or = [
        { referrerEmail: { $regex: substringRegex(globalSearch), $options: "i" } },
        { referredEmail: { $regex: substringRegex(globalSearch), $options: "i" } },
      ];
    }

    // Compute isActive per row before grouping
    const computedActivePipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: "profiles",
          localField: "referredUserId",
          foreignField: "_id",
          as: "referredProfile",
        },
      },
      {
        $unwind: {
          path: "$referredProfile",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $set: {
          _windowEnd: buildWindowEndExpr(
            activityWindowMode,
            activityWindowDays,
            monthlyCutoffDay,
            graceData
          ),
        },
      },
      {
        $set: {
          isActive: {
            $and: [
              { $ne: ["$referredProfile", null] },
              { $ne: ["$referredProfile.createdAt", null] },
              { $lte: ["$purchasedAt", "$_windowEnd"] },
              { $gte: [{ $ifNull: ["$purchaseAmount", 0] }, minSpend] },
            ],
          },
        },
      },
      { $project: { _windowEnd: 0 } },
    ];

    const existingGroupStage: PipelineStage = {
      $group: {
        _id: { referrerId: "$referrerId", referredUserId: "$referredUserId" },
        referrerEmail: { $first: "$referrerEmail" },
        referredEmail: { $first: "$referredEmail" },
        signupReferrerId: { $first: "$signupReferrerId" },
        purchaseCount: { $sum: 1 },
        activePurchaseCount: {
          $sum: { $cond: [{ $eq: ["$deletedAt", null] }, 1, 0] },
        },
        purchasedAt: { $max: "$purchasedAt" },
        createdAt: { $min: "$createdAt" },
        latestDeletedAt: { $max: "$deletedAt" },
        orderIds: { $push: "$orderId" },
        referralPurchaseIds: { $push: "$_id" },
        isActive: { $max: "$isActive" },
        commissionAmount: { $sum: "$commissionAmount" },
        ticketsAwarded: { $sum: "$ticketsAwarded" },
      },
    };

    // Look up the referrer's Profile to get referralCount and signup referrer email
    // (must run BEFORE $sort so that sorting by referrerReferralCount works)
    const referrerLookupStage: PipelineStage = {
      $lookup: {
        from: "profiles",
        let: { referrerId: "$_id.referrerId", signupId: "$signupReferrerId" },
        pipeline: [
          { $match: { $expr: { $in: ["$_id", ["$$referrerId", "$$signupId"]] } } },
          { $project: { _id: 1, referralCount: 1, email: 1, referralCode: 1 } },
        ],
        as: "_referrerProfiles",
      },
    };
    const referrerProjectStage: PipelineStage = {
      $addFields: {
        _referrerProfile: {
          $first: {
            $filter: {
              input: "$_referrerProfiles",
              cond: { $eq: ["$$this._id", "$_id.referrerId"] },
            },
          },
        },
        _signupReferrerProfile: {
          $first: {
            $filter: {
              input: "$_referrerProfiles",
              cond: { $eq: ["$$this._id", "$signupReferrerId"] },
            },
          },
        },
      },
    };
    const referrerFlattenStage: PipelineStage = {
      $addFields: {
        referrerReferralCode: { $ifNull: ["$_referrerProfile.referralCode", null] },
        referrerReferralCount: { $ifNull: ["$_referrerProfile.referralCount", 0] },
        signupReferrerEmail: {
          $cond: [
            { $ifNull: ["$signupReferrerId", false] },
            { $ifNull: ["$_signupReferrerProfile.email", null] },
            null,
          ],
        },
      },
    };
    const referrerCleanupStage: PipelineStage = {
      $project: {
        _referrerProfile: 0,
        _signupReferrerProfile: 0,
        _referrerProfiles: 0,
      },
    };

    const referrerCountsGroupStage: PipelineStage = {
      $group: {
        _id: "$_id.referrerId",
        rows: { $push: "$$ROOT" },
        referrerActiveCount: {
          $sum: { $cond: [{ $ifNull: ["$isActive", false] }, 1, 0] },
        },
        referrerTotalCount: { $sum: 1 },
      },
    };

    const referrerCountsUnwindStage: PipelineStage = { $unwind: "$rows" };

    const referrerCountsReplaceStage: PipelineStage = {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            "$rows",
            {
              referrerActiveCount: "$referrerActiveCount",
              referrerInactiveCount: {
                $subtract: ["$referrerTotalCount", "$referrerActiveCount"],
              },
              referrerTotalCount: "$referrerTotalCount",
            },
          ],
        },
      },
    };

    const basePipeline: PipelineStage[] = [
      ...computedActivePipeline,
      ...buildStatusFilterStages(status),
      existingGroupStage,
      referrerCountsGroupStage,
      referrerCountsUnwindStage,
      referrerCountsReplaceStage,
      referrerLookupStage,
      referrerProjectStage,
      referrerFlattenStage,
      referrerCleanupStage,
    ];

    const baseCountPipeline: PipelineStage[] = [
      ...computedActivePipeline,
      ...buildStatusFilterStages(status),
    ];

    const summaryPipeline: PipelineStage[] = [
      ...computedActivePipeline,
      {
        $group: {
          _id: { referrerId: "$referrerId", referredUserId: "$referredUserId" },
          isActive: { $max: "$isActive" },
        },
      },
      {
        $facet: {
          active: [{ $match: { isActive: true } }, { $count: "count" }],
          inactive: [{ $match: { isActive: false } }, { $count: "count" }],
        },
      },
      {
        $project: {
          activeCount: { $ifNull: [{ $arrayElemAt: ["$active.count", 0] }, 0] },
          inactiveCount: { $ifNull: [{ $arrayElemAt: ["$inactive.count", 0] }, 0] },
        },
      },
    ];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      referrer: { groupKey: "$_id.referrerId", groupLabel: "$referrerEmail" },
      status: { groupKey: "$isActive", groupLabel: "$isActive" },
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

    const [dataResult, totalResult, summaryResult] = await Promise.all([
      modelAggregateAnalytics(ReferralPurchase, dataPipeline).exec(),
      modelAggregateAnalytics(ReferralPurchase, countPipeline).exec(),
      modelAggregateAnalytics(ReferralPurchase, summaryPipeline).exec(),
    ]);

    const total = totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    const summary = summaryResult[0] as { activeCount: number; inactiveCount: number } | undefined;
    const activeTotal = summary?.activeCount ?? 0;
    const inactiveTotal = summary?.inactiveCount ?? 0;

    let results: unknown[];
    if (isGrouped) {
      results = dataResult;
    } else {
      const rows = dataResult as Array<
        ReferralPurchaseGroupedRow & {
          referrerReferralCode?: string | null;
          referrerReferralCount?: number;
          signupReferrerEmail?: string | null;
          referrerActiveCount?: number;
          referrerInactiveCount?: number;
          referrerTotalCount?: number;
        }
      >;

      results = rows.map((row) => ({
        ...mapGroupedReferralRow(row),
        referrerReferralCode: row.referrerReferralCode ?? null,
        referrerReferralCount: row.referrerReferralCount ?? 0,
        signupReferrerEmail: row.signupReferrerEmail ?? null,
        referrerActiveCount: row.referrerActiveCount ?? 0,
        referrerInactiveCount: row.referrerInactiveCount ?? 0,
        referrerTotalCount: row.referrerTotalCount ?? 0,
      }));
    }

    return paginated(c, results, total, page, limit, {
      sortableFields,
      summary: { activeCount: activeTotal, inactiveCount: inactiveTotal, totalCount: total },
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.referralPurchases.list",
    });
    console.error("Error listing referral purchases:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/deleted", async (c) => {
  try {
    await dbConnect();
    const items = await ReferralPurchase.findDeleted().sort({ deletedAt: -1 }).limit(50).lean();
    return success(c, items);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.referralPurchases.listDeleted",
    });
    console.error("Error listing deleted referral purchases:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const referralPurchase = await ReferralPurchase.findById(id).lean();
    if (!referralPurchase) {
      return error(c, ErrorCodes.NOT_FOUND, "ReferralPurchase not found", 404);
    }

    return success(c, {
      _id: referralPurchase._id.toString(),
      referrerId: referralPurchase.referrerId.toString(),
      referrerEmail: referralPurchase.referrerEmail,
      referredUserId: referralPurchase.referredUserId.toString(),
      referredEmail: referralPurchase.referredEmail,
      orderId: referralPurchase.orderId.toString(),
      commissionAmount: referralPurchase.commissionAmount,
      ticketsAwarded: referralPurchase.ticketsAwarded ?? null,
      ticketsAwardedAt: referralPurchase.ticketsAwardedAt?.toISOString() ?? null,
      tierAtAward: referralPurchase.tierAtAward ?? null,
      purchasedAt: referralPurchase.purchasedAt?.toISOString() ?? null,
      signupReferrerId: referralPurchase.signupReferrerId?.toString() ?? null,
      createdAt: referralPurchase.createdAt.toISOString(),
      deletedAt: referralPurchase.deletedAt?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.referralPurchases.getOne",
    });
    console.error("Error fetching referral purchase:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const before = await ReferralPurchase.findById(id).lean();
    const referralPurchase = await ReferralPurchase.softDelete(id, c.get("userId") ?? undefined);
    if (!referralPurchase) {
      return error(c, ErrorCodes.NOT_FOUND, "ReferralPurchase not found", 404);
    }

    if (before && !before.deletedAt) {
      try {
        await reconcileReferralCountOnDelete(
          before.referrerId.toString(),
          before.referredUserId.toString()
        );
      } catch (counterErr) {
        console.error("Failed to reconcile referralCount after delete:", counterErr);
      }
    }

    await ComplianceAuditLog.create({
      actorId: c.get("userId"),
      targetUserId: before?.referrerId?.toString() ?? "unknown",
      action: "referral_purchase_delete",
      reason: "Admin deleted referral purchase",
      before: {
        referrerId: before?.referrerId?.toString(),
        referredUserId: before?.referredUserId?.toString(),
        orderId: before?.orderId?.toString(),
        purchaseAmount: before?.purchaseAmount,
        ticketsAwarded: before?.ticketsAwarded,
      },
      after: { deletedAt: new Date().toISOString() },
      source: "admin",
    }).catch((err) =>
      console.error("Failed to write audit log for referral purchase delete:", err)
    );

    return success(c, { success: true });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.referralPurchases.delete",
    });
    console.error("Error deleting referral purchase:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const before = await ReferralPurchase.findById(id).lean();
    const restored = await ReferralPurchase.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "ReferralPurchase not found", 404);
    }
    if (before?.deletedAt) {
      try {
        await reconcileReferralCountOnRestore(
          before.referrerId.toString(),
          before.referredUserId.toString()
        );
      } catch (counterErr) {
        console.error("Failed to reconcile referralCount after restore:", counterErr);
      }
    }

    await ComplianceAuditLog.create({
      actorId: c.get("userId"),
      targetUserId: before?.referrerId?.toString() ?? "unknown",
      action: "referral_purchase_restore",
      reason: "Admin restored referral purchase",
      before: { deletedAt: before?.deletedAt?.toISOString() ?? null },
      after: {
        referrerId: before?.referrerId?.toString(),
        referredUserId: before?.referredUserId?.toString(),
        orderId: before?.orderId?.toString(),
        purchaseAmount: before?.purchaseAmount,
        ticketsAwarded: before?.ticketsAwarded,
        restoredAt: new Date().toISOString(),
      },
      source: "admin",
    }).catch((err) =>
      console.error("Failed to write audit log for referral purchase restore:", err)
    );

    return success(c, { restored: true });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.referralPurchases.restore",
    });
    console.error("Error restoring referral purchase:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
