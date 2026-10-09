import { SeoSettings } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { seoSettingsSchema } from "@oc/api-validation/schemas/seo-settings";
import { Hono } from "hono";

const app = new Hono();

app.get("/", requireAdmin, async (c) => {
  try {
    await dbConnect();
    const settings = await SeoSettings.findById("seo_settings").lean();
    return success(c, settings);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.seoSettings.get",
    });
    console.error("Error fetching SEO settings:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to fetch SEO settings", 500);
  }
});

app.put("/", requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = seoSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid SEO settings", 400);
    }

    const { defaultOgImageUrl, referralOgImageUrl, defaultTitle, defaultDescription } = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof defaultOgImageUrl === "string") updates.defaultOgImageUrl = defaultOgImageUrl;
    if (typeof referralOgImageUrl === "string") updates.referralOgImageUrl = referralOgImageUrl;
    if (typeof defaultTitle === "string") updates.defaultTitle = defaultTitle;
    if (typeof defaultDescription === "string") updates.defaultDescription = defaultDescription;

    await dbConnect();
    const settings = await SeoSettings.findByIdAndUpdate(
      "seo_settings",
      { $set: updates },
      { upsert: true, returnDocument: "after" }
    ).lean();

    await invalidateByChannelSafe(CH.seoSettings);

    return success(c, settings);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.seoSettings.update",
    });
    console.error("Error updating SEO settings:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to update SEO settings", 500);
  }
});

export default app;
