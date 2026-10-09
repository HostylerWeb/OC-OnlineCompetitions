import { Profile } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { reconcileReferralCountOnReassign } from "@oc/api-referrals/referral-counter";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import {
  type UserReferralReassignInput,
  userReferralReassignSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();
app.use("*", requireAdmin);

app.put(
  "/",
  async (c, next) => validateBody(c, next, userReferralReassignSchema),
  async (c) => {
    try {
      const { userId, referralCode, action } = c.get("body") as UserReferralReassignInput;
      await dbConnect();

      const profile = await Profile.findById(userId).lean();
      if (!profile) {
        return error(c, ErrorCodes.NOT_FOUND, "User not found", 404);
      }

      const oldReferrerId = profile.referredBy?.toString() ?? null;

      if (action === "clear") {
        await Profile.findByIdAndUpdate(userId, {
          $set: { referredBy: undefined, referredByCode: undefined },
        });
        try {
          await reconcileReferralCountOnReassign({
            userId,
            oldReferrerId,
            newReferrerId: null,
          });
        } catch (counterErr) {
          console.error("Failed to reconcile referralCount after clear:", counterErr);
        }
        return success(c, {
          referredByCode: null,
          referredBySignupCode: profile.referredBySignupCode ?? null,
        });
      }

      const code = referralCode?.trim().toUpperCase();
      if (!code) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Referral code is required", 400);
      }

      const referrer = await Profile.findOne({ referralCode: code }).lean();
      if (!referrer) {
        return error(c, ErrorCodes.NOT_FOUND, "Referral code not found", 404);
      }
      if (referrer._id.toString() === userId) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Cannot use your own referral code", 400);
      }

      await Profile.findByIdAndUpdate(userId, {
        $set: {
          referredBy: referrer._id,
          referredByCode: code,
        },
      });

      try {
        await reconcileReferralCountOnReassign({
          userId,
          oldReferrerId,
          newReferrerId: referrer._id.toString(),
        });
      } catch (counterErr) {
        console.error("Failed to reconcile referralCount after reassign:", counterErr);
      }

      return success(c, {
        referredByCode: code,
        referredBySignupCode: profile.referredBySignupCode ?? null,
      });
    } catch (err: unknown) {
      console.error("Error reassigning referral:", err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
