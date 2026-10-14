import {
  Balance,
  Order,
  Profile,
  UserActivityDay,
  UserPersonalisationFeatures,
} from "@oc/api-db/models";
import type { AiPersonalisationSettings, UserPersonalisationFeatureSnapshot } from "@oc/types";
import mongoose from "mongoose";
import { walletBalanceToBand } from "./wallet-band";

function isSelfExcludedNow(
  selfExcluded: boolean,
  selfExcludedUntil?: Date | null
): boolean {
  if (!selfExcluded) return false;
  if (!selfExcludedUntil) return true;
  return selfExcludedUntil.getTime() > Date.now();
}

async function resolveAudienceUserIds(settings: AiPersonalisationSettings): Promise<string[]> {
  const ordersSince = new Date(
    Date.now() - settings.audienceOrdersWithinDays * 24 * 60 * 60 * 1000
  );
  const activitySince = new Date(
    Date.now() - settings.audienceActivityWithinDays * 24 * 60 * 60 * 1000
  );
  const cap = settings.maxUsersPerRun;

  if (settings.audienceMode === "verified_accounts") {
    const profiles = await Profile.find({
      isVerified: true,
      isGuestCheckout: { $ne: true },
    })
      .select("_id")
      .limit(cap)
      .lean();
    return profiles.map((p) => String(p._id));
  }

  if (settings.audienceMode === "paid_orders_window") {
    const userIds = await Order.distinct("userId", {
      status: "completed",
      createdAt: { $gte: ordersSince },
      deletedAt: null,
    });
    return userIds.slice(0, cap).map((id) => String(id));
  }

  const [fromOrders, fromActivity] = await Promise.all([
    Order.distinct("userId", {
      status: "completed",
      createdAt: { $gte: ordersSince },
      deletedAt: null,
    }),
    UserActivityDay.distinct("userId", { lastSeenAt: { $gte: activitySince } }),
  ]);
  const merged = new Set<string>([
    ...fromOrders.map((id) => String(id)),
    ...fromActivity.map((id) => String(id)),
  ]);
  return [...merged].slice(0, cap);
}

async function loadTopCategoriesForUsers(
  userIds: string[],
  ordersSince: Date
): Promise<Map<string, string[]>> {
  const oids = userIds.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await Order.aggregate<{ userId: string; categories: string[] }>([
    {
      $match: {
        userId: { $in: oids },
        status: "completed",
        createdAt: { $gte: ordersSince },
        deletedAt: null,
      },
    },
    {
      $lookup: {
        from: "orderitems",
        localField: "_id",
        foreignField: "orderId",
        as: "items",
      },
    },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "competitions",
        localField: "items.competitionId",
        foreignField: "_id",
        as: "comp",
      },
    },
    { $unwind: "$comp" },
    {
      $group: {
        _id: "$userId",
        categories: { $addToSet: "$comp.category" },
      },
    },
    {
      $project: {
        userId: { $toString: "$_id" },
        categories: {
          $slice: [
            {
              $filter: {
                input: "$categories",
                as: "c",
                cond: { $and: [{ $ne: ["$$c", null] }, { $ne: ["$$c", ""] }] },
              },
            },
            3,
          ],
        },
      },
    },
  ]);

  return new Map(rows.map((r) => [r.userId, r.categories ?? []]));
}

export type RebuildFeaturesSummary = {
  audienceCount: number;
  featuresWritten: number;
  llmEligibleCount: number;
};

export async function rebuildPersonalisationFeatures(input: {
  runId: string;
  settings: AiPersonalisationSettings;
}): Promise<RebuildFeaturesSummary> {
  const { runId, settings } = input;
  const userIds = await resolveAudienceUserIds(settings);
  const ordersSince = new Date(
    Date.now() - settings.audienceOrdersWithinDays * 24 * 60 * 60 * 1000
  );

  let featuresWritten = 0;
  let llmEligibleCount = 0;
  const chunkSize = 100;

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const oids = chunk.map((id) => new mongoose.Types.ObjectId(id));
    const [profiles, balances, lastOrders, categoryMap] = await Promise.all([
      Profile.find({ _id: { $in: oids } }).lean(),
      Balance.find({ userId: { $in: oids } }).select("userId amount").lean(),
      Order.aggregate<{ _id: mongoose.Types.ObjectId; lastOrderAt: Date }>([
        {
          $match: {
            userId: { $in: oids },
            status: "completed",
            deletedAt: null,
          },
        },
        { $group: { _id: "$userId", lastOrderAt: { $max: "$createdAt" } } },
      ]),
      loadTopCategoriesForUsers(chunk, ordersSince),
    ]);

    const balanceByUser = new Map(balances.map((b) => [String(b.userId), b.amount ?? 0]));
    const lastOrderByUser = new Map(lastOrders.map((o) => [String(o._id), o.lastOrderAt]));

    const ops = profiles.map((profile) => {
      const userId = String(profile._id);
      const excluded = isSelfExcludedNow(profile.selfExcluded, profile.selfExcludedUntil);
      const consentOk = !settings.requireMarketingConsent || profile.marketingConsent;
      const guest = Boolean(profile.isGuestCheckout);
      const hasSpendLimit =
        profile.monthlySpendLimit != null && profile.monthlySpendLimit > 0;
      const eligibleForLlm = !excluded && consentOk && !guest;

      if (eligibleForLlm) llmEligibleCount += 1;

      const snapshot: UserPersonalisationFeatureSnapshot = {
        userId,
        totalSpent: profile.totalSpent ?? 0,
        totalEntries: profile.totalEntries ?? 0,
        topCategorySlugs: categoryMap.get(userId) ?? [],
        lastOrderAt: lastOrderByUser.get(userId)?.toISOString(),
        walletBalanceBand: walletBalanceToBand(balanceByUser.get(userId) ?? 0),
        referralBand: (profile.referralCount ?? 0) > 0 ? "active" : "none",
        marketingConsent: profile.marketingConsent ?? false,
        selfExcluded: excluded,
        selfExcludedUntil: profile.selfExcludedUntil
          ? new Date(profile.selfExcludedUntil).toISOString()
          : null,
        hasActiveSpendLimit: hasSpendLimit,
        isGuestCheckout: guest,
        eligibleForLlm,
      };

      return {
        updateOne: {
          filter: { userId },
          update: { $set: { ...snapshot, runId } },
          upsert: true,
        },
      };
    });

    if (ops.length > 0) {
      await UserPersonalisationFeatures.bulkWrite(ops);
      featuresWritten += ops.length;
    }
  }

  await UserPersonalisationFeatures.deleteMany({
    runId: { $ne: runId },
  });

  return {
    audienceCount: userIds.length,
    featuresWritten,
    llmEligibleCount,
  };
}
