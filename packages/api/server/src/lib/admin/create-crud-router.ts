import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import { parsePagination } from "@oc/api-infra/pagination";
import { created, error, paginated, success } from "@oc/api-infra/response";
import type { Context } from "hono";
import { Hono } from "hono";
import type { Document, Model } from "mongoose";
import { requireAdmin } from "../../middleware/auth";

export interface CrudRouterConfig<T extends Document> {
  model: Model<T>;
  resourceName: string;
  defaultSort?: Record<string, 1 | -1>;
  buildQuery?: (c: Context) => Record<string, unknown>;
  beforeCreate?: (body: Record<string, unknown>) => Record<string, unknown>;
  beforeUpdate?: (body: Record<string, unknown>) => Record<string, unknown>;
}

export function createCrudRouter<T extends Document>(config: CrudRouterConfig<T>) {
  const app = new Hono();
  app.use("*", requireAdmin);

  app.get("/", async (c) => {
    try {
      const { limit, page, skip } = parsePagination(c);
      await dbConnect();
      const query = config.buildQuery?.(c) ?? {};
      const sort = config.defaultSort ?? { createdAt: -1 };
      const [items, total] = await Promise.all([
        config.model.find(query).sort(sort).skip(skip).limit(limit).lean(),
        config.model.countDocuments(query),
      ]);
      return paginated(c, items, total, page, limit);
    } catch (err: unknown) {
      console.error(`Error listing ${config.resourceName}:`, err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  });

  app.get("/:id", async (c) => {
    try {
      await dbConnect();
      const item = await config.model.findById(c.req.param("id")).lean();
      if (!item) return error(c, ErrorCodes.NOT_FOUND, `${config.resourceName} not found`, 404);
      return success(c, item);
    } catch (err: unknown) {
      console.error(`Error fetching ${config.resourceName}:`, err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  });

  app.post("/", async (c) => {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      await dbConnect();
      const payload = config.beforeCreate?.(body) ?? body;
      const doc = await config.model.create(payload as Parameters<typeof config.model.create>[0]);
      return created(c, doc);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, `${config.resourceName} already exists`, 409);
      }
      console.error(`Error creating ${config.resourceName}:`, err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  });

  app.put("/:id", async (c) => {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      await dbConnect();
      const payload = config.beforeUpdate?.(body) ?? body;
      const updated = await config.model.findByIdAndUpdate(c.req.param("id"), payload, {
        returnDocument: "after",
      });
      if (!updated) return error(c, ErrorCodes.NOT_FOUND, `${config.resourceName} not found`, 404);
      return success(c, updated);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, `${config.resourceName} already exists`, 409);
      }
      console.error(`Error updating ${config.resourceName}:`, err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  });

  app.delete("/:id", async (c) => {
    try {
      await dbConnect();
      const deleted = await config.model.findByIdAndDelete(c.req.param("id"));
      if (!deleted) return error(c, ErrorCodes.NOT_FOUND, `${config.resourceName} not found`, 404);
      return success(c, { success: true });
    } catch (err: unknown) {
      console.error(`Error deleting ${config.resourceName}:`, err);
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  });

  return app;
}
