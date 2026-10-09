import { Category, Competition } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import {
  backpropagateCategorySlugChange,
  clearCategoryFromCompetitions,
} from "@oc/api-tickets/categories";
import {
  type CategoryCreateInput,
  type CategoryReorderInput,
  type CategoryUpdateInput,
  categoryCreateSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";
import { PipelineStage } from "mongoose";

const app = new Hono();

app.use("*", requireManager);

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: ["name", "slug", "label", "displayOrder", "isActive", "createdAt"],
      defaultSort: { displayOrder: 1, name: 1 },
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
        { label: { $regex: safe, $options: "i" } },
        {
          $expr: {
            $regexMatch: { input: { $toString: "$isActive" }, regex: safe, options: "i" },
          },
        },
      ];
    }

    const basePipeline: PipelineStage[] = [{ $match: query }];
    const baseCountPipeline: PipelineStage[] = [{ $match: query }];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      name: { groupKey: "$name", groupLabel: "$name" },
    };

    const { dataPipeline, countPipeline } = applyGroupBy(
      basePipeline,
      baseCountPipeline,
      groupBy,
      GROUPING_CONFIG,
      page,
      limit,
      sortObj,
      sortDir
    );

    const [categories, totalResult] = await Promise.all([
      Category.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      Category.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    return paginated(c, categories, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing categories:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.categories.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/all", async (c) => {
  try {
    await dbConnect();

    const categories = await Category.find({}).sort({ displayOrder: 1, name: 1 }).lean();
    return success(c, categories);
  } catch (err: unknown) {
    console.error("Error listing all categories:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.categories.listAll",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put(
  "/reorder",
  async (c, next) => validateBody(c, next, categoryReorderSchema),
  async (c) => {
    try {
      const body = c.get("body") as CategoryReorderInput;
      await dbConnect();

      const existingCategories = await Category.find({}).select("_id").lean();
      const existingIds = new Set(existingCategories.map((category) => String(category._id)));

      if (body.orderedIds.length !== existingIds.size) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "orderedIds must include every category exactly once",
          400
        );
      }

      const uniqueIds = new Set(body.orderedIds);
      if (uniqueIds.size !== body.orderedIds.length) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "orderedIds must not contain duplicates", 400);
      }

      for (const id of body.orderedIds) {
        if (!existingIds.has(id)) {
          return error(c, ErrorCodes.VALIDATION_ERROR, `Unknown category id: ${id}`, 400);
        }
      }

      await Category.bulkWrite(
        body.orderedIds.map((id, index) => ({
          updateOne: {
            filter: { _id: id },
            update: { $set: { displayOrder: index * 10 } },
          },
        }))
      );

      const categories = await Category.find({}).sort({ displayOrder: 1, name: 1 }).lean();

      await invalidateByChannelSafe(CH.categories, CH.competitionCategories, CH.competitions);
      return success(c, categories);
    } catch (err: unknown) {
      console.error("Error reordering categories:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.categories.reorder",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get("/deleted", async (c) => {
  try {
    await dbConnect();
    const items = await Category.findDeleted().sort({ deletedAt: -1 }).limit(50).lean();
    return success(c, items);
  } catch (err: unknown) {
    console.error("Error listing deleted categories:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.categories.listDeleted",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const category = await Category.findById(id).lean();

    if (!category) {
      return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
    }

    return success(c, category);
  } catch (err: unknown) {
    console.error("Error fetching category:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.categories.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  async (c, next) => validateBody(c, next, categoryCreateSchema),
  async (c) => {
    try {
      const body = c.get("body") as CategoryCreateInput;
      await dbConnect();

      const slug = body.slug ?? body.name.toLowerCase().replace(/\s+/g, "-");

      const existing = await Category.findOne({ slug }).lean();
      if (existing) {
        return error(c, ErrorCodes.CONFLICT, `A category with slug "${slug}" already exists`, 409);
      }

      const category = await Category.create({
        name: body.name,
        slug,
        label: body.label ?? body.name,
        iconName: body.iconName ?? "Trophy",
        description: body.description,
        isActive: body.isActive ?? true,
        displayOrder: body.displayOrder ?? 0,
      });

      await invalidateByChannelSafe(CH.categories, CH.competitionCategories, CH.competitions);
      return success(c, category);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.CONFLICT, "A category with this slug already exists", 409);
      }
      console.error("Error creating category:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.categories.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:id",
  async (c, next) => validateBody(c, next, categoryUpdateSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = c.get("body") as CategoryUpdateInput;
      await dbConnect();

      const existingCategory = await Category.findById(id).lean();
      if (!existingCategory) {
        return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
      }

      if (body.slug) {
        const existing = await Category.findOne({ slug: body.slug, _id: { $ne: id } }).lean();
        if (existing) {
          return error(
            c,
            ErrorCodes.CONFLICT,
            `A category with slug "${body.slug}" already exists`,
            409
          );
        }
      }

      const category = await Category.findByIdAndUpdate(id, body, {
        returnDocument: "after",
      }).lean();

      if (!category) {
        return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
      }

      if (existingCategory.slug !== category.slug) {
        await backpropagateCategorySlugChange(existingCategory.slug, category.slug);
      }

      await invalidateByChannelSafe(CH.categories, CH.competitionCategories, CH.competitions);
      return success(c, category);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.CONFLICT, "A category with this slug already exists", 409);
      }
      console.error("Error updating category:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.categories.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const category = await Category.findById(id).lean();
    if (!category) {
      return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
    }

    const competitionCount = await Competition.countDocuments({
      category: category.slug,
      deletedAt: null,
      status: { $in: ["active", "ended", "pending_draw"] },
    });
    if (competitionCount > 0) {
      return error(
        c,
        "CATEGORY_IN_USE",
        `Cannot delete: used by ${competitionCount} active competitions`,
        400
      );
    }

    await (Category as any).softDelete(id, c.get("userId"));

    await clearCategoryFromCompetitions(category.slug);

    await invalidateByChannelSafe(CH.categories, CH.competitionCategories, CH.competitions);
    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting category:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.categories.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const restored = await Category.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Category not found", 404);
    }
    await invalidateByChannelSafe(CH.categories, CH.competitionCategories, CH.competitions);
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring category:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.categories.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
