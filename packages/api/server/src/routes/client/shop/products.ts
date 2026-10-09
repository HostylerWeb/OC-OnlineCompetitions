import { ShopProduct, ShopProductVariant } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { Hono } from "hono";

const log = createLogger("shop-products");
const app = new Hono({ strict: false });

app.get(
  "/",
  redisCacheRoute({
    route: "shop:products",
    scope: "public",
    ttlSeconds: 60,
  }),
  async (c) => {
    try {
      const { limit, page } = parsePagination(c);
      await dbConnect();

      const query: Record<string, unknown> = { isActive: true, deletedAt: null };

      const categoryId = c.req.query("categoryId");
      if (categoryId) query.categoryId = categoryId;

      const search = c.req.query("search")?.trim();
      if (search) {
        query.$text = { $search: search };
      }

      const sortField = c.req.query("sort") || "sortOrder";
      const sortDir = c.req.query("dir") === "asc" ? 1 : -1;
      const sortObj: Record<string, 1 | -1> = {};
      sortObj[sortField === "price" ? "price" : "sortOrder"] = sortField === "price" ? sortDir : -1;

      const [products, total] = await Promise.all([
        ShopProduct.find(query)
          .sort(sortObj)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ShopProduct.countDocuments(query),
      ]);

      return paginated(c, products, total, page, limit);
    } catch (err: unknown) {
      log.error("Error listing shop products:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        operation: "shop.products.list",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get(
  "/:slug",
  redisCacheRoute({
    route: "shop:product",
    scope: "public",
    ttlSeconds: 60,
  }),
  async (c) => {
    try {
      const slug = c.req.param("slug");
      await dbConnect();

      const product = await ShopProduct.findOne({ slug, isActive: true, deletedAt: null }).lean();

      if (!product) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
      }

      const variants = await ShopProductVariant.find({
        productId: product._id,
        isActive: true,
        deletedAt: null,
      })
        .sort({ sortOrder: 1 })
        .lean();

      return success(c, { ...product, variants });
    } catch (err: unknown) {
      log.error("Error fetching shop product:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        operation: "shop.products.getOne",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

export default app;
