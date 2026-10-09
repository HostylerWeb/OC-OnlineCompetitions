import { Profile } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { auth } from "@oc/api-server/middleware/auth";
import { validatePromoCode, validateReferralCode } from "@oc/api-tickets/promo-codes";
import { Hono } from "hono";
import { ZodError, z } from "zod";

const app = new Hono();

const validatePromoCodeSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().optional(),
  items: z
    .array(
      z.object({
        competitionId: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
      })
    )
    .optional(),
});

app.post("/validate", auth, async (c) => {
  try {
    const body = validatePromoCodeSchema.parse(await c.req.json());
    const { code, subtotal, items } = body;
    const userId = c.get("userId")!;

    if (!code) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Promo code is required", 400);
    }

    await dbConnect();

    const result = await validatePromoCode(code, subtotal ?? 0, items, userId);

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
    if (err instanceof ZodError) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid request body", 400);
    }
    console.error("Error validating promo code:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "promoCodes.validate",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
