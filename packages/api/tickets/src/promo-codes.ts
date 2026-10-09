import type { DiscountType } from "@oc/api-db/models";
import { Order, Profile, PromoCode, PromoRedemption, ReferralSettings } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import mongoose from "mongoose";

const log = createLogger("promo-codes");

function promoActiveAtConditions(now: Date): Record<string, unknown>[] {
  return [
    {
      $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: now } }],
    },
    {
      $or: [{ validUntil: { $exists: false } }, { validUntil: null }, { validUntil: { $gte: now } }],
    },
  ];
}

function countUserPromoUses(usedBy: unknown, userId: string): number {
  if (!Array.isArray(usedBy)) return 0;
  return usedBy.filter((u) => String(u) === userId).length;
}

export interface ValidatePromoCodeResult {
  valid: boolean;
  error?: string;
  code?: string;
  discountValue?: number;
  discountAmount?: number;
  discountType?: DiscountType;
}

export function calculateReferralDiscountAmount(subtotal: number, discountPercent: number): number {
  return subtotal * (discountPercent / 100);
}

export async function validatePromoCode(
  code: string,
  subtotal: number,
  items?: Array<{ competitionId: string; quantity: number; unitPrice: number }>,
  userId?: string
): Promise<ValidatePromoCodeResult> {
  const normalizedCode = code.trim().toUpperCase();
  const promo = await PromoCode.findOne({ code: normalizedCode, isActive: true }).lean();
  if (!promo) return { valid: false, error: "Invalid promo code" };

  const now = new Date();
  if (promo.validFrom && promo.validFrom > now)
    return { valid: false, error: "Promo code is not yet valid" };
  if (promo.validUntil && promo.validUntil < now)
    return { valid: false, error: "Promo code has expired" };
  if (promo.maxUses != null && promo.currentUses >= promo.maxUses)
    return { valid: false, error: "Promo code has reached maximum uses" };

  if (userId) {
    const maxPerUser = promo.maxUsesPerUser ?? 1;
    const userUses = countUserPromoUses(promo.usedBy, userId);
    if (userUses >= maxPerUser) {
      return { valid: false, error: "You have already used this promo code" };
    }
  }

  if (!promo.competitionId && promo.minTickets != null && items) {
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
    if (totalQty < promo.minTickets) {
      return {
        valid: false,
        error: `Minimum ${promo.minTickets} ticket${promo.minTickets !== 1 ? "s" : ""} required for this promo code`,
      };
    }
  }

  if (promo.competitionId && items) {
    const promoCompId = promo.competitionId.toString();
    const matchingItems = items?.filter((i) => i.competitionId === promoCompId) ?? [];

    if (!matchingItems.length) {
      return { valid: false, error: "This promo code is not valid for items in your cart" };
    }

    if (promo.minTickets != null) {
      const totalQty = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
      if (totalQty < promo.minTickets) {
        return {
          valid: false,
          error: `Minimum ${promo.minTickets} ticket${promo.minTickets !== 1 ? "s" : ""} required for this promo code`,
        };
      }
    }

    const scopedSubtotal = matchingItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    if (promo.minOrderValue != null && scopedSubtotal < promo.minOrderValue) {
      return { valid: false, error: `Minimum order value is £${promo.minOrderValue}` };
    }

    const discountAmount =
      promo.discountType === "percentage"
        ? scopedSubtotal * (promo.discountValue / 100)
        : promo.discountValue;

    return {
      valid: true,
      code: promo.code,
      discountValue: promo.discountValue,
      discountAmount,
      discountType: promo.discountType,
    };
  }

  if (promo.minOrderValue != null && subtotal < promo.minOrderValue) {
    return { valid: false, error: `Minimum order value is £${promo.minOrderValue}` };
  }

  const discountAmount =
    promo.discountType === "percentage"
      ? subtotal * (promo.discountValue / 100)
      : promo.discountValue;

  return {
    valid: true,
    code: promo.code,
    discountValue: promo.discountValue,
    discountAmount,
    discountType: promo.discountType,
  };
}

export async function validatePendingReferralCode(
  code: string,
  subtotal: number,
  userId: string
): Promise<ValidatePromoCodeResult> {
  const buyerProfile = await Profile.findById(userId).lean();
  const normalizedCode = code.trim().toUpperCase();

  if (buyerProfile?.referredByCode) {
    if (normalizedCode !== buyerProfile.referredByCode.toUpperCase()) {
      return {
        valid: false,
        error: "Referral code must match your signup referral",
      };
    }
  }

  const completedOrders = await Order.countDocuments({
    userId,
    status: "completed",
  }).maxTimeMS(5000);
  if (completedOrders > 0) {
    return { valid: false, error: "Referral code has already been used" };
  }

  const profile = await Profile.findOne({ referralCode: normalizedCode }).lean();
  if (!profile) return { valid: false, error: "Invalid referral code" };

  if (userId && profile._id.toString() === userId) {
    return { valid: false, error: "You cannot use your own referral code" };
  }

  const settings = await ReferralSettings.findById("referral_settings").lean();
  if (settings?.refereeReward?.enabled === false) {
    return { valid: false, error: "Referral discounts are currently disabled" };
  }
  const minOrderValue = settings?.refereeReward?.minOrderValue ?? 0;
  if (subtotal < minOrderValue) {
    return { valid: false, error: `Minimum order value is £${minOrderValue}` };
  }

  const discountPercent = settings?.refereeReward?.discountPercent ?? 20;
  const discountAmount = calculateReferralDiscountAmount(subtotal, discountPercent);

  return {
    valid: true,
    code: profile.referralCode,
    discountValue: discountPercent,
    discountAmount,
    discountType: "percentage",
  };
}

export async function validateReferralCode(
  code: string,
  subtotal: number,
  userId: string,
  isReferredUser: boolean = false
): Promise<ValidatePromoCodeResult> {
  const normalizedCode = code.trim().toUpperCase();
  const profile = await Profile.findOne({ referralCode: normalizedCode }).lean();
  if (!profile) return { valid: false, error: "Invalid referral code" };

  if (profile._id.toString() === userId) {
    return { valid: false, error: "You cannot use your own referral code" };
  }

  const settings = await ReferralSettings.findById("referral_settings").lean();
  if (settings?.refereeReward?.enabled === false) {
    return { valid: false, error: "Referral discounts are currently disabled" };
  }

  if (!isReferredUser) {
    const completedOrders = await Order.countDocuments({
      userId,
      status: "completed",
    }).maxTimeMS(5000);
    if (completedOrders > 0) {
      return { valid: false, error: "Referral code has already been used" };
    }
  }

  const minOrderValue = settings?.refereeReward?.minOrderValue ?? 0;
  if (subtotal < minOrderValue) {
    return { valid: false, error: `Minimum order value is £${minOrderValue}` };
  }

  const discountPercent = settings?.refereeReward?.discountPercent ?? 20;
  const discountAmount = calculateReferralDiscountAmount(subtotal, discountPercent);

  return {
    valid: true,
    code: profile.referralCode,
    discountValue: discountPercent,
    discountAmount,
    discountType: "percentage",
  };
}

export async function releasePromoCodeUsage(
  code: string,
  userId: string,
  session?: import("mongoose").ClientSession
) {
  const normalizedCode = code.trim().toUpperCase();
  let query = PromoCode.findOne({ code: normalizedCode, isActive: true });
  if (session) query = query.session(session);
  const promo = await query;
  if (!promo) return null;

  if (promo.currentUses <= 0) {
    log.warn(
      `[releasePromoCodeUsage] failed to release usage for code=${code} userId=${userId} — currentUses already 0`
    );
    return promo;
  }

  const usedBy = Array.isArray(promo.usedBy) ? [...promo.usedBy.map((u) => String(u))] : [];
  let idx = -1;
  for (let i = usedBy.length - 1; i >= 0; i--) {
    if (usedBy[i] === userId) {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    log.warn(
      `[releasePromoCodeUsage] failed to release usage for code=${code} userId=${userId} — user not in usedBy`
    );
    return promo;
  }
  usedBy.splice(idx, 1);

  promo.currentUses = Math.max(0, promo.currentUses - 1);
  promo.usedBy = usedBy;
  await promo.save({ session });

  const redemptionDelete = PromoRedemption.deleteMany({
    promoCodeId: promo._id,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (session) redemptionDelete.session(session);
  await redemptionDelete;

  return promo;
}

async function recordPromoRedemption(
  promoCodeId: mongoose.Types.ObjectId,
  userId: string,
  orderId?: string
): Promise<void> {
  try {
    await PromoRedemption.create({
      promoCodeId,
      userId: new mongoose.Types.ObjectId(userId),
      ...(orderId ? { orderId: new mongoose.Types.ObjectId(orderId) } : {}),
    });
  } catch (err) {
    if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
      return;
    }
    throw err;
  }
}

export async function attachPromoRedemptionOrderId(
  code: string,
  userId: string,
  orderId: string
): Promise<void> {
  const normalizedCode = code.trim().toUpperCase();
  const promo = await PromoCode.findOne({ code: normalizedCode }).select("_id").lean();
  if (!promo) return;
  await PromoRedemption.findOneAndUpdate(
    { promoCodeId: promo._id, userId: new mongoose.Types.ObjectId(userId), orderId: { $exists: false } },
    { $set: { orderId: new mongoose.Types.ObjectId(orderId) } },
    { sort: { createdAt: -1 } }
  );
}

export async function reservePromoCodeUsage(
  code: string,
  userId: string,
  orderId?: string
) {
  const normalizedCode = code.trim().toUpperCase();
  const now = new Date();
  const promo = await PromoCode.findOne({
    code: normalizedCode,
    isActive: true,
    $and: promoActiveAtConditions(now),
  }).lean();
  if (!promo) return null;

  const filter: Record<string, unknown> = {
    _id: promo._id,
    isActive: true,
    $and: promoActiveAtConditions(now),
  };

  const maxPerUser = promo.maxUsesPerUser ?? 1;

  if (promo.maxUses != null) {
    filter.$expr = { $lt: ["$currentUses", "$maxUses"] };
  }

  if (maxPerUser === 1) {
    filter.usedBy = { $nin: [userId] };
    const updated = await PromoCode.findOneAndUpdate(
      filter,
      { $inc: { currentUses: 1 }, $addToSet: { usedBy: userId } },
      { returnDocument: "after" }
    );
    if (!updated) return null;
    await recordPromoRedemption(updated._id, userId, orderId);
    return updated;
  }

  const $exprConditions: Record<string, unknown>[] = [];
  if (promo.maxUses != null) {
    $exprConditions.push({ $lt: ["$currentUses", "$maxUses"] });
  }
  $exprConditions.push({
    $lt: [
      {
        $size: {
          $ifNull: [
            {
              $filter: {
                input: "$usedBy",
                as: "u",
                cond: { $eq: ["$$u", userId] },
              },
            },
            [],
          ],
        },
      },
      maxPerUser,
    ],
  });
  filter.$expr = { $and: $exprConditions };

  const updated = await PromoCode.findOneAndUpdate(
    filter,
    { $inc: { currentUses: 1 }, $push: { usedBy: userId } },
    { returnDocument: "after" }
  );

  if (!updated) return null;

  await recordPromoRedemption(updated._id, userId, orderId);
  return updated;
}
