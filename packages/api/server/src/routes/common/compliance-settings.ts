import { getComplianceSettings, toPublicComplianceSettings } from "@oc/api-compliance/settings";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { Hono } from "hono";

const app = new Hono();

app.get(
  "/",
  redisCacheRoute({
    route: "settings:compliance_settings:public",
    scope: "public",
    ttlSeconds: 300,
  }),
  async (c) => {
    try {
      await dbConnect();
      const settings = await getComplianceSettings();
      return success(c, toPublicComplianceSettings(settings));
    } catch (err: unknown) {
      console.error("Error fetching public compliance settings:", err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
