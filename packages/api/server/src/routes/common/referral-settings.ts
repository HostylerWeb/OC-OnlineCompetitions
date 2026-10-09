import { ReferralSettings } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { DEFAULT_REFERRAL_SETTINGS } from "@oc/api-referrals/referral-defaults";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { Hono } from "hono";

async function ensureReferralSettings() {
  await dbConnect();
  const exists = await ReferralSettings.findById("referral_settings").lean();
  if (!exists) {
    await ReferralSettings.create(DEFAULT_REFERRAL_SETTINGS);
  }
}

const app = new Hono();

app.get(
  "/",
  redisCacheRoute({
    route: "settings:referral_settings",
    scope: "public",
    ttlSeconds: 300,
  }),
  async (c) => {
    try {
      await ensureReferralSettings();

      const settings = await ReferralSettings.findById("referral_settings").lean();
      return success(c, settings ?? DEFAULT_REFERRAL_SETTINGS);
    } catch (err: unknown) {
      console.error("Error fetching referral settings:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "referralSettings.get",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
