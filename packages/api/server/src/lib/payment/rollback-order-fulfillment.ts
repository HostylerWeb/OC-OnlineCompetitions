import {
  BonusAward,
  BonusAwardFire,
  BonusAwardWin,
  CompetitionBonusAwardAssignment,
  CompetitionInstantPrize,
  InstantPrizeWin,
  Order,
  OrderItem,
  Profile,
  Ticket,
} from "@oc/api-db/models";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import { createLogger } from "@oc/api-logger";
import { releasePromoCodeUsage } from "@oc/api-tickets/promo-codes";
import { releaseByOrderId, revertGrantedSoldTickets } from "@oc/api-tickets/ticket-service";
import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

export interface RollbackOrderFulfillmentParams {
  orderId: string;
  userId: string;
  profileStatsDelta?: { entries: number; spent: number };
  referralBalanceUsed?: number;
  promoCode?: string;
  session?: ClientSession;
  completedSteps?: string[];
}

export async function rollbackOrderFulfillment(
  params: RollbackOrderFulfillmentParams
): Promise<void> {
  log.debug(`[rollback.start]`, {
    orderId: params.orderId,
    reason: params.promoCode ? `promoCode=${params.promoCode}` : "fulfillment error",
    profileStatsDelta: params.profileStatsDelta,
    referralBalanceUsed: params.referralBalanceUsed,
  });
  const { orderId, userId, profileStatsDelta, promoCode, session, completedSteps } = params;
  const orderIdObj = new Types.ObjectId(orderId);

  const order = await Order.findById(orderIdObj).select("fulfillmentStatus").lean();
  if (order?.fulfillmentStatus === "rolled_back") {
    log.debug(`[rollback.skip] order ${orderId} already rolled back`);
    return;
  }
  const actionsTaken: string[] = [];
  const hasStep = (step: string) => !completedSteps || completedSteps.includes(step);

  if (hasStep("ticket_claim")) {
    const ticketQuery = Ticket.find({ orderId: orderIdObj }).select("_id").lean();
    const ticketIds = session ? await ticketQuery.session(session) : await ticketQuery;

    if (ticketIds.length > 0) {
      const ticketObjectIds = ticketIds.map((t) => t._id);

      try {
        const winQuery = InstantPrizeWin.find({ entryId: { $in: ticketObjectIds } })
          .select("competitionInstantPrizeId grantedTicketIds")
          .lean();
        const wins = session ? await winQuery.session(session) : await winQuery;

        const claimedCountByCip = new Map<string, number>();
        for (const win of wins) {
          const cipId = win.competitionInstantPrizeId.toString();
          claimedCountByCip.set(cipId, (claimedCountByCip.get(cipId) ?? 0) + 1);

          const grantedIds = win.grantedTicketIds ?? [];
          if (grantedIds.length > 0) {
            await revertGrantedSoldTickets(
              grantedIds,
              win.competitionInstantPrizeId,
              session ?? undefined
            );
          }
        }

        await (session
          ? InstantPrizeWin.deleteMany({
              entryId: { $in: ticketObjectIds },
            }).session(session)
          : InstantPrizeWin.deleteMany({
              entryId: { $in: ticketObjectIds },
            }));

        for (const [cipId, count] of claimedCountByCip) {
          await CompetitionInstantPrize.findByIdAndUpdate(
            cipId,
            { $inc: { claimedCount: -count } },
            session ? { session } : {}
          );
        }
      } catch (err: unknown) {
        console.error(`[rollback] InstantPrizeWin cleanup failed for order ${orderId}:`, err);
        log.debug(`[rollback.error] InstantPrizeWin cleanup failed`, {
          orderId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      try {
        const bonusWinsQuery = BonusAwardWin.find({
          entryId: { $in: ticketObjectIds },
          deletedAt: null,
        }).lean();
        const bonusWins = session ? await bonusWinsQuery.session(session) : await bonusWinsQuery;

        console.log(
          "[rollback] bonusAwardWins found: orderId=%s count=%d",
          orderId,
          bonusWins.length
        );

        if (bonusWins.length > 0) {
          const bonusWinIds = bonusWins.map((w) => w._id);

          await (session
            ? BonusAwardWin.updateMany(
                { _id: { $in: bonusWinIds } },
                { $set: { deletedAt: new Date() } }
              ).session(session)
            : BonusAwardWin.updateMany(
                { _id: { $in: bonusWinIds } },
                { $set: { deletedAt: new Date() } }
              ));

          console.log(
            "[rollback] bonusAwardWins soft-deleted: orderId=%s count=%d",
            orderId,
            bonusWins.length
          );

          const fireIds = [...new Set(bonusWins.map((w) => w.bonusAwardFireId.toString()))].map(
            (id) => new Types.ObjectId(id)
          );
          await (session
            ? BonusAwardFire.updateMany(
                { _id: { $in: fireIds } },
                { $set: { status: "pending" }, $unset: { drawnAt: 1 } }
              ).session(session)
            : BonusAwardFire.updateMany(
                { _id: { $in: fireIds } },
                { $set: { status: "pending" }, $unset: { drawnAt: 1 } }
              ));

          console.log(
            "[rollback] bonusAwardFires reset to pending: orderId=%s fireIds=%s",
            orderId,
            fireIds.join(",")
          );

          const winsByAssignment = new Map<string, number>();
          const winsByAward = new Map<string, number>();
          for (const win of bonusWins) {
            const assignId = win.assignmentId.toString();
            winsByAssignment.set(assignId, (winsByAssignment.get(assignId) ?? 0) + 1);
            const awardId = win.bonusAwardId.toString();
            winsByAward.set(awardId, (winsByAward.get(awardId) ?? 0) + 1);
          }

          for (const [assignId, count] of winsByAssignment) {
            const filter = { _id: new Types.ObjectId(assignId), wonCount: { $gte: count } };
            const result = await (session
              ? CompetitionBonusAwardAssignment.updateOne(filter, {
                  $inc: { wonCount: -count },
                }).session(session)
              : CompetitionBonusAwardAssignment.updateOne(filter, { $inc: { wonCount: -count } }));
            if (result.modifiedCount === 0) {
              console.warn(
                "[rollback] wonCount underflow prevented: assignmentId=%s attempted=%d",
                assignId,
                count
              );
            }
            console.log(
              "[rollback] bonusAwardAssignment wonCount decremented: assignmentId=%s count=%d",
              assignId,
              count
            );
          }

          for (const [awardId, count] of winsByAward) {
            const filter = { _id: new Types.ObjectId(awardId), totalWins: { $gte: count } };
            const result = await (session
              ? BonusAward.updateOne(filter, { $inc: { totalWins: -count } }).session(session)
              : BonusAward.updateOne(filter, { $inc: { totalWins: -count } }));
            if (result.modifiedCount === 0) {
              console.warn(
                "[rollback] totalWins underflow prevented: awardId=%s attempted=%d",
                awardId,
                count
              );
            }
            console.log(
              "[rollback] bonusAward totalWins decremented: awardId=%s count=%d",
              awardId,
              count
            );
          }
        }
      } catch (err: unknown) {
        console.error(`[rollback] BonusAwardWin cleanup failed for order ${orderId}:`, err);
        log.debug(`[rollback.error] BonusAwardWin cleanup failed`, {
          orderId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      console.log("[rollback] bonusAwardWin cleanup complete: orderId=%s", orderId);
    } else {
      log.debug(
        `[rollback] no tickets found for order ${orderId}, skipping InstantPrizeWin cleanup`
      );
    }
  }

  if (hasStep("ticket_claim")) {
    try {
      await releaseByOrderId(orderId, session);
      actionsTaken.push("releaseByOrderId");
      log.debug(`[rollback] released tickets for order ${orderId}`);
    } catch (err: unknown) {
      console.error(`[rollback] releaseByOrderId failed for order ${orderId}:`, err);
      log.debug(`[rollback.error] releaseByOrderId failed`, {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (hasStep("order_items")) {
    try {
      await (session
        ? OrderItem.deleteMany({ orderId: orderIdObj }).session(session)
        : OrderItem.deleteMany({ orderId: orderIdObj }));
      actionsTaken.push("OrderItem.deleteMany");
      log.debug(`[rollback] deleted OrderItems for order ${orderId}`);
    } catch (err: unknown) {
      console.error(`[rollback] OrderItem delete failed for order ${orderId}:`, err);
      log.debug(`[rollback.error] OrderItem delete failed`, {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (
    hasStep("profile_stats") &&
    profileStatsDelta &&
    (profileStatsDelta.entries !== 0 || profileStatsDelta.spent !== 0)
  ) {
    try {
      await Profile.findByIdAndUpdate(
        userId,
        {
          $inc: {
            totalEntries: -profileStatsDelta.entries,
            totalSpent: -profileStatsDelta.spent,
          },
        },
        session ? { session } : {}
      );
      actionsTaken.push("Profile.stats.reversal");
      log.debug(`[rollback] reversed profile stats for order ${orderId}`, {
        entries: -profileStatsDelta.entries,
        spent: -profileStatsDelta.spent,
      });
    } catch (err: unknown) {
      console.error(`[rollback] Profile stats reversal failed for order ${orderId}:`, err);
      log.debug(`[rollback.error] Profile stats reversal failed`, {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (hasStep("referral_balance") && params.referralBalanceUsed && params.referralBalanceUsed > 0) {
    try {
      await Profile.findByIdAndUpdate(
        userId,
        { $inc: { referralTierAwardedTickets: params.referralBalanceUsed } },
        session ? { session } : {}
      );
      actionsTaken.push("Profile.referralBalanceUsed.restore");
      log.debug(`[rollback] restored referral balance for order ${orderId}`, {
        referralBalanceUsed: params.referralBalanceUsed,
      });
    } catch (err: unknown) {
      console.error(`[rollback] Referral wallet restore failed for order ${orderId}:`, err);
      log.debug(`[rollback.error] Referral wallet restore failed`, {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (hasStep("promo_code") && promoCode) {
    try {
      await releasePromoCodeUsage(promoCode, userId);
      actionsTaken.push("releasePromoCodeUsage");
      log.debug(`[rollback] released promo code for order ${orderId}`, { promoCode });
    } catch (err: unknown) {
      console.error(`[rollback] Promo code release failed for order ${orderId}:`, err);
      log.debug(`[rollback.error] Promo code release failed`, {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    await Order.findByIdAndUpdate(
      orderIdObj,
      { fulfillmentStatus: "rolled_back" },
      session ? { session } : {}
    );
    actionsTaken.push("Order.fulfillmentStatus->rolled_back");
  } catch (err: unknown) {
    console.error(
      `[rollback] failed to update order fulfillment status for order ${orderId}:`,
      err
    );
    log.debug(`[rollback.error] Order fulfillmentStatus update failed`, {
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.debug(`[rollback.complete]`, { orderId, actionsTaken });

  // Invalidate all affected caches after rollback
  void invalidateByChannelSafe(
    CH.competitionAvailability,
    CH.competitionsAvailabilityBatch,
    CH.competitionBuyingPower,
    CH.competitionsBuyingPowerBatch,
    CH.competitions,
    CH.competitionDetail,
    CH.competitionFeatured,
    CH.landingPage,
    CH.entries,
    CH.stats,
    CH.instantPrizes,
    CH.bonusAwardAssignments,
    CH.bonusAwardTemplates,
    CH.bonusAwardWins
  ).catch(() => {});
  void invalidateUser(params.userId).catch(() => {});
}

const log = createLogger("rollback");
