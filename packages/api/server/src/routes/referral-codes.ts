import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { validatePendingReferralCode } from "@oc/api-tickets/promo-codes";
import { Hono } from "hono";
import { auth } from "../middleware/auth";

const app = new Hono();

// POST /api/referral-codes/validate
app.post("/validate", auth, async (c) => {
  try {
    const { code, subtotal } = await c.req.json();
    const userId = c.get("userId");

    if (!code) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Referral code is required", 400);
    }

    await dbConnect();

    const result = await validatePendingReferralCode(code, subtotal ?? 0, userId ?? "");

    return success(c, {
      valid: result.valid,
      code: result.code,
      discount: result.discountAmount,
      discountValue: result.discountValue,
      discountType: result.discountType,
      discountAmount: result.discountAmount,
      error: result.error,
    });
  } catch (err) {
    console.error("Error validating referral code:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
