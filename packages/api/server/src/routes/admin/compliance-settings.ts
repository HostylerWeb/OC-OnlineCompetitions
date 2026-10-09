import { writeComplianceAuditLog } from "@oc/api-compliance/compliance-user-service";
import {
  ComplianceSettings,
  DEFAULT_COMPLIANCE_SETTINGS,
  type IComplianceSettings,
} from "@oc/api-db/models/ComplianceSettings";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { getRequiredUserId, requireAdmin } from "@oc/api-server/middleware/auth";
import { adminComplianceSettingsUpdateSchema } from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireAdmin);

app.get("/", async (c) => {
  try {
    await dbConnect();

    const settings = await ComplianceSettings.findById("compliance_settings").lean();
    return success(c, settings ?? DEFAULT_COMPLIANCE_SETTINGS);
  } catch (err: unknown) {
    console.error("Error fetching compliance settings:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.complianceSettings.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put("/", async (c) => {
  try {
    const body = await c.req.json();
    await dbConnect();

    const parsed = adminComplianceSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Invalid compliance settings update request",
        400
      );
    }

    const { reason, ...settingsBody } = parsed.data;

    const actorId = getRequiredUserId(c);
    const before = await ComplianceSettings.findById(
      "compliance_settings"
    ).lean<IComplianceSettings | null>();

    const updates: Partial<IComplianceSettings> = {};
    const booleanFields = [
      "masterEnabled",
      "ageVerificationEnabled",
      "creditCardMonthlyLimitEnabled",
      "instantWinCreditCardBanEnabled",
      "personalSpendLimitsEnabled",
      "selfExclusionEnabled",
      "postalEntryProminenceEnabled",
      "compliancePageEnabled",
      "guestCheckoutEnabled",
      "allowZeroSubtotalOrders",
    ] as const;

    for (const field of booleanFields) {
      if (typeof settingsBody[field] === "boolean") updates[field] = settingsBody[field];
    }

    if (typeof settingsBody.ageVerificationMinAge === "number") {
      updates.ageVerificationMinAge = settingsBody.ageVerificationMinAge;
    }
    if (typeof settingsBody.ageVerificationProvider === "string") {
      updates.ageVerificationProvider = settingsBody.ageVerificationProvider;
    }
    if (typeof settingsBody.creditCardMonthlyLimitGBP === "number") {
      updates.creditCardMonthlyLimitGBP = settingsBody.creditCardMonthlyLimitGBP;
    }
    if (typeof settingsBody.minimumOrderValue === "number") {
      updates.minimumOrderValue = settingsBody.minimumOrderValue;
    }
    if (typeof settingsBody.spendLimitIncreaseCooldownHours === "number") {
      updates.spendLimitIncreaseCooldownHours = settingsBody.spendLimitIncreaseCooldownHours;
    }
    if (typeof settingsBody.selfExclusionMinMonths === "number") {
      updates.selfExclusionMinMonths = settingsBody.selfExclusionMinMonths;
    }
    if (typeof settingsBody.marketingWebhookUrl === "string") {
      updates.marketingWebhookUrl = settingsBody.marketingWebhookUrl;
    }
    if (typeof settingsBody.postalEntryAddress === "string") {
      updates.postalEntryAddress = settingsBody.postalEntryAddress;
    }

    const settings = await ComplianceSettings.findByIdAndUpdate(
      "compliance_settings",
      { $set: updates },
      { upsert: true, returnDocument: "after" }
    );

    await writeComplianceAuditLog({
      actorId,
      targetUserId: null,
      action: "compliance_settings_updated",
      reason,
      before: JSON.parse(JSON.stringify(before ?? DEFAULT_COMPLIANCE_SETTINGS)),
      after: JSON.parse(JSON.stringify(settings)),
      source: "admin",
    });

    await invalidateByChannelSafe(CH.complianceSettings);
    return success(c, settings);
  } catch (err: unknown) {
    console.error("Error updating compliance settings:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.complianceSettings.update",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
