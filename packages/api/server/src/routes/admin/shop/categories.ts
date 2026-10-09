import { ShopCategory, ShopProduct } from "@oc/api-db/models";
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
  type ShopCategoryCreateInput,
  type ShopCategoryUpdateInput,
  shopCategoryCreateSchema,
  shopCategoryUpdateSchema,
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
      fields: ["name", "slug", "sortOrder", "isActive", "createdAt"],
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

    const search = c.req.query("search")?.trim();
    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { name: { $regex: safe, $options: "i" } },
        { slug: { $regex: safe, $options: "i" } },
      ];
    }

    const [categories, totalResult, productCounts] = await Promise.all([
      ShopCategory.find(query)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShopCategory.countDocuments(query),
      ShopProduct.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      ]),
    ]);

    const total = typeof totalResult === "number" ? totalResult : 0;

    const countMap = new Map(productCounts.map((p) => [p._id?.toString() ?? "", p.count]));

    const enriched = categories.map((cat) => ({
      ...cat,
      productCount: countMap.get(cat._id.toString()) ?? 0,
    }));

    return paginated(c, enriched, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing shop categories:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.categories.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
    }

    const category = await ShopCategory.findById(id).lean();

    if (!category) {
      return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
    }

    return success(c, category);
  } catch (err: unknown) {
    console.error("Error fetching shop category:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.categories.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  async (c, next) => validateBody(c, next, shopCategoryCreateSchema),
  async (c) => {
    try {
      const body = c.get("body") as ShopCategoryCreateInput;
      await dbConnect();

      const slug = body.slug ?? body.name.toLowerCase().replace(/\s+/g, "-");

      const existing = await ShopCategory.findOne({ slug }).lean();
      if (existing) {
        return error(c, ErrorCodes.CONFLICT, `A category with slug "${slug}" already exists`, 409);
      }

      const category = await ShopCategory.create({
        name: body.name,
        slug,
        description: body.description,
        image: body.image,
        parentId: body.parentId ? new mongoose.Types.ObjectId(body.parentId) : undefined,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      });
      void invalidateByChannelSafe(CH.shopCategories, CH.shopProducts).catch(() => {});

      return success(c, category);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.CONFLICT, "A category with this slug already exists", 409);
      }
      console.error("Error creating shop category:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.categories.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:id",
  async (c, next) => validateBody(c, next, shopCategoryUpdateSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = c.get("body") as ShopCategoryUpdateInput;
      await dbConnect();

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
      }

      const existingCategory = await ShopCategory.findById(id).lean();
      if (!existingCategory) {
        return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
      }

      if (body.slug) {
        const existing = await ShopCategory.findOne({ slug: body.slug, _id: { $ne: id } }).lean();
        if (existing) {
          return error(
            c,
            ErrorCodes.CONFLICT,
            `A category with slug "${body.slug}" already exists`,
            409
          );
        }
      }

      const updateData: Record<string, unknown> = { ...body };
      if (body.parentId !== undefined) {
        updateData.parentId = body.parentId ? new mongoose.Types.ObjectId(body.parentId) : null;
      }

      const category = await ShopCategory.findByIdAndUpdate(id, updateData, {
        returnDocument: "after",
      }).lean();
      void invalidateByChannelSafe(CH.shopCategories, CH.shopProducts).catch(() => {});

      if (!category) {
        return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
      }

      return success(c, category);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.CONFLICT, "A category with this slug already exists", 409);
      }
      console.error("Error updating shop category:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.categories.update",
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
      return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
    }

    const category = await ShopCategory.findById(id).lean();
    if (!category) {
      return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
    }

    const productCount = await ShopProduct.countDocuments({
      categoryId: id,
      deletedAt: null,
    });
    if (productCount > 0) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Cannot delete: used by ${productCount} product(s)`,
        400
      );
    }

    await ShopCategory.softDelete(id, c.get("userId") ?? undefined);

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting shop category:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.categories.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const restored = await ShopCategory.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
    }
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring shop category:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.categories.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
