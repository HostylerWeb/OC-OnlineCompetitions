import { Order, Profile, ReferralSettings } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireGuestCheckout } from "@oc/api-server/middleware/auth";
import {
  validatePendingReferralCode,
  validatePromoCode,
  validateReferralCode,
} from "@oc/api-tickets/promo-codes";
import { Hono } from "hono";
import { ZodError, z } from "zod";

const app = new Hono();

const validateDiscountSchema = z.object({
  code: z.string().min(1).max(64),
  subtotal: z.number().nonnegative().optional(),
  pendingReferralCode: z.string().max(64).optional(),
  items: z
    .array(
      z.object({
        competitionId: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .optional(),
});

app.post("/validate", requireGuestCheckout, async (c) => {
  try {
    const body = validateDiscountSchema.parse(await c.req.json());
    const { code, subtotal, pendingReferralCode, items } = body;
    const userId = c.get("userId")!;

    await dbConnect();

    const upperCode = code.toUpperCase();

    const promoResult = await validatePromoCode(upperCode, subtotal ?? 0, items, userId);

    if (promoResult.valid) {
      if (pendingReferralCode && upperCode === pendingReferralCode.toUpperCase()) {
        const completedOrders = await Order.countDocuments({
          userId,
          status: "completed",
        }).maxTimeMS(5000);
        if (completedOrders === 0) {
          return success(c, {
            valid: false,
            code: undefined,
            discountValue: undefined,
            discountAmount: undefined,
            discountType: undefined,
            discountErrorType: "referral_already_applied",
            error: "Your referral discount has priority on your first order",
          });
        }
      }

      return success(c, {
        valid: true,
        code: promoResult.code,
        discountValue: promoResult.discountValue,
        discountAmount: promoResult.discountAmount,
        discountType: promoResult.discountType,
        discountErrorType: undefined,
        error: undefined,
        codeType: "promo",
      });
    }

    const referralProfile = await Profile.findOne({ referralCode: upperCode }).lean();
    if (referralProfile && userId) {
      const completedOrders = await Order.countDocuments({
        userId,
        status: "completed",
      }).maxTimeMS(5000);
      const isFirstOrder = completedOrders === 0;

      if (isFirstOrder) {
        const referralResult = await validateReferralCode(upperCode, subtotal ?? 0, userId, true);
        if (referralResult.valid) {
          return success(c, {
            valid: true,
            code: referralResult.code,
            discountValue: referralResult.discountValue,
            discountAmount: referralResult.discountAmount,
            discountType: referralResult.discountType,
            discountErrorType: undefined,
            error: undefined,
            codeType: "referral",
          });
        }
      }

      const settings = await ReferralSettings.findById("referral_settings").lean();
      const minOrderValue = (settings?.refereeReward?.minOrderValue as number) ?? 0;

      if (!isFirstOrder) {
        return success(c, {
          valid: false,
          code: undefined,
          discountValue: undefined,
          discountAmount: undefined,
          discountType: undefined,
          discountErrorType: "first_order_only",
          error: "Referral discounts are only available on your first purchase",
        });
      }

      if ((subtotal ?? 0) < minOrderValue) {
        return success(c, {
          valid: false,
          code: undefined,
          discountValue: undefined,
          discountAmount: undefined,
          discountType: undefined,
          discountErrorType: "min_order",
          error: `Minimum order value is £${minOrderValue}`,
        });
      }
    }

    const pendingResult = await validatePendingReferralCode(
      upperCode,
      subtotal ?? 0,
      userId ?? ""
    );
    if (pendingResult.valid) {
      return success(c, {
        valid: true,
        code: pendingResult.code,
        discountValue: pendingResult.discountValue,
        discountAmount: pendingResult.discountAmount,
        discountType: pendingResult.discountType,
        discountErrorType: undefined,
        error: undefined,
        codeType: "pending_referral",
      });
    }

    return success(c, {
      valid: false,
      code: undefined,
      discountValue: undefined,
      discountAmount: undefined,
      discountType: undefined,
      discountErrorType: "invalid",
      error: "Invalid discount code",
    });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid request body", 400);
    }
    console.error("Error validating discount:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "discounts.validate",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
