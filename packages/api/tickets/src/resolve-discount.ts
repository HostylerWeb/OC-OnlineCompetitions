import { Order } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import {
  calculateReferralDiscountAmount,
  validatePromoCode,
  validateReferralCode,
} from "@oc/api-tickets/promo-codes";

export interface ResolvedCheckoutDiscount {
  discount: number;
  promoCode?: string;
  referralCode?: string;
}

export interface ResolveCheckoutDiscountParams {
  subtotal: number;
  promoCode?: string;
  referralCode?: string;
  userId: string;
  isGuest?: boolean;
  cartItems?: Array<{ competitionId: string; quantity: number; unitPrice: number }>;
}

export async function resolveCheckoutDiscount(
  params: ResolveCheckoutDiscountParams
): Promise<ResolvedCheckoutDiscount> {
  log.debug("[resolveDiscount.enter]", {
    referralCode: params.referralCode,
    promoCode: params.promoCode,
    subtotal: params.subtotal,
  });
  const { subtotal, promoCode, referralCode, userId } = params;
  const isGuest = params.isGuest ?? false;

  if (subtotal <= 0) {
    log.debug("[resolveDiscount.exit]", { discount: 0, reason: "subtotal <= 0" });
    return { discount: 0 };
  }

  if (isGuest) {
    log.debug("[resolveDiscount.exit]", { discount: 0, reason: "guest user" });
    return { discount: 0 };
  }

  let discount = 0;
  let resolvedPromoCode: string | undefined;
  let resolvedReferralCode: string | undefined;

  const completedOrders = await Order.countDocuments({ userId, status: "completed" });
  const isFirstOrder = completedOrders === 0;

  let deferredPromo: Awaited<ReturnType<typeof validatePromoCode>> | null = null;

  if (promoCode) {
    const promoResult = await validatePromoCode(promoCode, subtotal, params.cartItems, userId);
    log.debug("[resolveDiscount.promoResult]", {
      promoCode,
      valid: promoResult.valid,
      discountAmount: promoResult.discountAmount,
    });
    if (promoResult.valid) {
      if (isFirstOrder && referralCode) {
        deferredPromo = promoResult;
      } else {
        discount = promoResult.discountAmount ?? 0;
        resolvedPromoCode = promoResult.code;
      }
    } else {
      resolvedPromoCode = undefined;
    }
  }

  if (referralCode) {
    const referralResult = await validateReferralCode(referralCode, subtotal, userId);
    log.debug("[resolveDiscount.referralResult]", {
      referralCode,
      valid: referralResult.valid,
      discountAmount: referralResult.discountAmount,
    });
    if (referralResult.valid) {
      discount =
        referralResult.discountAmount ??
        calculateReferralDiscountAmount(subtotal, referralResult.discountValue ?? 0);
      resolvedReferralCode = referralResult.code;
    } else if (deferredPromo) {
      discount = deferredPromo.discountAmount ?? 0;
      resolvedPromoCode = deferredPromo.code;
    } else {
      resolvedReferralCode = undefined;
    }
  } else if (deferredPromo) {
    discount = deferredPromo.discountAmount ?? 0;
    resolvedPromoCode = deferredPromo.code;
  }

  const finalResult = {
    discount,
    promoCode: resolvedPromoCode,
    referralCode: resolvedReferralCode,
  };
  log.debug("[resolveDiscount.exit]", {
    promoDiscount: resolvedPromoCode ? discount : 0,
    referralDiscount: resolvedReferralCode ? discount : 0,
    totalDiscount: discount,
    resolvedPromoCode,
    resolvedReferralCode,
  });
  return finalResult;
}

const log = createLogger("app");
