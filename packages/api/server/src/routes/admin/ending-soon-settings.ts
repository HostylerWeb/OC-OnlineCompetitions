import { EndingSoonSettings } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { createLogger } from "@oc/api-logger";
import { getEndingSoonSettings } from "@oc/api-server/lib/settings/ending-soon-settings";
import { requireManager } from "@oc/api-server/middleware/auth";
import {
  type EndingSoonSettingsUpdateInput,
  endingSoonSettingsUpdateSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";

const log = createLogger("admin-ending-soon-settings");
const app = new Hono();

app.use("*", requireManager);

app.get("/", async (c) => {
  try {
    await dbConnect();
    const settings = await getEndingSoonSettings();
    return success(c, settings);
  } catch (err: unknown) {
    log.error("Error fetching ending soon settings:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put(
  "/",
  async (c, next) => validateBody(c, next, endingSoonSettingsUpdateSchema),
  async (c) => {
    try {
      const body = c.get("body") as EndingSoonSettingsUpdateInput;
      await dbConnect();

      const updates: Partial<EndingSoonSettingsUpdateInput> = {};
      if (typeof body.endingSoonDaysThreshold === "number")
        updates.endingSoonDaysThreshold = body.endingSoonDaysThreshold;
      if (typeof body.endingSoonTicketsThreshold === "number")
        updates.endingSoonTicketsThreshold = body.endingSoonTicketsThreshold;
      if (body.endingSoonCombineMode) updates.endingSoonCombineMode = body.endingSoonCombineMode;
      if (typeof body.endingSoonTimeEnabled === "boolean")
        updates.endingSoonTimeEnabled = body.endingSoonTimeEnabled;
      if (typeof body.endingSoonTicketsEnabled === "boolean")
        updates.endingSoonTicketsEnabled = body.endingSoonTicketsEnabled;
      if (body.endingSoonTicketsMetric)
        updates.endingSoonTicketsMetric = body.endingSoonTicketsMetric;

      const settings = await EndingSoonSettings.findByIdAndUpdate(
        "ending_soon_settings",
        { $set: updates },
        { upsert: true, returnDocument: "after" }
      );

      await invalidateByChannelSafe(CH.endingSoonSettings);
      return success(c, settings);
    } catch (err: unknown) {
      log.error("Error updating ending soon settings:", err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
