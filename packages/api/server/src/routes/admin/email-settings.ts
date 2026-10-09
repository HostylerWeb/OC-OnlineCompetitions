import { EmailSettings } from "@oc/api-db/models";
import { invalidateEmailConfigCache } from "@oc/api-email/config";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { emailSettingsUpdateSchema, validateBody } from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();

app.get("/", requireAdmin, async (c) => {
  try {
    await dbConnect();
    const settings = await EmailSettings.findOne({ _id: "email_settings" }).lean();
    return success(c, settings);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.emailSettings.get",
    });
    console.error("Error fetching email settings:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to fetch email settings", 500);
  }
});

app.put(
  "/",
  requireAdmin,
  async (c, next) => validateBody(c, next, emailSettingsUpdateSchema),
  async (c) => {
    try {
      const body = c.get("body") as Record<string, unknown>;
      const { fromName, fromEmail, supportAddress, social } = body;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof fromName === "string") updates.fromName = fromName;
      if (typeof fromEmail === "string") updates.fromEmail = fromEmail;
      if (typeof supportAddress === "string") updates.supportAddress = supportAddress;
      if (typeof social === "object" && social !== null) {
        const s = social as Record<string, unknown>;
        if (typeof s.facebook === "string") updates["social.facebook"] = s.facebook;
        if (typeof s.instagram === "string") updates["social.instagram"] = s.instagram;
        if (typeof s.whatsapp === "string") updates["social.whatsapp"] = s.whatsapp;
        if (typeof s.telegram === "string") updates["social.telegram"] = s.telegram;
        if (typeof s.tiktok === "string") updates["social.tiktok"] = s.tiktok;
      }

      await dbConnect();
      const settings = await EmailSettings.findOneAndUpdate(
        { _id: "email_settings" },
        { $set: updates },
        { upsert: true, returnDocument: "after" }
      ).lean();

      invalidateEmailConfigCache();

      return success(c, settings);
    } catch (err: unknown) {
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.emailSettings.update",
      });
      console.error("Error updating email settings:", err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to update email settings", 500);
    }
  }
);

export default app;
