import { Competition, Profile, ReferralPurchase, Ticket } from "@oc/api-db/models";
import { invalidateUser } from "@oc/api-infra/cache";
import { createLogger } from "@oc/api-logger";
import { claimTicketsForOrder } from "@oc/api-tickets/ticket-service";
import { type Types } from "mongoose";
import { qualifyPurchaseForTier } from "./qualify-purchase";
import { calculateTierGrant } from "./tier-ladder";
import type { Allocation, NewReferralSettings } from "./types";

const log = createLogger("award-tier");

function utcDayKey(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

async function batchReferralsTodayCount(
  purchases: Array<{
    referredUserId: Types.ObjectId;
    purchasedAt: Date;
    _id: Types.ObjectId;
  }>
): Promise<Map<string, number>> {
  if (purchases.length === 0) return new Map();

  const referredUserIds = [...new Set(purchases.map((p) => p.referredUserId.toString()))].map(
    (id) => purchases.find((p) => p.referredUserId.toString() === id)!.referredUserId
  );

  const aggregated = await ReferralPurchase.aggregate<{
    _id: { referredUserId: Types.ObjectId; day: Date };
    count: number;
  }>([
    {
      $match: {
        referredUserId: { $in: referredUserIds },
      },
    },
    {
      $group: {
        _id: {
          referredUserId: "$referredUserId",
          day: {
            $dateTrunc: { date: "$purchasedAt", unit: "day", timezone: "UTC" },
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const totals = new Map<string, number>();
  for (const row of aggregated) {
    const key = `${row._id.referredUserId.toString()}_${row._id.day.getTime()}`;
    totals.set(key, row.count);
  }

  return totals;
}

function lookupReferralsTodayCount(
  totals: Map<string, number>,
  referredUserId: Types.ObjectId,
  purchasedAt: Date
): number {
  const key = `${referredUserId.toString()}_${utcDayKey(purchasedAt)}`;
  const total = totals.get(key) ?? 0;
  return total > 0 ? total - 1 : 0;
}

export async function awardPendingReferralTickets(
  profileId: Types.ObjectId | string,
  settings: NewReferralSettings
): Promise<{
  ticketsGranted: number;
  purchasesCredited: number;
  validCount: number;
  allocations: Array<{
    purchaseId: string;
    orderId: string;
    allocations: Allocation[];
  }>;
}> {
  const profile = await Profile.findById(profileId).lean();
  if (!profile) {
    return { ticketsGranted: 0, purchasesCredited: 0, validCount: 0, allocations: [] };
  }

  const multiplier = profile.referralMultiplier ?? 1;

  const allPurchases = await ReferralPurchase.find({ referrerId: profile._id })
    .sort({ purchasedAt: 1 })
    .lean();

  const profileThresholds: number[] = (profile as any).referralTierThresholdsAwarded ?? [];
  const awardedThresholds = new Set(profileThresholds);
  if (profileThresholds.length === 0) {
    for (const p of allPurchases) {
      if (p.tierAtAward != null && (p.ticketsAwarded ?? 0) > 0) {
        awardedThresholds.add(p.tierAtAward);
      }
    }
  }

  const unawarded = allPurchases.filter((p) => !p.ticketsAwarded || p.ticketsAwarded === 0);
  if (unawarded.length === 0) {
    await Profile.findByIdAndUpdate(profile._id, {
      $set: {
        referralTierLastUpdated: new Date(),
        referralTierThresholdsAwarded: [...awardedThresholds],
      },
    });
    void invalidateUser(profile._id.toString()).catch(() => {});
    return { ticketsGranted: 0, purchasesCredited: 0, validCount: 0, allocations: [] };
  }

  const referredUserIds = [...new Set(allPurchases.map((p) => p.referredUserId.toString()))];
  const referredUsers = await Profile.find({ _id: { $in: referredUserIds } })
    .select("_id totalSpent createdAt isVerified")
    .lean();

  const referredUserMap = new Map(
    referredUsers.map((u) => [
      u._id.toString(),
      {
        createdAt: u.createdAt,
        totalSpent: u.totalSpent,
        emailVerified: u.isVerified,
      },
    ])
  );

  const todayCountTotals = await batchReferralsTodayCount(allPurchases);

  const validUserIds = new Set<string>();

  for (const p of allPurchases) {
    if ((p.ticketsAwarded ?? 0) > 0 || p.ticketsAwarded === -1) {
      const referred = referredUserMap.get(p.referredUserId.toString());
      if (referred) {
        const result = qualifyPurchaseForTier({
          purchaseDate: p.purchasedAt,
          refereeCreatedAt: referred.createdAt,
          refereeTotalSpentOnOrder: p.purchaseAmount ?? 0,
          refereeEmailVerified: referred.emailVerified,
          referrerId: profile._id.toString(),
          buyerUserId: p.referredUserId.toString(),
          referralsTodayCount: lookupReferralsTodayCount(
            todayCountTotals,
            p.referredUserId,
            p.purchasedAt
          ),
          settings: {
            activityWindowDays: settings.activityWindowDays,
            activityWindowMode: settings.activityWindowMode,
            monthlyCutoffDay: settings.monthlyCutoffDay,
            minFirstOrderSpend: settings.minFirstOrderSpend,
            gracePeriod: settings.gracePeriod,
            guardrails: settings.guardrails,
          },
        });
        if (result.qualifies || result.reason === "deferred") {
          validUserIds.add(p.referredUserId.toString());
        }
      }
    }
  }

  let ticketsGranted = 0;
  let purchasesCredited = 0;
  const allAllocations: Array<{
    purchaseId: string;
    orderId: string;
    allocations: Allocation[];
  }> = [];

  for (const purchase of unawarded) {
    const referred = referredUserMap.get(purchase.referredUserId.toString());
    if (!referred) continue;

    const result = qualifyPurchaseForTier({
      purchaseDate: purchase.purchasedAt,
      refereeCreatedAt: referred.createdAt,
      refereeTotalSpentOnOrder: purchase.purchaseAmount ?? 0,
      refereeEmailVerified: referred.emailVerified,
      referrerId: profile._id.toString(),
      buyerUserId: purchase.referredUserId.toString(),
      referralsTodayCount: lookupReferralsTodayCount(
        todayCountTotals,
        purchase.referredUserId,
        purchase.purchasedAt
      ),
      settings: {
        activityWindowDays: settings.activityWindowDays,
        activityWindowMode: settings.activityWindowMode,
        monthlyCutoffDay: settings.monthlyCutoffDay,
        minFirstOrderSpend: settings.minFirstOrderSpend,
        gracePeriod: settings.gracePeriod,
        guardrails: settings.guardrails,
      },
    });

    if (result.qualifies || result.reason === "deferred") {
      validUserIds.add(purchase.referredUserId.toString());
    }

    if (!result.qualifies) continue;

    const validCountAtAward = validUserIds.size;
    const grant = calculateTierGrant({
      validActiveReferees: validCountAtAward,
      tiers: settings.tiers,
      profileMultiplier: multiplier,
      calculusMethod: settings.calculusMethod,
    });

    const tierAtAward = grant.tier?.threshold ?? null;
    const inheritedOrderId = purchase.orderId;

    if (tierAtAward != null && awardedThresholds.has(tierAtAward)) {
      await ReferralPurchase.findOneAndUpdate(
        { _id: purchase._id, ticketsAwarded: { $lte: 0 } },
        { $set: { ticketsAwarded: -1, ticketsAwardedAt: new Date(), tierAtAward: null } }
      );
      continue;
    }
    if (tierAtAward != null) {
      awardedThresholds.add(tierAtAward);
    }

    if (settings.distribution.mode === "all_competitions") {
      const stalenessDays = settings.activityWindowDays + (settings.gracePeriod?.days ?? 0) + 7;
      const staleCutoff = new Date(Date.now() - stalenessDays * 24 * 60 * 60 * 1000);
      if (purchase.purchasedAt < staleCutoff) {
        log.warn("purchase too old — awarding 0 tickets to break retry cycle", {
          purchaseId: purchase._id.toString(),
          purchasedAt: purchase.purchasedAt,
          stalenessDays,
        });
        await ReferralPurchase.findOneAndUpdate(
          { _id: purchase._id, ticketsAwarded: { $lte: 0 } },
          { $set: { ticketsAwarded: -1, ticketsAwardedAt: new Date() } }
        );
        continue;
      }

      const eligible = await Competition.find({ status: "active" })
        .select("_id title maxTicketsPerUser ticketsSold maxTickets")
        .lean();

      const allocationsForPurchase: Allocation[] = [];
      for (const comp of eligible) {
        const remaining = Math.max(0, comp.maxTickets - (comp.ticketsSold ?? 0));
        if (remaining <= 0) continue;

        let perUserBudget = grant.tickets;
        if (comp.maxTicketsPerUser > 0) {
          const owned = await Ticket.countDocuments({
            competitionId: comp._id,
            ownerId: profile._id,
            status: "sold",
          });
          const room = comp.maxTicketsPerUser - owned;
          if (room <= 0) continue;
          perUserBudget = Math.min(perUserBudget, room);
        }

        const qty = Math.min(perUserBudget, remaining);
        if (qty <= 0) continue;

        try {
          const result = await claimTicketsForOrder({
            competitionId: comp._id.toString(),
            userId: profile._id.toString(),
            orderId: inheritedOrderId.toString(),
            qty,
          });
          allocationsForPurchase.push({
            competitionId: comp._id.toString(),
            competitionTitle: comp.title,
            ticketIds: result.ticketIds,
            numbers: result.numbers,
            qty,
          });
        } catch (err) {
          log.warn("referral allocation skipped (claim failed)", {
            err,
            competitionId: comp._id.toString(),
          });
        }
      }

      const granted = allocationsForPurchase.reduce((s, a) => s + a.qty, 0);

      if (granted > 0) {
        const claimed = await ReferralPurchase.findOneAndUpdate(
          { _id: purchase._id, ticketsAwarded: 0 },
          {
            $set: {
              ticketsAwarded: granted,
              ticketsAwardedAt: new Date(),
              ...(tierAtAward != null ? { tierAtAward } : {}),
            },
          },
          { new: true }
        );

        if (claimed) {
          ticketsGranted += granted;
          purchasesCredited += 1;
        }
      } else {
        log.warn("no eligible competitions — tickets not awarded (will retry next run)", {
          profileId: profile._id.toString(),
          targetTickets: grant.tickets,
        });
      }

      allAllocations.push({
        purchaseId: purchase._id.toString(),
        orderId: inheritedOrderId.toString(),
        allocations: allocationsForPurchase,
      });
    } else {
      let awardCredited = false;
      if (grant.tickets > 0) {
        const walletResult = await Profile.findByIdAndUpdate(profile._id, {
          $inc: { referralTierAwardedTickets: grant.tickets },
        });
        if (walletResult) {
          awardCredited = true;
          void invalidateUser(profile._id.toString()).catch(() => {});
        }
      }

      const claimed = await ReferralPurchase.findOneAndUpdate(
        { _id: purchase._id, ticketsAwarded: 0 },
        {
          $set: {
            ticketsAwarded: grant.tickets,
            ticketsAwardedAt: new Date(),
            ...(tierAtAward != null ? { tierAtAward } : {}),
          },
        },
        { new: true }
      );

      if (!claimed) {
        if (awardCredited) {
          await Profile.findByIdAndUpdate(profile._id, {
            $inc: { referralTierAwardedTickets: -grant.tickets },
          }).catch((rollbackErr) => {
            log.error("wallet rollback failed after purchase race condition", {
              err: rollbackErr,
              profileId: profile._id.toString(),
              tickets: grant.tickets,
            });
          });
          void invalidateUser(profile._id.toString()).catch(() => {});
        }
        continue;
      }

      if (awardCredited) ticketsGranted += grant.tickets;
      purchasesCredited += 1;
    }
  }

  await Profile.findByIdAndUpdate(profile._id, {
    $set: {
      referralTierLastUpdated: new Date(),
      referralTierThresholdsAwarded: [...awardedThresholds],
    },
  });
  void invalidateUser(profile._id.toString()).catch(() => {});

  const validCount = validUserIds.size;

  return { ticketsGranted, purchasesCredited, validCount, allocations: allAllocations };
}
