import { ComplianceAuditLog, PromoCode } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import {
  buildColumnSearchQuery,
  parsePagination,
  parseSearch,
  parseSort,
} from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import { createPromoCodeSchema, updatePromoCodeSchema, validateBody } from "@oc/api-validation";
import { releasePromoCodeUsage } from "@oc/api-tickets/promo-codes";
import { ADMIN_PROMO_CODE_TABLE } from "@oc/types";
import { Hono } from "hono";
import type { PipelineStage } from "mongoose";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireManager);

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: [...ADMIN_PROMO_CODE_TABLE.sortableFields],
      defaultSort: { createdAt: -1 },
    });
    const { columnSearch, globalSearch } = parseSearch(c);

    await dbConnect();

    const showDeleted = c.req.query("showDeleted") === "true";
    const query: Record<string, unknown> = {};
    if (!showDeleted) {
      query.deletedAt = null;
    }
    const isActive = c.req.query("isActive");
    if (isActive !== undefined) query.isActive = isActive === "true";

    buildColumnSearchQuery(columnSearch, ADMIN_PROMO_CODE_TABLE.searchableFields, query);

    if (globalSearch) {
      const safe = escapeRegex(globalSearch);
      query.$or = [
        { code: { $regex: safe, $options: "i" } },
        { discountType: { $regex: safe, $options: "i" } },
      ];
    }

    const basePipeline: PipelineStage[] = [{ $match: query }];
    const baseCountPipeline: PipelineStage[] = [{ $match: query }];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      discountType: { groupKey: "$discountType", groupLabel: "$discountType" },
      status: { groupKey: "$isActive", groupLabel: "$isActive" },
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

    const [promoCodes, totalResult] = await Promise.all([
      PromoCode.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      PromoCode.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    return paginated(c, promoCodes, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing promo codes:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.promoCodes.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/deleted", async (c) => {
  try {
    await dbConnect();
    const items = await PromoCode.findDeleted().sort({ deletedAt: -1 }).limit(50).lean();
    return success(c, items);
  } catch (err: unknown) {
    console.error("Error listing deleted promo codes:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.promoCodes.listDeleted",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
    }

    const promoCode = await PromoCode.findById(id).lean();

    if (!promoCode) {
      return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
    }

    return success(c, promoCode);
  } catch (err: unknown) {
    console.error("Error fetching promo code:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.promoCodes.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  async (c, next) => validateBody(c, next, createPromoCodeSchema),
  async (c) => {
    try {
      const body = c.get("body") as Record<string, unknown>;
      await dbConnect();

      const promoCode = await PromoCode.create(body);
      return success(c, promoCode);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "A promo code with this code already exists",
          409
        );
      }
      console.error("Error creating promo code:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.promoCodes.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:id",
  async (c, next) => validateBody(c, next, updatePromoCodeSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = c.get("body") as Record<string, unknown>;
      await dbConnect();

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
      }

      delete body.currentUses;
      delete body.usedBy;
      delete body.createdAt;

      const promoCode = await PromoCode.findByIdAndUpdate(id, body as Record<string, unknown>, {
        returnDocument: "after",
      }).lean();

      if (!promoCode) {
        return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
      }

      return success(c, promoCode);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "A promo code with this code already exists",
          409
        );
      }
      console.error("Error updating promo code:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.promoCodes.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.post("/:id/release-usage", async (c) => {
  try {
    const id = c.req.param("id");
    const body = (await c.req.json()) as { userId?: string; reason?: string };
    const targetUserId = body.userId?.trim();
    if (!targetUserId) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "userId is required", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
    }

    await dbConnect();
    const promo = await PromoCode.findById(id).lean();
    if (!promo) {
      return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
    }

    await releasePromoCodeUsage(promo.code, targetUserId);

    await ComplianceAuditLog.create({
      actorId: c.get("userId") ?? null,
      targetUserId,
      action: "promo_usage_released",
      reason: body.reason?.trim() || "Admin released promo reservation for user",
      before: { promoCode: promo.code, userId: targetUserId },
      after: { released: true },
      source: "admin",
    });

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error releasing promo usage:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.promoCodes.releaseUsage",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
    }

    const promoCode = await PromoCode.softDelete(id, c.get("userId") ?? undefined);

    if (!promoCode) {
      return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
    }

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting promo code:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.promoCodes.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const restored = await PromoCode.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Promo code not found", 404);
    }
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring promo code:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.promoCodes.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
