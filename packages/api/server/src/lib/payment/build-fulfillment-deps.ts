import {
  Balance,
  BalanceTransaction,
  Competition,
  CompetitionInstantPrize,
  InstantPrizeWin,
  Order,
  OrderItem,
  Profile,
} from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import type { OrderFulfillmentDeps } from "@oc/api-payment-core";
import { recordReferralPurchase } from "@oc/api-referrals";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { processBonusAwardFires } from "@oc/api-tickets/bonus-award-draw";
import { checkInstantWins } from "@oc/api-tickets/instant-prize-utils";
import { reservePromoCodeUsage } from "@oc/api-tickets/promo-codes";
import {
  claimTicketsForOrder,
  releaseByOrderId,
  transferHeldToOwner,
} from "@oc/api-tickets/ticket-service";
import { Types } from "mongoose";
import { sendInstantWinEmail, sendOrderConfirmationEmail } from "../orders";
import { notifyBonusAwardWins } from "./notify-bonus-award-wins";
import { rollbackOrderFulfillment } from "./rollback-order-fulfillment";

export interface BuildFulfillmentDepsOptions {
  sendEmails?: boolean;
  includeBalance?: boolean;
  isGuest?: boolean;
}

export function buildFulfillmentDeps(
  options: BuildFulfillmentDepsOptions = {}
): OrderFulfillmentDeps {
  const sendEmails = options.sendEmails ?? true;
  const includeBalance = options.includeBalance ?? true;
  const isGuest = options.isGuest;

  log.debug(
    `[buildFulfillmentDeps.enter] sendEmails=${sendEmails} includeBalance=${includeBalance}`
  );

  return {
    claimTicketsForOrder: async (params) => {
      log.debug(
        `[buildFulfillmentDeps.claimTicketsForOrder] orderId=${params.orderId} competitionId=${params.competitionId} qty=${params.qty}`
      );
      const result = await claimTicketsForOrder(params);
      log.debug(
        `[buildFulfillmentDeps.claimTicketsForOrder] orderId=${params.orderId} numbers.length=${result.numbers.length}`
      );
      return result;
    },
    releaseByOrderId: async (orderId, session) => releaseByOrderId(orderId, session),
    rollbackOrderFulfillment: async (params) => rollbackOrderFulfillment(params),
    createInstantPrizeWin: async (win) => {
      return (await InstantPrizeWin.create(
        win as Parameters<typeof InstantPrizeWin.create>[0]
      )) as { _id: Types.ObjectId };
    },
    updateInstantPrizeWinGrantedTickets: async (winId, grantedTicketIds, session) => {
      await InstantPrizeWin.findByIdAndUpdate(
        winId,
        {
          $set: { grantedTicketIds, grantedEntryIds: grantedTicketIds },
        },
        session ? { session } : {}
      );
    },
    markInstantPrizeWinClaimed: async (winId, session) => {
      const update: Record<string, unknown> = { claimed: true, claimedAt: new Date() };
      await InstantPrizeWin.findByIdAndUpdate(winId, { $set: update }, session ? { session } : {});
    },
    updateCompetitionInstantPrizeClaimedCount: async (id, session) => {
      await CompetitionInstantPrize.findOneAndUpdate(
        { _id: id, $expr: { $lt: ["$claimedCount", "$quantity"] } },
        { $inc: { claimedCount: 1 } },
        session ? { session } : {}
      );
    },
    updateProfileStats: async (userId, totalEntries, totalSpent, session) => {
      const profileUpdateResult = await Profile.findByIdAndUpdate(
        userId,
        {
          $inc: { totalEntries, totalSpent },
        },
        session ? { session } : {}
      );
      if (!profileUpdateResult) {
        console.warn(`[fulfillment] Profile not found for userId=${userId} during stat increment`);
      }
    },
    updateProfileAddress: async (userId, address) => {
      const addressUpdateResult = await Profile.findByIdAndUpdate(userId, {
        $set: {
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          postcode: address.postcode,
          country: address.country,
        },
      });
      if (!addressUpdateResult) {
        console.warn(`[fulfillment] Profile not found for userId=${userId} during address update`);
      }
    },
    createOrderItems: async (items, session) => {
      log.debug(`[buildFulfillmentDeps.createOrderItems] items.length=${items.length}`);
      if (items.length > 0) {
        log.debug(
          `[buildFulfillmentDeps.createOrderItems] firstItem orderId=${items[0]!.orderId} competitionId=${items[0]!.competitionId} quantity=${items[0]!.quantity}`
        );
      }
      await OrderItem.insertMany(
        items.map((item) => ({
          orderId: item.orderId,
          competitionId: new Types.ObjectId(item.competitionId),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          ticketNumbers: item.ticketNumbers,
          answerIndex: item.answerIndex,
        })),
        session ? { session, ordered: false } : { ordered: false }
      );
      log.debug(`[buildFulfillmentDeps.createOrderItems] insertedCount=${items.length}`);
    },
    findCompetitionsByIds: async (ids) => {
      const competitions = await Competition.find({ _id: { $in: ids } })
        .select("title ticketPrice status questionOptions correctAnswer")
        .lean();
      return new Map(
        competitions.map((competition) => [
          competition._id.toString(),
          {
            title: competition.title,
            ticketPrice: competition.ticketPrice,
            status: competition.status,
            questionOptions: competition.questionOptions,
            correctAnswer: competition.correctAnswer,
          },
        ])
      );
    },
    updateBalance: includeBalance
      ? async (userId, amount, session) => {
          return await Balance.findOneAndUpdate(
            { userId },
            { $inc: { available: amount } },
            { returnDocument: "after", upsert: false, ...(session ? { session } : {}) }
          );
        }
      : async () => null,
    updateBalanceTransaction: includeBalance
      ? async (transactionId, status, balanceAfter, session) => {
          await BalanceTransaction.findOneAndUpdate(
            { _id: transactionId },
            { $set: { status, balanceAfter } },
            session ? { session } : {}
          );
        }
      : async () => {},
    checkInstantWins,
    sendInstantWinEmail: sendEmails
      ? async (params) => {
          void sendInstantWinEmail({
            userId: params.userId,
            wins: params.wins,
            isGuest,
          }).catch((err) => {
            console.error("[fulfillment] sendInstantWinEmail failed:", err);
          });
        }
      : async () => {},
    onInstantWinGranted: (params) => {
      const firstWin = params.wins[0];
      if (firstWin) {
        void sendPushNotification(
          {
            title: "Instant win!",
            body: `You won ${firstWin.prizeTitle}${firstWin.prizeValue ? ` valued at £${firstWin.prizeValue.toLocaleString()}` : ""}!`,
            type: "draw_result",
            url: "/dashboard/wins",
            tag: `instant-${params.userId}-${Date.now()}`,
          },
          { userId: params.userId }
        ).catch(() => {});
      }
    },
    notifyPendingBonusAwardFires: async ({ assignedNumbers, session }) => {
      const compIds = [...new Set(assignedNumbers.map((a) => a.competitionId).filter(Boolean))];
      console.log(
        "[bonus-award] notifyPendingBonusAwardFires: compIds=%s isGuest=%s assignedCount=%d",
        compIds.join(","),
        isGuest,
        assignedNumbers.length
      );
      console.log(
        "[BONUS-DIAG] notifyPendingBonusAwardFires: assignedNumbers=%j",
        assignedNumbers.map((a) => ({ compId: a.competitionId, ticketNumbers: a.ticketNumbers }))
      );
      if (compIds.length === 0) return;

      console.log(
        "[bonus-award] notifyPendingBonusAwardFires: calling processBonusAwardFires compCount=%d",
        compIds.length
      );
      await processBonusAwardFires({
        competitionIds: compIds,
        session,
        isGuest,
        onWins: async (wins, pendingFires, competitionName) => {
          await notifyBonusAwardWins({ wins, pendingFires, competitionName });
        },
      });
    },
    sendOrderConfirmationEmail: sendEmails
      ? async (params) => {
          void sendOrderConfirmationEmail({ ...params, isGuest }).catch((err) => {
            console.error("[fulfillment] sendOrderConfirmationEmail failed:", err);
          });
        }
      : async () => {},
    recordReferralPurchase: async (params) => {
      log.debug(
        `[buildFulfillmentDeps.recordReferralPurchase] buyerUserId=${params.buyerUserId} orderId=${params.orderId} quantity=${params.quantity}`
      );
      await recordReferralPurchase({
        ...params,
        isGuestCheckout: params.isGuestCheckout ?? isGuest,
        onAwarded: (result) => {
          const competitionCount = result.competitionCount ?? 0;
          const body =
            competitionCount > 0
              ? `You earned ${result.ticketsGranted} tickets across ${competitionCount} competitions from your referral!`
              : `You earned ${result.ticketsGranted} referral tickets!`;
          void sendPushNotification(
            {
              title: "Referral reward!",
              body,
              type: "system",
              url: "/dashboard/tickets",
              tag: `referral-${result.referrerUserId}`,
            },
            { userId: result.referrerUserId }
          ).catch(() => {});
        },
      });
    },
    recordFailedReferral: async (params) => {
      log.debug(
        `[buildFulfillmentDeps.recordFailedReferral] orderId=${params.orderId} error=${params.error}`
      );
      await Order.findByIdAndUpdate(params.orderId, {
        $set: {
          "metadata.referralFailed": true,
          "metadata.referralError": params.error,
        },
      });
    },
    debitReferralWallet: async (userId, amount, session) => {
      log.debug(`[buildFulfillmentDeps.debitReferralWallet] userId=${userId} amount=${amount}`);
      const updated = await Profile.findOneAndUpdate(
        {
          _id: userId,
          referralTierAwardedTickets: { $gte: amount },
        },
        { $inc: { referralTierAwardedTickets: -amount } },
        { returnDocument: "after", ...(session ? { session } : {}) }
      );
      log.debug(
        `[buildFulfillmentDeps.debitReferralWallet] userId=${userId} success=${Boolean(updated)} remaining=${updated?.referralTierAwardedTickets}`
      );
      return Boolean(updated);
    },
    findOrderById: async (id) => {
      return (await Order.findById(id).lean()) as {
        _id: Types.ObjectId;
        userId: Types.ObjectId;
        metadata?: Record<string, unknown>;
      } | null;
    },
    findCipById: async (id) => {
      const cip = await CompetitionInstantPrize.findById(id).lean();
      if (!cip) return null;
      const grantedTicketIds =
        (cip.grantedTicketIds?.length ? cip.grantedTicketIds : cip.grantedEntryIds) ?? [];
      return {
        _id: cip._id,
        competitionInstantPrizeId: cip._id,
        winningEntryNumbers: cip.winningEntryNumbers,
        grantedTicketIds: grantedTicketIds as Types.ObjectId[],
      };
    },
    transferHeldTicketsToOwner: async (
      cipId,
      winIndex,
      ticketCount,
      userId,
      instantPrizeWinId,
      grantedTicketIds,
      session
    ) => {
      return transferHeldToOwner(
        cipId,
        winIndex,
        ticketCount,
        userId,
        grantedTicketIds,
        instantPrizeWinId,
        session
      );
    },
  };
}

export async function reserveCheckoutPromoCode(
  promoCode: string | undefined,
  userId: string,
  orderId?: string
): Promise<boolean> {
  if (promoCode) {
    const result = await reservePromoCodeUsage(promoCode, userId, orderId);
    return result !== null;
  }
  return true;
}

const log = createLogger("fulfillment");
