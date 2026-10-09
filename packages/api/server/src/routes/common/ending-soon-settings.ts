import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { createLogger } from "@oc/api-logger";
import { getEndingSoonSettings } from "@oc/api-server/lib/settings/ending-soon-settings";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { Hono } from "hono";

const log = createLogger("ending-soon-settings");
const app = new Hono();

app.get(
  "/",
  redisCacheRoute({
    route: "settings:ending_soon_settings",
    scope: "public",
    ttlSeconds: 300,
  }),
  async (c) => {
    try {
      log.debug("fetching ending soon settings");
      await dbConnect();
      const settings = await getEndingSoonSettings();
      return success(c, settings);
    } catch (err: unknown) {
      log.error("Error fetching ending soon settings:", err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
