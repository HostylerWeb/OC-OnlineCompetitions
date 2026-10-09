import { ReferralSettings } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { DEFAULT_REFERRAL_SETTINGS } from "@oc/api-referrals/referral-defaults";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import {
  type ReferralSettingsUpdateInput,
  referralSettingsUpdateSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireAdmin);

app.get("/", async (c) => {
  try {
    await dbConnect();

    const settings = await ReferralSettings.findById("referral_settings").lean();
    if (!settings) {
      return success(c, DEFAULT_REFERRAL_SETTINGS);
    }

    return success(c, settings);
  } catch (err: unknown) {
    console.error("Error fetching referral settings:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put(
  "/",
  async (c, next) => validateBody(c, next, referralSettingsUpdateSchema),
  async (c) => {
    try {
      const body = c.get("body") as ReferralSettingsUpdateInput;
      await dbConnect();

      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) {
          updates[key] = value;
        }
      }

      const defaults = {
        calculusMethod: "gross",
        activityWindowDays: 30,
        activityWindowMode: "rolling",
        monthlyCutoffDay: 25,
        gracePeriod: { enabled: false, days: 3, countsToward: "current_tier" },
        minFirstOrderSpend: 1,
        refereeReward: { enabled: true, discountPercent: 20, minOrderValue: 0 },
        distribution: { mode: "wallet" },
        guardrails: {
          maxReferralsPerRefereePerDay: 0,
          blockSelfReferral: true,
          requireEmailVerification: false,
        },
      };

      const setOnInsert = { ...defaults };
      for (const key of Object.keys(updates)) {
        delete (setOnInsert as Record<string, unknown>)[key];
      }

      const settings = await ReferralSettings.findByIdAndUpdate(
        "referral_settings",
        { $set: updates, $setOnInsert: setOnInsert },
        { upsert: true, returnDocument: "after" }
      );

      await invalidateByChannelSafe(CH.referralSettings);
      await invalidateUser("anon");
      return success(c, settings);
    } catch (err: unknown) {
      console.error("Error updating referral settings:", err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
