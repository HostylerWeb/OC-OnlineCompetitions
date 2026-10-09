import { dbConnect } from "@oc/api-db";
import {
  Balance,
  BonusAwardWin,
  Cart,
  ComplianceAuditLog,
  InstantPrizeWin,
  Order,
  PaymentAttempt,
  PushSubscription,
  ReferralPurchase,
  SelfExclusionOverrideRequest,
  ShopCart,
  ShopOrder,
  Ticket,
  Winner,
} from "@oc/api-db/models";
import { invalidateUser } from "@oc/api-infra/cache";
import mongoose from "mongoose";

export interface TransferResult {
  transferredCounts: Record<string, number>;
  totalRows: number;
}

export interface TransferCounts {
  Order: number;
  Ticket: number;
  ShopOrder: number;
  Cart: number;
  ShopCart: number;
  Balance: number;
  Winner: number;
  InstantPrizeWin: number;
  BonusAwardWin: number;
  ReferralPurchase: number;
  PushSubscription: number;
  PaymentAttempt: number;
  SelfExclusionOverrideRequest: number;
  ComplianceAuditLog: number;
}

const EMPTY_COUNTS: TransferCounts = {
  Order: 0,
  Ticket: 0,
  ShopOrder: 0,
  Cart: 0,
  ShopCart: 0,
  Balance: 0,
  Winner: 0,
  InstantPrizeWin: 0,
  BonusAwardWin: 0,
  ReferralPurchase: 0,
  PushSubscription: 0,
  PaymentAttempt: 0,
  SelfExclusionOverrideRequest: 0,
  ComplianceAuditLog: 0,
};

export async function computeWinCounts(userId: string): Promise<{
  competitionWinsCount: number;
  instantWinsCount: number;
  bonusWinsCount: number;
}> {
  await dbConnect();
  const oid = new mongoose.Types.ObjectId(userId);
  const [competitionWinsCount, instantWinsCount, bonusWinsCount] = await Promise.all([
    Winner.countDocuments({ userId: oid }).maxTimeMS(5000),
    InstantPrizeWin.countDocuments({ userId: oid }).maxTimeMS(5000),
    BonusAwardWin.countDocuments({ userId: oid }).maxTimeMS(5000),
  ]);
  return { competitionWinsCount, instantWinsCount, bonusWinsCount };
}

/**
 * Recompute totalEntries / totalSpent from ground truth after a data
 * transfer. totalEntries = owned tickets that belong to an order (purchased
 * entries; instant-prize granted tickets have no orderId and are excluded).
 * totalSpent = net order totals (amount actually charged) for completed
 * orders, matching the net-charged semantics of order-fulfillment.
 */
export async function computeProfileStats(userId: string): Promise<{
  totalEntries: number;
  totalSpent: number;
}> {
  await dbConnect();
  const oid = new mongoose.Types.ObjectId(userId);

  const [totalEntries, totalSpentAgg] = await Promise.all([
    Ticket.countDocuments({ ownerId: oid, orderId: { $exists: true, $ne: null } }).maxTimeMS(5000),
    Order.aggregate<{ total: number }>([
      { $match: { userId: oid, deletedAt: null, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]).exec(),
  ]);

  return { totalEntries, totalSpent: totalSpentAgg[0]?.total ?? 0 };
}

export async function transferProfileData(
  fromUserId: string,
  toUserId: string
): Promise<TransferResult> {
  await dbConnect();

  const fromOid = new mongoose.Types.ObjectId(fromUserId);
  const toOid = new mongoose.Types.ObjectId(toUserId);

  const updateMany = async (
    model: {
      updateMany: (
        filter: Record<string, unknown>,
        update: Record<string, unknown>
      ) => Promise<{ modifiedCount: number }>;
    },
    filter: Record<string, unknown>,
    update: Record<string, unknown>
  ): Promise<number> => {
    try {
      const result = await model.updateMany(filter, update);
      return result.modifiedCount ?? 0;
    } catch {
      return 0;
    }
  };

  // Cart has a unique userId index — reassigning a guest cart onto a target
  // that already owns a cart would E11000. Merge instead, keeping the target's
  // cart as the surviving row.
  let cartTransferred = 0;
  try {
    const [sourceCart, targetCart] = await Promise.all([
      Cart.findOne({ userId: fromOid }).lean(),
      Cart.findOne({ userId: toOid }).lean(),
    ]);
    if (sourceCart) {
      if (!targetCart) {
        const moved = await Cart.updateOne(
          { _id: sourceCart._id, userId: fromOid },
          { $set: { userId: toOid } }
        );
        cartTransferred = moved.modifiedCount ?? 0;
      } else {
        const { mergeCartItem } = await import("@oc/api-tickets/cart");
        const mergedItems = sourceCart.items.reduce(
          (acc, item) => mergeCartItem(acc, item),
          targetCart.items
        );
        const update: Record<string, unknown> = {
          items: mergedItems,
          walletTicketsByCompetition: [
            ...(targetCart.walletTicketsByCompetition ?? []),
            ...(sourceCart.walletTicketsByCompetition ?? []),
          ],
          cartVersion: (targetCart.cartVersion ?? 0) + 1,
          lastActivityAt: new Date(),
        };
        if (!targetCart.promoCode && sourceCart.promoCode) {
          update.promoCode = sourceCart.promoCode;
          update.promoCodeId = sourceCart.promoCodeId;
          update.promoDiscountPercent = sourceCart.promoDiscountPercent;
          update.discountAmount = sourceCart.discountAmount;
          update.discountType = sourceCart.discountType;
          update.promoCodeGuestEligible = sourceCart.promoCodeGuestEligible;
        }
        if (!targetCart.referralCode && sourceCart.referralCode) {
          update.referralCode = sourceCart.referralCode;
          update.referralDiscountAmount = sourceCart.referralDiscountAmount;
          update.referralDiscountPercent = sourceCart.referralDiscountPercent;
        }
        await Cart.updateOne({ _id: targetCart._id }, { $set: update });
        await Cart.deleteOne({ _id: sourceCart._id });
        cartTransferred = 1;
      }
    }
  } catch (cartErr) {
    console.warn("[transferProfileData] cart merge failed:", cartErr);
  }

  // Balance has a unique userId index — sum balances when the target already
  // owns one, otherwise reassign ownership.
  let balanceTransferred = 0;
  try {
    const [sourceBalance, targetBalance] = await Promise.all([
      Balance.findOne({ userId: fromOid }).lean(),
      Balance.findOne({ userId: toOid }).lean(),
    ]);
    if (sourceBalance) {
      if (!targetBalance) {
        const moved = await Balance.updateOne(
          { _id: sourceBalance._id, userId: fromOid },
          { $set: { userId: toOid } }
        );
        balanceTransferred = moved.modifiedCount ?? 0;
      } else {
        await Balance.updateOne(
          { _id: targetBalance._id },
          {
            $inc: {
              available: sourceBalance.available ?? 0,
              pending: sourceBalance.pending ?? 0,
            },
          }
        );
        await Balance.deleteOne({ _id: sourceBalance._id });
        balanceTransferred = 1;
      }
    }
  } catch (balanceErr) {
    console.warn("[transferProfileData] balance merge failed:", balanceErr);
  }

  const results = await Promise.allSettled([
    updateMany(Order, { userId: fromOid }, { $set: { userId: toOid } }),
    updateMany(Ticket, { ownerId: fromOid }, { $set: { ownerId: toOid } }),
    updateMany(ShopOrder, { userId: fromOid }, { $set: { userId: toOid, isGuestCheckout: false } }),
    updateMany(ShopCart, { userId: fromOid }, { $set: { userId: toOid } }),
    updateMany(Winner, { userId: fromOid }, { $set: { userId: toOid } }),
    updateMany(InstantPrizeWin, { userId: fromOid }, { $set: { userId: toOid } }),
    updateMany(BonusAwardWin, { userId: fromOid }, { $set: { userId: toOid } }),
    updateMany(ReferralPurchase, { referredUserId: fromOid }, { $set: { referredUserId: toOid } }),
    updateMany(PushSubscription, { userId: fromOid }, { $set: { userId: toOid } }),
    updateMany(PaymentAttempt, { userId: fromOid }, { $set: { userId: toOid } }),
    updateMany(SelfExclusionOverrideRequest, { userId: fromOid }, { $set: { userId: toOid } }),
    updateMany(ComplianceAuditLog, { targetUserId: fromOid }, { $set: { targetUserId: toOid } }),
    updateMany(ComplianceAuditLog, { actorId: fromOid }, { $set: { actorId: toOid } }),
  ]);

  void invalidateUser(fromUserId).catch(() => {});
  void invalidateUser(toUserId).catch(() => {});

  const names = Object.keys(EMPTY_COUNTS) as (keyof TransferCounts)[];
  const transferredCounts: Record<string, number> = {};
  let totalRows = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    let count = 0;
    if (r.status === "fulfilled") count = r.value;
    const key = i < names.length ? String(names[i]) : `model_${i}`;
    transferredCounts[key] = count;
    totalRows += count;
  }

  transferredCounts.Cart = cartTransferred;
  transferredCounts.Balance = balanceTransferred;
  totalRows += cartTransferred + balanceTransferred;

  return { transferredCounts, totalRows };
}

export async function verifyTransfer(
  preTransferCounts: Record<string, number>,
  toUserId: string
): Promise<{
  ok: boolean;
  diffs: Record<string, { expected: number; actual: number }>;
}> {
  await dbConnect();
  const oid = new mongoose.Types.ObjectId(toUserId);

  const queries: Record<string, () => Promise<number>> = {
    Order: () => Order.countDocuments({ userId: oid }).maxTimeMS(5000),
    Ticket: () => Ticket.countDocuments({ ownerId: oid }).maxTimeMS(5000),
    ShopOrder: () => ShopOrder.countDocuments({ userId: oid }).maxTimeMS(5000),
    Cart: () => Cart.countDocuments({ userId: oid }).maxTimeMS(5000),
    ShopCart: () => ShopCart.countDocuments({ userId: oid }).maxTimeMS(5000),
    Balance: () => Balance.countDocuments({ userId: oid }).maxTimeMS(5000),
    Winner: () => Winner.countDocuments({ userId: oid }).maxTimeMS(5000),
    InstantPrizeWin: () => InstantPrizeWin.countDocuments({ userId: oid }).maxTimeMS(5000),
    BonusAwardWin: () => BonusAwardWin.countDocuments({ userId: oid }).maxTimeMS(5000),
    ReferralPurchase: () =>
      ReferralPurchase.countDocuments({ referredUserId: oid }).maxTimeMS(5000),
    PushSubscription: () => PushSubscription.countDocuments({ userId: oid }).maxTimeMS(5000),
    PaymentAttempt: () => PaymentAttempt.countDocuments({ userId: oid }).maxTimeMS(5000),
    SelfExclusionOverrideRequest: () =>
      SelfExclusionOverrideRequest.countDocuments({ userId: oid }).maxTimeMS(5000),
  };

  const diffs: Record<string, { expected: number; actual: number }> = {};
  let ok = true;

  for (const [model, queryFn] of Object.entries(queries)) {
    const expected = preTransferCounts[model] ?? 0;
    const actual = await queryFn();
    if (actual !== expected) {
      ok = false;
      diffs[model] = { expected, actual };
    }
  }

  return { ok, diffs };
}
