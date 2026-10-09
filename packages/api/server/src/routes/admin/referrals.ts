import { Profile, ReferralPurchase, ReferralSettings } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, paginated } from "@oc/api-infra/response";
import {
  isQualifyingReferralPurchase,
  type ReferralQualificationSettings,
} from "@oc/api-referrals/referral-tier-math";
import { Hono } from "hono";
import { requireManager } from "../../middleware/auth";

const app = new Hono();

app.use("*", requireManager);

// GET /api/admin/referrals — all referred users including those without qualifying purchases
app.get("/", async (c) => {
  try {
    const search = c.req.query("search");
    const status = c.req.query("status") || "all"; // all | active | pending
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const page = parseInt(c.req.query("page") || "1", 10);
    const skip = (page - 1) * limit;

    await dbConnect();

    const settingsDoc = await ReferralSettings.findById("referral_settings").lean();
    const minSpend = (settingsDoc?.minFirstOrderSpend as number) ?? 1;
    const activityWindowDays = (settingsDoc?.activityWindowDays as number) ?? 30;
    const activityWindowMode =
      (settingsDoc?.activityWindowMode as "rolling" | "fixed_day_of_month" | undefined) ??
      "rolling";
    const monthlyCutoffDay = (settingsDoc?.monthlyCutoffDay as number) ?? 25;
    const graceData =
      (settingsDoc?.gracePeriod as
        | { enabled?: boolean; days?: number; countsToward?: string }
        | undefined) ?? {};
    const referralQualSettings: ReferralQualificationSettings = {
      mode: activityWindowMode,
      rollingDays: activityWindowDays,
      cutoffDay: monthlyCutoffDay,
      graceEnabled: !!graceData.enabled,
      graceDays: graceData.days ?? 3,
      graceCountsToward: graceData.countsToward === "next_tier" ? "next" : "current",
    };

    // Match profiles that were referred (have referredBy set)
    const match: Record<string, unknown> = { referredBy: { $exists: true, $ne: null } };
    if (search) {
      match.$or = [
        { email: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
      ];
    }

    const [profiles, total] = await Promise.all([
      Profile.find(match)
        .select("email fullName referredBy referredByCode createdAt totalSpent")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Profile.countDocuments(match),
    ]);

    if (profiles.length === 0) {
      return paginated(c, [], total, page, limit);
    }

    // Fetch referral purchases for all displayed users
    const referralPurchases = await ReferralPurchase.find({
      referredUserId: { $in: profiles.map((p) => p._id) },
    })
      .select("referredUserId purchasedAt purchaseAmount")
      .lean();

    // Build map of referredUserId → list of purchases
    const purchasesByUser = new Map<
      string,
      Array<{ purchasedAt: Date; purchaseAmount: number; referredUserId: string }>
    >();
    for (const rp of referralPurchases) {
      const idStr = rp.referredUserId.toString();
      if (!purchasesByUser.has(idStr)) purchasesByUser.set(idStr, []);
      purchasesByUser.get(idStr)!.push({
        purchasedAt: rp.purchasedAt,
        purchaseAmount: rp.purchaseAmount ?? 0,
        referredUserId: rp.referredUserId.toString(),
      });
    }

    const results = profiles.map((p) => {
      const idStr = p._id.toString();
      const userPurchases = purchasesByUser.get(idStr) ?? [];
      const hasQualifyingPurchase = userPurchases.some((rp) =>
        isQualifyingReferralPurchase(
          {
            purchasedAt: rp.purchasedAt,
            referredUserId: { toString: () => rp.referredUserId },
            purchaseAmount: rp.purchaseAmount,
          },
          {
            _id: { toString: () => idStr },
            createdAt: p.createdAt,
            totalSpent: p.totalSpent,
          },
          referralQualSettings,
          minSpend
        )
      );
      const isActive = hasQualifyingPurchase;
      return {
        _id: idStr,
        email: p.email,
        fullName: [p.firstName, p.lastName].filter(Boolean).join(" "),
        referredByCode: p.referredByCode ?? null,
        joinedAt: p.createdAt.toISOString(),
        totalSpent: p.totalSpent ?? 0,
        hasQualifyingPurchase,
        isActive,
      };
    });

    const filtered = results.filter((r) => {
      if (status === "all") return true;
      if (status === "active") return r.isActive;
      return !r.hasQualifyingPurchase;
    });

    return paginated(c, filtered, total, page, limit);
  } catch (err) {
    console.error("Error listing all referrals:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
