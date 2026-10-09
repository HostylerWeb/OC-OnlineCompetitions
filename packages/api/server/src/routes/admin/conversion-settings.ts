import { ConversionSettings } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { conversionSettingsSchema } from "@oc/api-validation/schemas/conversion-settings";
import { Hono } from "hono";

const app = new Hono();

app.get("/", requireAdmin, async (c) => {
  try {
    await dbConnect();
    const settings = await ConversionSettings.findById("conversion_settings").lean();
    return success(c, settings);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.conversionSettings.get",
    });
    console.error("Error fetching conversion settings:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to fetch conversion settings", 500);
  }
});

app.put("/", requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = conversionSettingsSchema.safeParse(body);
    if (!parsed.success) {
      console.error(
        "[conversion-settings] Validation failed:",
        JSON.stringify(parsed.error.issues)
      );
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? "Invalid conversion settings",
        400
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const { enabled, defaultPayouts, trackers, googleAnalytics, facebookPixel } = parsed.data;
    if (typeof enabled === "boolean") updates.enabled = enabled;
    if (defaultPayouts) updates.defaultPayouts = defaultPayouts;
    if (trackers) updates.trackers = trackers;
    if (googleAnalytics) updates.googleAnalytics = googleAnalytics;
    if (facebookPixel) updates.facebookPixel = facebookPixel;

    await dbConnect();
    const settings = await ConversionSettings.findByIdAndUpdate(
      "conversion_settings",
      { $set: updates },
      { upsert: true, returnDocument: "after" }
    ).lean();

    await invalidateByChannelSafe(CH.conversionSettings);

    return success(c, settings);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.conversionSettings.update",
    });
    console.error("Error updating conversion settings:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to update conversion settings", 500);
  }
});

export default app;
