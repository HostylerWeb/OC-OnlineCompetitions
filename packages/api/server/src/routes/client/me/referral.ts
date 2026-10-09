import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireSession } from "@oc/api-server/middleware/auth";
import { applyReferralToProfile } from "@oc/auth-admin/auth-hooks";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireSession);

app.post("/apply", async (c) => {
  try {
    const userId = c.get("userId")!;
    const body = await c.req.json<{ code?: string }>();

    if (!body.code?.trim()) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Referral code is required", 400);
    }

    await dbConnect();

    const result = await applyReferralToProfile(userId, body.code);
    if (!result.applied && !result.referredByCode) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid or ineligible referral code", 400);
    }

    return success(c, {
      applied: result.applied,
      overwritten: result.overwritten ?? false,
      referredByCode: result.referredByCode ?? null,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.referral.apply",
    });
    console.error("Error applying referral:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
