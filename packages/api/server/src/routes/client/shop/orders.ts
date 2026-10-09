import { ShopOrder } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { requireSession } from "@oc/api-server/middleware/auth";
import { Hono } from "hono";
import mongoose from "mongoose";

const log = createLogger("shop-orders");
const app = new Hono({ strict: false });

app.use("*", requireSession);

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    const { limit, page } = parsePagination(c);
    await dbConnect();

    const query = { userId };

    const [orders, total] = await Promise.all([
      ShopOrder.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShopOrder.countDocuments(query),
    ]);

    return paginated(c, orders, total, page, limit);
  } catch (err: unknown) {
    log.error("Error listing shop orders:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "shop.orders.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const userId = c.get("userId")!;
    const id = c.req.param("id");
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }

    const order = await ShopOrder.findOne({ _id: id, userId }).lean();

    if (!order) {
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }

    return success(c, order);
  } catch (err: unknown) {
    log.error("Error fetching shop order:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "shop.orders.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
