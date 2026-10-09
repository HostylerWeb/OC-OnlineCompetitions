import {
  Balance,
  BalanceTransaction,
  Competition,
  ComplianceAuditLog,
  InstantPrizeWin,
  Profile,
  Ticket,
} from "@oc/api-db/models";
import type { ComplianceAuditSource } from "@oc/api-db/models/ComplianceAuditLog";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import { releasePromoCodeUsage } from "@oc/api-tickets/promo-codes";
import { invalidateReferralPurchaseForOrder } from "@oc/api-referrals";
import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

export function buildRefundDeps() {
  return {
    findOrderById: async (id: string) => {
      const { Order } = await import("@oc/api-db/models");
      return Order.findById(id).lean();
    },
    releaseTickets: async (orderId: string, session?: ClientSession) => {
      const tickets = await Ticket.find({
        orderId: new Types.ObjectId(orderId),
        status: "sold",
      }).lean();
      const competitionMap = new Map<string, number>();
      for (const t of tickets) {
        const cid = t.competitionId.toString();
        competitionMap.set(cid, (competitionMap.get(cid) ?? 0) + 1);
      }
      await Ticket.updateMany(
        { orderId: new Types.ObjectId(orderId), status: "sold" },
        {
          $set: { status: "available" },
          $unset: {
            ownerId: 1,
            orderId: 1,
            answerIndex: 1,
            answerCorrect: 1,
            reservedAt: 1,
            soldAt: 1,
            instantPrizeWinId: 1,
          },
        },
        { session }
      );
      return Array.from(competitionMap.entries()).map(([competitionId, releasedCount]) => ({
        competitionId,
        releasedCount,
      }));
    },
    decrementCompetitionTicketsSold: async (
      competitionId: string,
      count: number,
      session?: ClientSession
    ) => {
      await Competition.updateOne(
        { _id: competitionId },
        { $inc: { ticketsSold: -count } },
        { session }
      );
    },
    rollbackProfileStats: async (
      userId: string,
      totalSpent: number,
      totalEntries: number,
      session?: ClientSession
    ) => {
      await Profile.updateOne(
        { _id: userId },
        { $inc: { totalSpent: -totalSpent, totalEntries: -totalEntries } },
        { session }
      );
    },
    restoreReferralWallet: async (userId: string, amount: number, session?: ClientSession) => {
      await Profile.updateOne(
        { _id: userId },
        { $inc: { referralTierAwardedTickets: amount } },
        { session }
      );
    },
    releasePromoCode: async (code: string, userId: string, session?: ClientSession) => {
      await releasePromoCodeUsage(code, userId, session);
    },
    createBalanceRefundTransaction: async (userId: string, orderId: string, amount: number) => {
      const balance = await Balance.findOne({ userId });
      const available = balance?.available ?? 0;
      await BalanceTransaction.create({
        userId,
        type: "purchase_refund",
        amount,
        balanceBefore: available,
        balanceAfter: available + amount,
        status: "completed",
        orderId,
        idempotencyKey: `site-credit-purchase-refund:${orderId}`,
      });
      await Balance.updateOne({ userId }, { $inc: { available: amount } });
    },
    removeInstantPrizeWins: async (orderId: string, session?: ClientSession) => {
      const tickets = await Ticket.find({ orderId: new Types.ObjectId(orderId) })
        .select("_id")
        .lean();
      const ticketIds = tickets.map((t) => t._id);
      if (ticketIds.length > 0) {
        await InstantPrizeWin.deleteMany({ entryId: { $in: ticketIds } }, { session });
      }
    },
    invalidateReferralPurchase: async (orderId: string) => {
      await invalidateReferralPurchaseForOrder(orderId);
    },
    createAuditLog: async (params: {
      actorId: string | null;
      targetUserId: string;
      action: string;
      reason: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
      source: ComplianceAuditSource;
    }) => {
      await ComplianceAuditLog.create(params);
    },
    invalidateUserCache: async (userId: string) => {
      await invalidateUser(userId);
    },
    invalidatePublicCaches: async () => {
      await invalidateByChannelSafe(
        CH.competitionAvailability,
        CH.competitionsAvailabilityBatch,
        CH.competitionBuyingPower,
        CH.competitionsBuyingPowerBatch,
        CH.competitions,
        CH.competitionDetail,
        CH.competitionFeatured,
        CH.winners,
        CH.winnersByCompetition,
        CH.entries,
        CH.stats
      );
    },
  };
}
