import { Profile, ReferralPurchase, ReferralSettings } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { getTopActiveReferrers } from "@oc/api-referrals/leaderboard";
import {
  type CalculusMethod,
  calculateTierGrant,
  countValidReferredUsers,
  DEFAULT_TIERS,
  findNextTier,
  isQualifyingReferralPurchase,
  type ReferralQualificationSettings,
  type ReferralTier,
  type ReferredUserQualificationSlice,
} from "@oc/api-referrals/referral-tier-math";
import { auth } from "@oc/api-server/middleware/auth";
import { getDisplayName } from "@oc/utils";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", auth);

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();

    const profile = await Profile.findById(userId).lean();
    if (!profile) {
      if ((c.get("user") as { isAnonymous?: boolean }).isAnonymous) {
        return success(c, {
          referralCode: null,
          totalReferralCount: 0,
          activeReferralCount: 0,
          pendingReferralCount: 0,
          tierTickets: 0,
          referralsToNextTier: 0,
          totalAwardedTickets: 0,
          walletBalance: 0,
          referralMultiplier: 1,
          recentReferrals: [],
          leaderboard: [],
        });
      }
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    if (!profile.referralCode) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code: string;
      let attempts = 0;
      do {
        code = "";
        for (let i = 0; i < 6; i++) {
          code += chars[Math.floor(Math.random() * chars.length)];
        }
        attempts++;
        if (attempts > 10) break;
      } while (await Profile.findOne({ referralCode: code }).lean());

      await Profile.findByIdAndUpdate(userId, { referralCode: code });
      profile.referralCode = code;
    }

    const settings = await ReferralSettings.findById("referral_settings").lean();
    const activityWindowDays = (settings?.activityWindowDays as number) ?? 30;
    const minSpend = (settings?.minFirstOrderSpend as number) ?? 1;
    const tiers = (settings?.tiers as ReferralTier[]) ?? DEFAULT_TIERS;
    const calculusMethod = (settings?.calculusMethod as CalculusMethod | undefined) ?? "gross";
    const gracePeriod =
      (settings?.gracePeriod as
        | { enabled?: boolean; days?: number; countsToward?: string }
        | undefined) ?? {};
    const activityWindowMode =
      (settings?.activityWindowMode as "rolling" | "fixed_day_of_month" | undefined) ?? "rolling";
    const monthlyCutoffDay = (settings?.monthlyCutoffDay as number | undefined) ?? 25;

    const referralQualSettings: ReferralQualificationSettings = {
      mode: activityWindowMode,
      rollingDays: activityWindowDays,
      cutoffDay: monthlyCutoffDay,
      graceEnabled: !!gracePeriod.enabled,
      graceDays: gracePeriod.days ?? 3,
      graceCountsToward: gracePeriod.countsToward === "next_tier" ? "next" : "current",
    };

    const referrerOid = new mongoose.Types.ObjectId(userId);

    const purchases = await ReferralPurchase.find({ referrerId: referrerOid })
      .select("referredUserId purchasedAt purchaseAmount")
      .lean();

    const totalReferralCount = new Set(purchases.map((p) => p.referredUserId.toString())).size;

    const referredUserIds = [
      ...new Set(purchases.map((purchase) => purchase.referredUserId.toString())),
    ];
    const referredUsers = referredUserIds.length
      ? await Profile.find({
          _id: {
            $in: referredUserIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("_id totalSpent createdAt")
          .lean()
      : [];

    const referredUserMap = new Map<string, ReferredUserQualificationSlice>(
      referredUsers.map((user) => [user._id.toString(), user])
    );

    const activeReferralCount = countValidReferredUsers(
      purchases,
      referredUsers,
      referralQualSettings,
      minSpend
    );

    const grant = calculateTierGrant({
      validActiveReferees: activeReferralCount,
      tiers,
      profileMultiplier: profile.referralMultiplier ?? 1,
      calculusMethod,
    });

    const tierTickets = grant.tickets;

    const nextTier = findNextTier(activeReferralCount, tiers);
    const referralsToNextTier = nextTier ? nextTier.threshold - activeReferralCount : 0;

    const qualifyingReferredUserIds = new Set<string>();
    for (const purchase of purchases) {
      const referredUser = referredUserMap.get(purchase.referredUserId.toString());
      if (isQualifyingReferralPurchase(purchase, referredUser, referralQualSettings, minSpend)) {
        qualifyingReferredUserIds.add(purchase.referredUserId.toString());
      }
    }

    const referredProfiles = await Profile.find({ referredBy: userId })
      .select("firstName lastName email createdAt totalSpent")
      .sort({ createdAt: -1 })
      .lean();

    const leaderboardEntries = await getTopActiveReferrers({ limit: 10 });

    const leaderboard = leaderboardEntries.map((entry) => ({
      rank: entry.rank,
      name: entry.name,
      count: entry.count,
    }));

    return success(c, {
      referralCode: profile.referralCode || null,
      totalReferralCount,
      activeReferralCount,
      pendingReferralCount: totalReferralCount - activeReferralCount,
      tierTickets,
      referralsToNextTier,
      totalAwardedTickets: profile.referralTierAwardedTickets || 0,
      walletBalance: profile.referralTierAwardedTickets || 0,
      referralMultiplier: profile.referralMultiplier ?? 1,
      recentReferrals: referredProfiles
        .map((r) => ({
          id: r._id.toString(),
          name:
            r.email && /@guest\.onlinecompetitions\.local$/i.test(r.email)
              ? "Unregistered"
              : getDisplayName(r, r.email ?? ""),
          email: r.email,
          joinedAt: r.createdAt,
          hasCompletedPurchase: qualifyingReferredUserIds.has(r._id.toString()),
        }))
        .sort((a, b) => {
          if (a.hasCompletedPurchase !== b.hasCompletedPurchase) {
            return a.hasCompletedPurchase ? -1 : 1;
          }
          return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
        }),
      leaderboard,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.referrals.list",
    });
    console.error("Error fetching referrals:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
