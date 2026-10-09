import { Profile, ReferralPurchase, ReferralSettings } from "@oc/api-db/models";
import { invalidateUser } from "@oc/api-infra/cache";
import { createLogger } from "@oc/api-logger";
import { sendReferralTicketsAllocatedEmail, sendReferralTicketsAwardedEmail } from "./emails";
import { qualifyPurchaseForTier } from "./qualify-purchase";
import { awardPendingReferralTickets } from "./referral-award";
import { formatTierLabel } from "./referral-tier-math";
import type { NewReferralSettings } from "./types";

const log = createLogger("referral");

export async function recordReferralPurchase(params: {
  buyerUserId: string;
  orderId: string;
  quantity: number;
  orderTotal: number;
  isGuestCheckout?: boolean;
  onAwarded?: (result: {
    ticketsGranted: number;
    referrerUserId: string;
    competitionCount: number;
  }) => void;
}): Promise<void> {
  if (params.isGuestCheckout) return;

  const buyerProfile = await Profile.findById(params.buyerUserId).lean();
  if (!buyerProfile) return;

  const effectiveReferrerId = buyerProfile.referredBy ?? buyerProfile.referredBySignup;
  if (!effectiveReferrerId) return;

  const existing = await ReferralPurchase.findOne({ orderId: params.orderId }).lean();
  if (existing) return;

  const settingsDoc = (await ReferralSettings.findById("referral_settings").lean()) as Record<
    string,
    unknown
  > | null;
  const settings = settingsDoc ?? {};

  const minSpend = (settings.minFirstOrderSpend as number) ?? 1;
  const orderTotal = Number.isFinite(params.orderTotal) ? params.orderTotal : 0;
  if (orderTotal < minSpend) {
    log.warn(
      `skipped: buyer ${params.buyerUserId} orderTotal=${orderTotal} below minSpend=${minSpend} for order ${params.orderId}`
    );
    return;
  }

  const referrerProfile = await Profile.findById(effectiveReferrerId).lean();
  if (!referrerProfile) {
    console.warn(
      `[referral] Referrer profile not found: referrerId=${effectiveReferrerId}, buyerUserId=${params.buyerUserId}, orderId=${params.orderId}. Referral not recorded.`
    );
    return;
  }

  const flatSettings = {
    activityWindowDays: (settings.activityWindowDays as number) ?? 30,
    activityWindowMode:
      (settings.activityWindowMode as "rolling" | "fixed_day_of_month") ?? "rolling",
    monthlyCutoffDay: (settings.monthlyCutoffDay as number) ?? 25,
    minFirstOrderSpend: minSpend,
    gracePeriod: (settings.gracePeriod as NewReferralSettings["gracePeriod"]) ?? {
      enabled: false,
      days: 3,
      countsToward: "current_tier" as const,
    },
    guardrails: (settings.guardrails as NewReferralSettings["guardrails"]) ?? {
      maxReferralsPerRefereePerDay: 0,
      blockSelfReferral: true,
      requireEmailVerification: false,
    },
  };

  const tiers = (settings.tiers as NewReferralSettings["tiers"]) ?? [
    { threshold: 5, tickets: 2 },
    { threshold: 10, tickets: 5 },
    { threshold: 15, tickets: 10 },
  ];

  const maxPerDay = flatSettings.guardrails.maxReferralsPerRefereePerDay;
  let referralsTodayCount: number | undefined;
  if (maxPerDay > 0) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    referralsTodayCount = await ReferralPurchase.countDocuments({
      referredUserId: params.buyerUserId,
      purchasedAt: { $gte: todayStart },
    });
  }

  const qualifyResult = qualifyPurchaseForTier({
    purchaseDate: new Date(),
    refereeCreatedAt: buyerProfile.createdAt,
    refereeTotalSpentOnOrder: orderTotal,
    refereeEmailVerified: buyerProfile.isVerified ?? true,
    referrerId: effectiveReferrerId.toString(),
    buyerUserId: buyerProfile._id.toString(),
    referralsTodayCount,
    settings: flatSettings,
  });

  if (!qualifyResult.qualifies) {
    if (qualifyResult.reason !== "deferred") return;
  }

  const isDeferred = qualifyResult.reason === "deferred";

  const existedCount = await ReferralPurchase.countDocuments(
    { referrerId: effectiveReferrerId, referredUserId: params.buyerUserId },
    { onlinecompetitions_softDeleteIncluded: true }
  );
  const existedBeforeCreate = existedCount > 0;

  try {
    await ReferralPurchase.create({
      referrerId: effectiveReferrerId,
      signupReferrerId: buyerProfile.referredBySignup ?? effectiveReferrerId,
      referredUserId: params.buyerUserId,
      orderId: params.orderId,
      purchaseAmount: orderTotal,
      purchasedAt: new Date(),
      referrerEmail: referrerProfile.email,
      referredEmail: buyerProfile.email,
      commissionAmount: 0,
      ...(isDeferred ? { deferredUntilNextWindow: true } : {}),
    });
    void invalidateUser(effectiveReferrerId.toString()).catch(() => {});
    void invalidateUser(params.buyerUserId).catch(() => {});
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("duplicate key")) return;
    throw err;
  }

  if (!existedBeforeCreate) {
    const updated = await Profile.findByIdAndUpdate(effectiveReferrerId, {
      $inc: { referralCount: 1 },
    });
    void invalidateUser(effectiveReferrerId.toString()).catch(() => {});

    if (!updated) {
      log.error(
        `failed to increment referral counters: referrerId=${effectiveReferrerId}, buyerUserId=${params.buyerUserId}, orderId=${params.orderId}`
      );
    }
  }

  if (isDeferred) return;

  const awardSettings: NewReferralSettings = {
    _id: "referral_settings",
    tiers,
    calculusMethod: (settings.calculusMethod as NewReferralSettings["calculusMethod"]) ?? "gross",
    activityWindowDays: flatSettings.activityWindowDays,
    activityWindowMode: flatSettings.activityWindowMode,
    monthlyCutoffDay: flatSettings.monthlyCutoffDay,
    gracePeriod: flatSettings.gracePeriod,
    minFirstOrderSpend: flatSettings.minFirstOrderSpend,
    refereeReward: (settings.refereeReward as NewReferralSettings["refereeReward"]) ?? {
      enabled: true,
      discountPercent: 20,
      minOrderValue: 0,
    },
    distribution: (settings.distribution as NewReferralSettings["distribution"]) ?? {
      mode: "wallet",
    },
    guardrails: flatSettings.guardrails,
  };

  try {
    const awardResult = await awardPendingReferralTickets(effectiveReferrerId, awardSettings);

    if (awardResult.ticketsGranted > 0 && awardResult.validCount > 0) {
      try {
        const tierLabel = formatTierLabel(awardResult.validCount, awardSettings.tiers);
        const userName = referrerProfile.firstName
          ? `${referrerProfile.firstName}${referrerProfile.lastName ? ` ${referrerProfile.lastName}` : ""}`
          : referrerProfile.email.split("@")[0] || "Customer";

        if (
          awardSettings.distribution.mode === "all_competitions" &&
          awardResult.allocations.length > 0
        ) {
          const flatAllocations = awardResult.allocations.flatMap((p) => p.allocations);
          const competitionCount = new Set(flatAllocations.map((a) => a.competitionId)).size;

          await sendReferralTicketsAllocatedEmail({
            referrerUserId: effectiveReferrerId.toString(),
            referrerName: userName,
            referrerEmail: referrerProfile.email,
            totalTickets: awardResult.ticketsGranted,
            competitionCount,
            allocations: flatAllocations.map((a) => ({
              competitionId: a.competitionId,
              competitionTitle: a.competitionTitle,
              ticketNumbers: a.numbers,
              qty: a.qty,
            })),
            tierLabel,
          });
        } else {
          await sendReferralTicketsAwardedEmail({
            referrerUserId: effectiveReferrerId.toString(),
            ticketsGranted: awardResult.ticketsGranted,
            tierLabel,
            referrerName: userName,
            referrerEmail: referrerProfile.email,
          });
        }

        params.onAwarded?.({
          ticketsGranted: awardResult.ticketsGranted,
          referrerUserId: effectiveReferrerId.toString(),
          competitionCount: awardResult.allocations.reduce(
            (acc, p) => acc + new Set(p.allocations.map((a) => a.competitionId)).size,
            0
          ),
        });
      } catch (emailErr) {
        console.error("Failed to send referral award email:", emailErr);
      }
    }
  } catch (awardErr) {
    console.error("Failed to award referral tiers instantly:", awardErr);
  }
}

/** Soft-delete referral credit tied to a refunded order so tiers are not inflated. */
export async function invalidateReferralPurchaseForOrder(orderId: string): Promise<void> {
  const existing = await ReferralPurchase.findOne({ orderId }).lean();
  if (!existing) return;
  await ReferralPurchase.softDelete(existing._id.toString());
  void invalidateUser(existing.referrerId.toString()).catch(() => {});
  void invalidateUser(existing.referredUserId.toString()).catch(() => {});
}
