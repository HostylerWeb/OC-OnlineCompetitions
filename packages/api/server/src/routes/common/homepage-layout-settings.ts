import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { createLogger } from "@oc/api-logger";
import { getHomepageLayoutSettings } from "@oc/api-server/lib/settings/homepage-layout-settings";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { Hono } from "hono";

const log = createLogger("homepage-layout-settings");
const app = new Hono();

app.get(
  "/",
  redisCacheRoute({
    route: "settings:homepage_layout_settings",
    scope: "public",
    ttlSeconds: 300,
  }),
  async (c) => {
    try {
      log.debug("fetching homepage layout settings");
      await dbConnect();

      const settings = await getHomepageLayoutSettings();
      return success(c, settings);
    } catch (err: unknown) {
      log.error("Error fetching homepage layout settings:", err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
