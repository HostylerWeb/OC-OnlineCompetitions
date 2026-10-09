import { Profile } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireSession } from "@oc/api-server/middleware/auth";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { applyReferralToProfile } from "@oc/auth-admin/auth-hooks";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireSession);

app.get(
  "/",
  redisCacheRoute({
    route: "user:referral-code",
    scope: "user",
    ttlSeconds: 60,
  }),
  async (c) => {
    try {
      const userId = c.get("userId")!;
      await dbConnect();

      const profile = await Profile.findById(userId).select("referredByCode").lean();
      return success(c, {
        referredByCode: profile?.referredByCode ?? null,
      });
    } catch (err: unknown) {
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "referralCode.get",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.post("/claim", async (c) => {
  try {
    const userId = c.get("userId")!;
    const body = await c.req.json<{ code?: string }>();
    const code = body.code?.trim();
    if (!code) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Referral code is required");
    }

    await dbConnect();

    const result = await applyReferralToProfile(userId, code);
    if (!result.applied && !result.referredByCode) {
      return error(c, ErrorCodes.NOT_FOUND, "Invalid referral code", 404);
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
      operation: "referralCode.claim",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
