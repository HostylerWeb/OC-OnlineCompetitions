import { ComplianceAuditLog, Order, OrderItem, Profile } from "@oc/api-db/models";
import type { IProfile } from "@oc/api-db/models/Profile";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex, substringRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import { withMongoTransactionOptional } from "@oc/api-infra/mongo-capabilities";
import {
  buildColumnSearchQuery,
  buildCursorFilter,
  decodeCursor,
  getNextCursor,
  parseCursorPagination,
  parsePagination,
  parseSearch,
  parseSort,
} from "@oc/api-infra/pagination";
import { cursorPaginated, error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { rollbackOrderRefund } from "@oc/api-payment-core";
import { incrementCounter } from "@oc/api-server/lib/observability/metrics";
import { buildRefundDeps } from "@oc/api-server/lib/payment/build-refund-deps";
import { requireManager } from "@oc/api-server/middleware/auth";
import { validateBody } from "@oc/api-validation";
import {
  type UpdateOrderStatusInput,
  updateOrderStatusSchema,
} from "@oc/api-validation/schemas/orders";
import { ADMIN_ORDER_TABLE } from "@oc/types";
import { getDisplayName } from "@oc/utils";
import { Hono } from "hono";
import type { ClientSession, PipelineStage } from "mongoose";

const app = new Hono();

app.use("*", requireManager);

/** Fields available in the Order collection before any $lookup */
const PRE_LOOKUP_SEARCHABLE = new Set(["providerSessionId"]);

/** Fields computed after $lookup + $addFields */
const POST_LOOKUP_SEARCHABLE = new Set(["userEmail", "userFullName"]);

function buildOrderQuery(c: { req: { query: (k: string) => string | undefined } }) {
  const query: Record<string, unknown> = {};
  const status = c.req.query("status");
  const userId = c.req.query("userId");
  if (status) query.status = status;
  if (userId) query.userId = userId;
  return query;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["processing", "failed", "completed"],
  processing: ["completed", "failed"],
  completed: ["refunded"],
  failed: [],
  refunded: [],
};

function mapOrderRow(order: Record<string, unknown>) {
  const profile = order.userId as IProfile | undefined;
  const userEmail = profile?.email ?? "N/A";
  return {
    ...order,
    userFirstName: profile?.firstName ?? "Unknown",
    userLastName: profile?.lastName ?? "",
    userEmail,
    userFullName: profile ? getDisplayName(profile, userEmail) : "Unknown",
  };
}

app.get("/", async (c) => {
  try {
    await dbConnect();

    const showDeleted = c.req.query("showDeleted") === "true";
    const query = buildOrderQuery(c);

    if (c.req.query("cursor") !== undefined) {
      const { limit, cursor, sortField, sortDir } = parseCursorPagination(c);
      const cursorData = cursor ? decodeCursor<Record<string, unknown>>(cursor) : null;
      const cursorFilter = buildCursorFilter(sortField, sortDir as 1 | -1, cursorData);

      const filter: Record<string, unknown> = { ...query };
      if (!showDeleted) {
        filter.deletedAt = null;
      }
      if (cursorFilter) {
        filter.$and = [cursorFilter];
      }

      const orders = await Order.find(filter)
        .sort({ [sortField]: sortDir as 1 | -1, _id: sortDir as 1 | -1 })
        .limit(limit + 1)
        .populate<{ userId: IProfile }>("userId")
        .lean();

      const hasMore = orders.length > limit;
      const pageItems = hasMore ? orders.slice(0, limit) : orders;
      const result = pageItems.map((order) => mapOrderRow(order as Record<string, unknown>));
      const nextCursor = getNextCursor(
        pageItems as unknown as Record<string, unknown>[],
        sortField,
        hasMore
      );

      return cursorPaginated(c, result, { limit, hasMore, nextCursor });
    }

    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: [...ADMIN_ORDER_TABLE.sortableFields],
      defaultSort: { createdAt: -1 },
    });
    const { columnSearch, globalSearch } = parseSearch(c);

    // Split column search into pre-lookup (raw Order fields) and post-lookup (computed fields)
    const preLookupColSearch = columnSearch.filter((e) => PRE_LOOKUP_SEARCHABLE.has(e.field));
    const postLookupColSearch = columnSearch.filter((e) => POST_LOOKUP_SEARCHABLE.has(e.field));
    const orderNumberColSearch = columnSearch.find((e) => e.field === "orderNumber");

    buildColumnSearchQuery(preLookupColSearch, ADMIN_ORDER_TABLE.searchableFields, query);

    // Build global search stages
    const searchPreMatch: PipelineStage[] = [];
    if (globalSearch) {
      searchPreMatch.push({
        $match: {
          $expr: {
            $regexMatch: {
              input: { $toString: "$orderNumber" },
              regex: escapeRegex(globalSearch),
              options: "i",
            },
          },
        },
      });
    }
    // Column search on orderNumber (numeric — needs $toString)
    if (orderNumberColSearch) {
      searchPreMatch.push({
        $match: {
          $expr: {
            $regexMatch: {
              input: { $toString: "$orderNumber" },
              regex: escapeRegex(orderNumberColSearch.value),
              options: "i",
            },
          },
        },
      });
    }

    // Build post-lookup column + global search conditions
    const postMatchConditions: Record<string, unknown>[] = [];
    if (globalSearch) {
      postMatchConditions.push(
        { userEmail: { $regex: substringRegex(globalSearch), $options: "i" } },
        { userFullName: { $regex: substringRegex(globalSearch), $options: "i" } },
        { providerSessionId: { $regex: substringRegex(globalSearch), $options: "i" } }
      );
    }
    for (const entry of postLookupColSearch) {
      postMatchConditions.push({
        [entry.field]: { $regex: substringRegex(entry.value), $options: "i" },
      });
    }

    const searchPostMatch: PipelineStage[] =
      postMatchConditions.length > 0 ? [{ $match: { $or: postMatchConditions } }] : [];

    // Handle deletedAt filtering
    if (!showDeleted) {
      query.deletedAt = null;
    }

    const basePipeline: PipelineStage[] = [
      { $match: query },
      ...searchPreMatch,
      {
        $lookup: {
          from: Profile.collection.name,
          localField: "userId",
          foreignField: "_id",
          as: "_profile",
        },
      },
      { $unwind: { path: "$_profile", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: OrderItem.collection.name,
          localField: "_id",
          foreignField: "orderId",
          as: "items",
        },
      },
      {
        $addFields: {
          userFirstName: { $ifNull: ["$_profile.firstName", "Unknown"] },
          userLastName: { $ifNull: ["$_profile.lastName", ""] },
          userEmail: { $ifNull: ["$_profile.email", "N/A"] },
          userFullName: {
            $trim: {
              input: {
                $cond: {
                  if: { $gt: ["$_profile.firstName", ""] },
                  then: { $concat: ["$_profile.firstName", " ", "$_profile.lastName"] },
                  else: "$_profile.lastName",
                },
              },
            },
          },
          userId: "$_profile",
          itemCount: { $size: "$items" },
        },
      },
      {
        $project: {
          _profile: 0,
          items: 0,
        },
      },
      ...searchPostMatch,
    ];

    const baseCountPipeline: PipelineStage[] = [
      { $match: query },
      ...searchPreMatch,
      ...searchPostMatch,
    ];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      user: { groupKey: "$userId._id", groupLabel: "$userEmail" },
      status: { groupKey: "$status", groupLabel: "$status" },
    };

    const { dataPipeline, countPipeline, isGrouped } = applyGroupBy(
      basePipeline,
      baseCountPipeline,
      groupBy,
      GROUPING_CONFIG,
      page,
      limit,
      sortObj,
      sortDir
    );

    const [orders, totalResult] = await Promise.all([
      Order.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      Order.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    const result = isGrouped
      ? orders
      : orders.map((order) => mapOrderRow(order as Record<string, unknown>));

    return paginated(c, result, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing orders:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.orders.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/deleted", async (c) => {
  try {
    await dbConnect();
    const items = await Order.findDeleted().sort({ deletedAt: -1 }).limit(50).lean();
    return success(c, items);
  } catch (err: unknown) {
    console.error("Error listing deleted orders:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.orders.listDeleted",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const order = await Order.findById(id).lean();

    if (!order) {
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }

    const orderItems = await OrderItem.find({ orderId: order._id })
      .populate<{ competitionId: { title: string; slug: string } }>("competitionId", "title slug")
      .lean();

    const profile = order.userId ? await Profile.findById(order.userId).lean() : null;
    const userEmail = profile?.email ?? "N/A";
    const userFullName = profile ? getDisplayName(profile, userEmail) : "Unknown";

    return success(c, { ...order, orderItems, userFullName, userEmail });
  } catch (err: unknown) {
    console.error("Error fetching order:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.orders.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.patch(
  "/:id/status",
  async (c, next) => validateBody(c, next, updateOrderStatusSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = c.get("body") as UpdateOrderStatusInput;
      const { status, reason } = body;
      await dbConnect();

      const existing = await Order.findById(id).lean();
      if (!existing) {
        return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
      }

      // Check if order has an active fulfillment lock
      if (existing.status === "processing") {
        const lock = (existing.metadata as Record<string, unknown>)?.fulfillmentLock as
          | { token?: string; expiresAt?: Date }
          | undefined;
        if (lock?.expiresAt && new Date(lock.expiresAt).getTime() > Date.now()) {
          return error(
            c,
            ErrorCodes.CONFLICT,
            "Order is currently being fulfilled. Please wait for fulfillment to complete before changing status.",
            409
          );
        }
      }

      // FSM validation
      const allowedTransitions = VALID_TRANSITIONS[existing.status] ?? [];
      if (!allowedTransitions.includes(status)) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `Invalid status transition: ${existing.status} \u2192 ${status}. Allowed transitions: ${allowedTransitions.join(", ") || "none (terminal state)"}`,
          400
        );
      }

      if (status === "completed" && !existing.providerSessionId) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "Cannot mark order as completed without a payment provider transaction",
          400
        );
      }

      // Changing to refunded — perform in-system refund rollback
      if (status === "refunded") {
        if (!reason) {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            "Reason is required when refunding an order",
            400
          );
        }

        let refundError: string | null = null;
        try {
          await withMongoTransactionOptional(async (session: ClientSession | null) => {
            const now = new Date().toISOString();
            const claimed = await Order.findOneAndUpdate(
              { _id: id, "metadata.refundProcessedAt": { $exists: false } },
              {
                $set: {
                  "metadata.refundProcessedAt": now,
                  "metadata.refundedVia": "admin_status_change",
                  "metadata.refundedAt": now,
                },
              },
              { session, returnDocument: "after" }
            );
            if (!claimed) return;

            const refundDeps = buildRefundDeps();
            const result = await rollbackOrderRefund(
              id,
              claimed.userId.toString(),
              c.get("userId") as string | null,
              reason,
              refundDeps,
              session ?? undefined
            );

            if (!result.success) {
              throw new Error(result.error ?? "Refund rollback failed");
            }

            const provider = String(claimed.provider ?? "");
            const pspRefundRequired = provider === "paytriot" || provider === "stripe";
            await ComplianceAuditLog.create(
              {
                actorId: c.get("userId") as string | null,
                targetUserId: claimed.userId.toString(),
                action: "order_refunded",
                reason,
                before: {
                  status: existing.status,
                  provider,
                  total: claimed.total,
                },
                after: {
                  status: "refunded",
                  pspRefundRequired,
                  walletCreditApplied: !pspRefundRequired,
                },
                source: "admin",
              },
              session ? { session } : undefined
            );

            await Order.findByIdAndUpdate(id, { $set: { status: "refunded" } }, { session });
          });
        } catch (err: unknown) {
          refundError = err instanceof Error ? err.message : "Refund rollback failed";
        }

        if (refundError) {
          return error(c, ErrorCodes.INTERNAL_ERROR, refundError, 500);
        }
      }

      // For non-refunded statuses, create audit log before update
      let order: any = null;
      if (status !== "refunded") {
        await ComplianceAuditLog.create({
          actorId: c.get("userId") as string | null,
          targetUserId: existing.userId.toString(),
          action: "order_status_change",
          reason: reason ?? "",
          before: { status: existing.status },
          after: { status },
          source: "admin",
        });

        const updateFields: Record<string, unknown> = { status };

        order = await Order.findByIdAndUpdate(
          id,
          { $set: updateFields },
          { returnDocument: "after" }
        ).lean();
      } else {
        order = await Order.findById(id).lean();
      }

      // Bust the per-user caches for the order's owner so their dashboard
      // reflects the new status on the next visit. The orders list is admin-only.
      if (order?.userId) {
        await invalidateUser(String(order.userId));
        await invalidateByChannelSafe(
          CH.competitions,
          CH.competitionDetail,
          CH.competitionFeatured,
          CH.entries,
          CH.stats,
          CH.landingPage,
          CH.competitionAvailability,
          CH.competitionsAvailabilityBatch
        );
      }

      if (status === "refunded") {
        incrementCounter("order.refunded");
      }
      incrementCounter("order.admin_status_change");

      return success(c, order);
    } catch (err: unknown) {
      console.error("Error updating order status:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.orders.updateStatus",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get("/:id/transaction-info", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const order = await Order.findById(id).lean();
    if (!order) {
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }
    if (!order.provider || !order.providerSessionId) {
      return error(c, ErrorCodes.CHECKOUT_ERROR, "Order has no provider/session", 400);
    }
    return success(c, {
      provider: order.provider,
      providerSessionId: order.providerSessionId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get transaction info";
    return error(c, ErrorCodes.INTERNAL_ERROR, message, 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const order = await Order.softDelete(id, c.get("userId") ?? undefined);

    if (!order) {
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }

    if (order?.userId) {
      await invalidateUser(String(order.userId));
      await invalidateByChannelSafe(
        CH.competitions,
        CH.competitionDetail,
        CH.competitionFeatured,
        CH.entries,
        CH.stats,
        CH.landingPage,
        CH.competitionAvailability,
        CH.competitionsAvailabilityBatch
      );
    }
    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting order:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.orders.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const restored = await Order.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }
    if (restored?.userId) {
      await invalidateUser(String(restored.userId));
      await invalidateByChannelSafe(
        CH.competitions,
        CH.competitionDetail,
        CH.competitionFeatured,
        CH.entries,
        CH.stats,
        CH.landingPage,
        CH.competitionAvailability,
        CH.competitionsAvailabilityBatch
      );
    }
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring order:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.orders.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
