import { Profile } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { validatePendingReferralCode, validateReferralCode } from "@oc/api-tickets/promo-codes";
import { Hono } from "hono";

const app = new Hono();

app.get("/lookup/:code", async (c) => {
  try {
    const code = c.req.param("code").trim().toUpperCase();
    if (!code || code.length > 64 || !/^[A-Z0-9_-]+$/.test(code)) {
      return c.json({ data: { valid: false, code: null } });
    }
    await dbConnect();
    const profile = await Profile.findOne({ referralCode: code })
      .select("referralCode firstName lastName")
      .lean();
    const referrerName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
    return c.json({
      data: {
        valid: !!profile,
        code: profile?.referralCode ?? null,
        referrerName: referrerName || null,
      },
    });
  } catch {
    return c.json({ data: { valid: false, code: null } });
  }
});

app.post("/validate", async (c) => {
  try {
    const { code, subtotal } = await c.req.json();
    const userId = c.get("userId")!;

    if (!code) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Referral code is required", 400);
    }

    await dbConnect();

    const result = await validatePendingReferralCode(code, subtotal ?? 0, userId);

    // Fall back to referral code (Profile.referralCode) if not a promo code
    if (!result.valid) {
      const profile = await Profile.findOne({ referralCode: code.toUpperCase() }).lean();
      if (profile && userId) {
        const referralResult = await validateReferralCode(code, subtotal ?? 0, userId);
        if (referralResult.valid) {
          return success(c, {
            valid: referralResult.valid,
            code: referralResult.code,
            discount: referralResult.discountAmount,
            discountValue: referralResult.discountValue,
            discountType: referralResult.discountType,
            discountAmount: referralResult.discountAmount,
            error: referralResult.error,
          });
        }
        // Return referral-specific error even if order check failed
        return success(c, {
          valid: false,
          code: undefined,
          discount: undefined,
          discountValue: undefined,
          discountType: undefined,
          discountAmount: undefined,
          error: referralResult.error,
        });
      }
    }

    return success(c, {
      valid: result.valid,
      code: result.code,
      discount: result.discountAmount,
      discountValue: result.discountValue,
      discountType: result.discountType,
      discountAmount: result.discountAmount,
      error: result.error,
    });
  } catch (err: unknown) {
    console.error("Error validating referral code:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
