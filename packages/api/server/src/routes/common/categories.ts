import { Category } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { Hono } from "hono";

const log = createLogger("categories");
const app = new Hono();

app.get(
  "/",
  redisCacheRoute({
    route: "categories:all",
    scope: "public",
    ttlSeconds: 300,
  }),
  async (c) => {
    try {
      log.debug("fetching categories");
      await dbConnect();

      const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1 }).lean();

      return success(c, categories);
    } catch (err: unknown) {
      log.error("Error fetching categories:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "categories.get",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
