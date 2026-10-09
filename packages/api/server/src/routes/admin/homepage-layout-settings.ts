import { HomepageLayoutSettings } from "@oc/api-db/models";
import { CH, invalidateByChannel } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { getHomepageLayoutSettings } from "@oc/api-server/lib/settings/homepage-layout-settings";
import { requireManager } from "@oc/api-server/middleware/auth";
import {
  type HomepageLayoutSettingsUpdateInput,
  homepageLayoutSettingsUpdateSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireManager);

app.get("/", async (c) => {
  try {
    await dbConnect();

    const settings = await getHomepageLayoutSettings();
    return success(c, settings);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.homepageLayoutSettings.get",
    });
    console.error("Error fetching homepage layout settings:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put(
  "/",
  async (c, next) => validateBody(c, next, homepageLayoutSettingsUpdateSchema),
  async (c) => {
    try {
      const body = c.get("body") as HomepageLayoutSettingsUpdateInput;
      await dbConnect();

      const settings = await HomepageLayoutSettings.findByIdAndUpdate(
        "homepage_layout_settings",
        { $set: { sections: body.sections } },
        { upsert: true, returnDocument: "after" }
      );

      await invalidateByChannel(CH.homepageLayoutSettings).catch((err: unknown) => {
        console.warn(
          `[cache] failed to invalidate homepage-layout-settings: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });

      return success(c, settings);
    } catch (err: unknown) {
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.homepageLayoutSettings.update",
      });
      console.error("Error updating homepage layout settings:", err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
