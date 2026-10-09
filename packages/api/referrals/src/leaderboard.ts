import { ReferralPurchase, ReferralSettings } from "@oc/api-db/models";
import type { PipelineStage } from "mongoose";
import mongoose from "mongoose";

export interface LeaderboardEntry {
  rank: number;
  referrerId: string;
  name: string;
  email: string;
  count: number;
  ticketsAwarded: number;
}

export interface LeaderboardOptions {
  limit?: number;
  includeDeleted?: boolean;
  settings?: {
    activityWindowDays?: number;
    minFirstOrderSpend?: number;
  };
}

const DEFAULT_LIMIT = 10;
const DEFAULT_ACTIVITY_WINDOW_DAYS = 30;
const DEFAULT_MIN_SPEND = 1;
const DEFAULT_MONTHLY_CUTOFF_DAY = 25;

interface ResolvedSettings {
  activityWindowDays: number;
  activityWindowMode: "rolling" | "fixed_day_of_month";
  monthlyCutoffDay: number;
  minFirstOrderSpend: number;
  graceEnabled: boolean;
  graceDays: number;
}

async function resolveSettings(
  settings?: LeaderboardOptions["settings"]
): Promise<ResolvedSettings> {
  if (settings) {
    return {
      activityWindowDays: settings.activityWindowDays ?? DEFAULT_ACTIVITY_WINDOW_DAYS,
      activityWindowMode: "rolling",
      monthlyCutoffDay: DEFAULT_MONTHLY_CUTOFF_DAY,
      minFirstOrderSpend: settings.minFirstOrderSpend ?? DEFAULT_MIN_SPEND,
      graceEnabled: false,
      graceDays: 0,
    };
  }
  const doc = await ReferralSettings.findById("referral_settings").lean();
  return {
    activityWindowDays: (doc?.activityWindowDays as number) ?? DEFAULT_ACTIVITY_WINDOW_DAYS,
    activityWindowMode: (doc?.activityWindowMode as "rolling" | "fixed_day_of_month") ?? "rolling",
    monthlyCutoffDay: (doc?.monthlyCutoffDay as number) ?? DEFAULT_MONTHLY_CUTOFF_DAY,
    minFirstOrderSpend: (doc?.minFirstOrderSpend as number) ?? DEFAULT_MIN_SPEND,
    graceEnabled: !!((doc?.gracePeriod as Record<string, unknown> | undefined)?.enabled ?? false),
    graceDays: ((doc?.gracePeriod as Record<string, unknown> | undefined)?.days as number) ?? 0,
  };
}

function buildIsActiveStage(s: ResolvedSettings): PipelineStage {
  const {
    activityWindowDays,
    activityWindowMode,
    monthlyCutoffDay,
    minFirstOrderSpend,
    graceEnabled,
    graceDays,
  } = s;

  if (activityWindowMode === "fixed_day_of_month") {
    const windowEndExpr = {
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
        day: monthlyCutoffDay,
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
      },
    };

    if (graceEnabled && graceDays > 0) {
      const conditions: Array<Record<string, unknown>> = [
        { $ne: ["$referredProfile", null] },
        { $ne: ["$referredProfile.createdAt", null] },
        { $gte: [{ $ifNull: ["$purchaseAmount", 0] }, minFirstOrderSpend] },
        {
          $lte: [
            "$purchasedAt",
            {
              $dateAdd: {
                startDate: windowEndExpr,
                unit: "day",
                amount: graceDays,
              },
            },
          ],
        },
      ];
      return {
        $set: { isActive: { $and: conditions } },
      };
    }

    const conditions: Array<Record<string, unknown>> = [
      { $ne: ["$referredProfile", null] },
      { $ne: ["$referredProfile.createdAt", null] },
      { $gte: [{ $ifNull: ["$purchaseAmount", 0] }, minFirstOrderSpend] },
      { $lte: ["$purchasedAt", windowEndExpr] },
    ];
    return {
      $set: { isActive: { $and: conditions } },
    };
  }

  if (graceEnabled && graceDays > 0) {
    const conditions: Array<Record<string, unknown>> = [
      { $ne: ["$referredProfile", null] },
      { $ne: ["$referredProfile.createdAt", null] },
      { $gte: [{ $ifNull: ["$purchaseAmount", 0] }, minFirstOrderSpend] },
      {
        $lte: [
          "$purchasedAt",
          {
            $dateAdd: {
              startDate: {
                $dateAdd: {
                  startDate: "$referredProfile.createdAt",
                  unit: "day",
                  amount: activityWindowDays,
                },
              },
              unit: "day",
              amount: graceDays,
            },
          },
        ],
      },
    ];
    return {
      $set: { isActive: { $and: conditions } },
    };
  }

  const conditions: Array<Record<string, unknown>> = [
    { $ne: ["$referredProfile", null] },
    { $ne: ["$referredProfile.createdAt", null] },
    {
      $lte: [
        "$purchasedAt",
        {
          $dateAdd: {
            startDate: "$referredProfile.createdAt",
            unit: "day",
            amount: activityWindowDays,
          },
        },
      ],
    },
    { $gte: [{ $ifNull: ["$purchaseAmount", 0] }, minFirstOrderSpend] },
  ];
  return {
    $set: { isActive: { $and: conditions } },
  };
}

export async function getTopActiveReferrers(
  options: LeaderboardOptions = {}
): Promise<LeaderboardEntry[]> {
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, 100);
  const resolved = await resolveSettings(options.settings);

  const matchStage: Record<string, unknown> = {};
  if (!options.includeDeleted) {
    matchStage.deletedAt = null;
  }

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $lookup: {
        from: "profiles",
        localField: "referredUserId",
        foreignField: "_id",
        as: "referredProfile",
      },
    },
    { $unwind: { path: "$referredProfile", preserveNullAndEmptyArrays: true } },
    buildIsActiveStage(resolved),
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$referrerId",
        activeReferees: { $addToSet: "$referredUserId" },
        ticketsAwarded: { $sum: { $ifNull: ["$ticketsAwarded", 0] } },
      },
    },
    { $addFields: { count: { $size: "$activeReferees" } } },
    { $match: { count: { $gt: 0 } } },
    { $sort: { count: -1, ticketsAwarded: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "profiles",
        localField: "_id",
        foreignField: "_id",
        as: "profile",
      },
    },
    { $unwind: "$profile" },
    {
      $project: {
        _id: 0,
        referrerId: { $toString: "$_id" },
        name: {
          $trim: {
            input: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$profile.firstName", null] },
                    { $ne: ["$profile.firstName", ""] },
                  ],
                },
                {
                  $concat: ["$profile.firstName", " ", { $ifNull: ["$profile.lastName", ""] }],
                },
                { $ifNull: ["$profile.email", "Unknown"] },
              ],
            },
          },
        },
        email: { $ifNull: ["$profile.email", ""] },
        count: 1,
        ticketsAwarded: 1,
      },
    },
  ];

  const results = await ReferralPurchase.aggregate(pipeline);

  return results.map((r, i) => ({
    rank: i + 1,
    referrerId: r.referrerId,
    name: typeof r.name === "string" && r.name.length > 0 ? r.name : (r.email ?? "Unknown"),
    email: r.email ?? "",
    count: r.count,
    ticketsAwarded: r.ticketsAwarded ?? 0,
  }));
}

export async function countUniqueActiveReferrers(
  options: LeaderboardOptions = {}
): Promise<number> {
  const resolved = await resolveSettings(options.settings);

  const matchStage: Record<string, unknown> = {};
  if (!options.includeDeleted) {
    matchStage.deletedAt = null;
  }

  const result = await ReferralPurchase.aggregate<{ n: number }>([
    { $match: matchStage },
    {
      $lookup: {
        from: "profiles",
        localField: "referredUserId",
        foreignField: "_id",
        as: "referredProfile",
      },
    },
    { $unwind: { path: "$referredProfile", preserveNullAndEmptyArrays: true } },
    buildIsActiveStage(resolved),
    { $match: { isActive: true } },
    { $group: { _id: "$referrerId" } },
    { $count: "n" },
  ]);

  return result[0]?.n ?? 0;
}

export async function getReferrerUniqueActiveCount(
  referrerId: string | mongoose.Types.ObjectId,
  options: LeaderboardOptions = {}
): Promise<number> {
  const resolved = await resolveSettings(options.settings);
  const oid = typeof referrerId === "string" ? new mongoose.Types.ObjectId(referrerId) : referrerId;

  const matchStage: Record<string, unknown> = { referrerId: oid };
  if (!options.includeDeleted) {
    matchStage.deletedAt = null;
  }

  const result = await ReferralPurchase.aggregate<{ n: number }>([
    { $match: matchStage },
    {
      $lookup: {
        from: "profiles",
        localField: "referredUserId",
        foreignField: "_id",
        as: "referredProfile",
      },
    },
    { $unwind: { path: "$referredProfile", preserveNullAndEmptyArrays: true } },
    buildIsActiveStage(resolved),
    { $match: { isActive: true } },
    { $group: { _id: "$referredUserId" } },
    { $count: "n" },
  ]);

  return result[0]?.n ?? 0;
}

export interface DistributionBucket {
  _id: number;
  count: number;
}

export interface DistributionResult {
  boundaries: number[];
  buckets: DistributionBucket[];
}

export async function getActiveReferrerDistribution(
  boundaries: number[],
  options: LeaderboardOptions = {}
): Promise<DistributionResult> {
  const resolved = await resolveSettings(options.settings);

  const matchStage: Record<string, unknown> = {};
  if (!options.includeDeleted) {
    matchStage.deletedAt = null;
  }

  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  const bucketBoundaries = [0, ...sortedBoundaries, 1e9];

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $lookup: {
        from: "profiles",
        localField: "referredUserId",
        foreignField: "_id",
        as: "referredProfile",
      },
    },
    { $unwind: { path: "$referredProfile", preserveNullAndEmptyArrays: true } },
    buildIsActiveStage(resolved),
    { $match: { isActive: true } },
    {
      $group: {
        _id: { referrerId: "$referrerId", referredUserId: "$referredUserId" },
      },
    },
    {
      $group: {
        _id: "$_id.referrerId",
        activeCount: { $sum: 1 },
      },
    },
    {
      $bucket: {
        groupBy: "$activeCount",
        boundaries: bucketBoundaries,
        default: "other",
        output: { count: { $sum: 1 } },
      },
    } as PipelineStage.Bucket,
  ];

  const results = await ReferralPurchase.aggregate(pipeline);

  return {
    boundaries: sortedBoundaries,
    buckets: results as DistributionBucket[],
  };
}

export const __test = { resolveSettings };
