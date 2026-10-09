import { ShopProduct } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex } from "@oc/api-infra/fuzzy-search";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import {
  type ShopProductCreateInput,
  type ShopProductUpdateInput,
  shopProductCreateSchema,
  shopProductUpdateSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireManager);

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const { sortObj, sortableFields } = parseSort(c, {
      fields: ["name", "sku", "price", "isActive", "sortOrder", "createdAt"],
      defaultSort: { sortOrder: 1, name: 1 },
    });
    await dbConnect();

    const showDeleted = c.req.query("showDeleted") === "true";
    const query: Record<string, unknown> = {};
    if (!showDeleted) {
      query.deletedAt = null;
    }

    const isActive = c.req.query("isActive");
    if (isActive !== undefined) query.isActive = isActive === "true";

    const categoryId = c.req.query("categoryId");
    if (categoryId) {
      query.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    const search = c.req.query("search")?.trim();
    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { name: { $regex: safe, $options: "i" } },
        { sku: { $regex: safe, $options: "i" } },
      ];
    }

    const [products, totalResult] = await Promise.all([
      ShopProduct.find(query)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShopProduct.countDocuments(query),
    ]);

    const total = typeof totalResult === "number" ? totalResult : 0;

    return paginated(c, products, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing shop products:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.products.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/all", async (c) => {
  try {
    await dbConnect();

    const products = await ShopProduct.find({ isActive: true, deletedAt: null })
      .sort({ sortOrder: 1, name: 1 })
      .select("name slug sku price images metadata options lowStockThreshold")
      .lean();
    return success(c, products);
  } catch (err: unknown) {
    console.error("Error listing all shop products:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.products.listAll",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
    }

    const product = await ShopProduct.findById(id).lean();

    if (!product) {
      return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
    }

    return success(c, product);
  } catch (err: unknown) {
    console.error("Error fetching shop product:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.products.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  async (c, next) => validateBody(c, next, shopProductCreateSchema),
  async (c) => {
    try {
      const body = c.get("body") as ShopProductCreateInput;
      await dbConnect();

      const product = await ShopProduct.create(body);
      void invalidateByChannelSafe(CH.shopProducts, CH.shopCategories).catch(() => {});

      return success(c, product);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.CONFLICT, "A product with this slug or SKU already exists", 409);
      }
      console.error("Error creating shop product:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.products.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:id",
  async (c, next) => validateBody(c, next, shopProductUpdateSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = c.get("body") as ShopProductUpdateInput;
      await dbConnect();

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
      }

      const existing = await ShopProduct.findById(id).lean();
      if (!existing) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
      }

      const product = await ShopProduct.findByIdAndUpdate(id, body, {
        returnDocument: "after",
      }).lean();
      void invalidateByChannelSafe(CH.shopProducts, CH.shopProduct).catch(() => {});

      if (!product) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
      }

      return success(c, product);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.CONFLICT, "A product with this slug or SKU already exists", 409);
      }
      console.error("Error updating shop product:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.products.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
    }

    const product = await ShopProduct.softDelete(id, c.get("userId") ?? undefined);

    if (!product) {
      return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
    }

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting shop product:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.products.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const restored = await ShopProduct.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
    }
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring shop product:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.products.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
