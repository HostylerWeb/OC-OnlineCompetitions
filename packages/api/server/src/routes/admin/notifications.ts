import {
  Notification,
  type NotificationStatus,
  type NotificationType,
  PushSubscription,
} from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { getRequiredUserId, requireManager } from "@oc/api-server/middleware/auth";
import {
  sendNotificationSchema,
  updateNotificationSchema,
  validateBody,
} from "@oc/api-validation";
import { getEnv } from "@oc/env/server";
import { Hono } from "hono";
import mongoose from "mongoose";
import webpush from "web-push";

const vapidPublicKey = getEnv("VAPID_PUBLIC_KEY");
const vapidPrivateKey = getEnv("VAPID_PRIVATE_KEY");

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:notifications@onlinecompetitions.com", vapidPublicKey, vapidPrivateKey);
}

const BATCH_SIZE = 50;
const BATCH_INTERVAL_MS = 500;

if (!mongoose.models.User) {
  mongoose.model("User", new mongoose.Schema({}, { strict: false, collection: "user" }));
}

const app = new Hono();

app.use("*", requireManager);

function buildDateFilter(fromDate?: string, toDate?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (fromDate || toDate) {
    const dateFilter: Record<string, Date> = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);
    filter.createdAt = dateFilter;
  }
  return filter;
}

async function sendBulkPush(
  subscriptions: Array<{
    _id: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    preferences?: Record<string, boolean>;
  }>,
  payload: {
    title: string;
    body: string;
    type?: string;
    icon?: string;
    badge?: string;
    image?: string;
    data?: Record<string, unknown>;
    url?: string;
  }
): Promise<{ sentCount: number; failedCount: number }> {
  const notifType = payload.type;
  if (notifType) {
    subscriptions = subscriptions.filter((sub) => sub.preferences?.[notifType] !== false);
  }

  let sentCount = 0;
  let failedCount = 0;

  if (subscriptions.length === 0) {
    return { sentCount: 0, failedCount: 0 };
  }

  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webpush.sendNotification(
          sub as unknown as webpush.PushSubscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon ?? "/icons/icon-192x192.svg",
            badge: payload.badge ?? "/icons/icon-192x192.svg",
            image: payload.image,
            data: payload.data ?? {},
            url: payload.url ?? "/",
          })
        )
      )
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        sentCount++;
      } else {
        failedCount++;
        const err = result.reason as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          const subIdx = i + j;
          if (subIdx < subscriptions.length) {
            const subId = (subscriptions[subIdx] as { _id: { toString: () => string } })._id;
            await PushSubscription.findByIdAndUpdate(subId.toString(), {
              active: false,
            });
          }
        }
      }
    }

    if (i + BATCH_SIZE < subscriptions.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL_MS));
    }
  }

  return { sentCount, failedCount };
}

app.post(
  "/send",
  async (c, next) => validateBody(c, next, sendNotificationSchema),
  async (c) => {
    try {
      const body = c.get("body") as {
        title: string;
        body: string;
        type: NotificationType;
        url?: string;
        icon?: string;
        image?: string;
        badge?: string;
        data?: Record<string, unknown>;
        targetFilter?: {
          allUsers?: boolean;
          userIds?: string[];
          subscriptionIds?: string[];
          roles?: string[];
        };
        scheduleAt?: string;
      };

      if (!body.title || !body.body || !body.type) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "title, body, and type are required");
      }

      if (!vapidPublicKey || !vapidPrivateKey) {
        return error(c, ErrorCodes.INTERNAL_ERROR, "VAPID keys not configured", 500);
      }

      await dbConnect();

      const userId = getRequiredUserId(c);
      const targetFilter = body.targetFilter ?? { allUsers: true };
      const now = new Date();
      const scheduleAt = body.scheduleAt ? new Date(body.scheduleAt) : undefined;
      const isScheduled = scheduleAt && scheduleAt > now;

      const notification = await Notification.create({
        title: body.title,
        body: body.body,
        type: body.type,
        url: body.url ?? "/",
        icon: body.icon ?? "/icons/icon-192x192.svg",
        badge: body.badge,
        image: body.image,
        data: body.data,
        targetFilter: {
          allUsers: targetFilter.allUsers ?? false,
          userIds: targetFilter.userIds?.map((id) => new mongoose.Types.ObjectId(id)) ?? [],
          roles: targetFilter.roles ?? [],
        },
        status: isScheduled ? "scheduled" : "sending",
        ...(scheduleAt ? { scheduledAt: scheduleAt } : {}),
        createdBy: new mongoose.Types.ObjectId(userId),
      });

      if (isScheduled) {
        return success(c, {
          success: true,
          notification,
          message: "Notification scheduled",
        });
      }

      const query: Record<string, unknown> = { active: true };

      if (targetFilter.roles?.length) {
        const users = (await mongoose
          .model("User")
          .find({ role: { $in: targetFilter.roles } }, { _id: 1 })
          .lean()) as Array<{ _id: mongoose.Types.ObjectId }>;
        query.userId = { $in: users.map((u) => u._id) };
      } else if (!targetFilter.allUsers) {
        if (targetFilter.subscriptionIds?.length) {
          query._id = {
            $in: targetFilter.subscriptionIds.map((id) => new mongoose.Types.ObjectId(id)),
          };
        } else if (targetFilter.userIds?.length) {
          query.userId = { $in: targetFilter.userIds.map((id) => new mongoose.Types.ObjectId(id)) };
        }
      }
      const subscriptions = await PushSubscription.find(query).lean();
      const totalSubs = subscriptions.length;

      if (totalSubs === 0) {
        await Notification.findByIdAndUpdate(notification._id.toString(), {
          status: "sent",
          sentAt: now,
          sentCount: 0,
        });
        return success(c, {
          success: true,
          sentCount: 0,
          failedCount: 0,
          notification,
        });
      }

      const { sentCount, failedCount } = await sendBulkPush(
        subscriptions as unknown as Array<{
          _id: string;
          endpoint: string;
          keys: { p256dh: string; auth: string };
          preferences?: Record<string, boolean>;
        }>,
        {
          title: body.title,
          body: body.body,
          type: body.type,
          icon: body.icon,
          badge: body.badge,
          image: body.image,
          data: body.data,
          url: body.url,
        }
      );

      const finalStatus: NotificationStatus =
        failedCount > 0 && sentCount === 0 ? "failed" : "sent";

      await Notification.findByIdAndUpdate(notification._id.toString(), {
        status: finalStatus,
        sentAt: now,
        sentCount,
        failedCount,
      });

      return success(c, {
        success: true,
        sentCount,
        failedCount,
        totalSubs,
        notificationId: notification._id.toString(),
      });
    } catch (err: unknown) {
      console.error("Error sending notification:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.notifications.send",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get("/", async (c) => {
  try {
    const { limit, page, skip } = parsePagination(c);
    await dbConnect();

    const type = c.req.query("type") as NotificationType | undefined;
    const status = c.req.query("status") as NotificationStatus | undefined;
    const fromDate = c.req.query("fromDate");
    const toDate = c.req.query("toDate");

    const query: Record<string, unknown> = {};
    if (type) query.type = type;
    if (status) query.status = status;
    const dateFilter = buildDateFilter(fromDate, toDate);
    if (Object.keys(dateFilter).length) Object.assign(query, dateFilter);

    const [items, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
    ]);

    return paginated(c, items, total, page, limit);
  } catch (err: unknown) {
    console.error("Error listing notifications:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.notifications.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/stats", async (c) => {
  try {
    await dbConnect();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalActiveSubscriptions, sentToday, sentThisMonth] = await Promise.all([
      PushSubscription.countDocuments({ active: true }),
      Notification.aggregate([
        { $match: { sentAt: { $gte: startOfToday } } },
        {
          $group: {
            _id: null,
            totalSent: { $sum: "$sentCount" },
            totalFailed: { $sum: "$failedCount" },
          },
        },
      ]),
      Notification.aggregate([
        { $match: { sentAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            totalSent: { $sum: "$sentCount" },
            totalFailed: { $sum: "$failedCount" },
          },
        },
      ]),
    ]);

    const todayStats = (sentToday[0] ?? { totalSent: 0, totalFailed: 0 }) as {
      totalSent: number;
      totalFailed: number;
    };
    const monthStats = (sentThisMonth[0] ?? { totalSent: 0, totalFailed: 0 }) as {
      totalSent: number;
      totalFailed: number;
    };
    const totalSentAll = monthStats.totalSent + monthStats.totalFailed;
    const averageDeliveryRate = totalSentAll > 0 ? monthStats.totalSent / totalSentAll : 0;

    return success(c, {
      totalActiveSubscriptions,
      totalSentToday: todayStats.totalSent,
      totalSentThisMonth: monthStats.totalSent,
      averageDeliveryRate: Math.round(averageDeliveryRate * 100) / 100,
    });
  } catch (err: unknown) {
    console.error("Error fetching notification stats:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.notifications.stats",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/subscriptions", async (c) => {
  try {
    await dbConnect();
    const { limit, page, skip } = parsePagination(c);
    const search = c.req.query("search");

    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { userAgent: { $regex: search, $options: "i" } },
        { endpoint: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      PushSubscription.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PushSubscription.countDocuments(query),
    ]);

    return paginated(c, items, total, page, limit);
  } catch (err: unknown) {
    console.error("Error listing push subscriptions:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.notifications.subscriptions.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/subscriptions/:id", async (c) => {
  try {
    await dbConnect();
    const item = await PushSubscription.findById(c.req.param("id")).lean();
    if (!item) return error(c, ErrorCodes.NOT_FOUND, "Push subscription not found", 404);
    return success(c, item);
  } catch (err: unknown) {
    console.error("Error fetching push subscription:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.notifications.subscriptions.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/subscriptions/:id", async (c) => {
  try {
    await dbConnect();
    const existing = await PushSubscription.findById(c.req.param("id"));
    if (!existing) return error(c, ErrorCodes.NOT_FOUND, "Push subscription not found", 404);

    existing.active = false;
    await existing.save();

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deactivating push subscription:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.notifications.subscriptions.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    await dbConnect();
    const item = await Notification.findById(c.req.param("id")).lean();
    if (!item) return error(c, ErrorCodes.NOT_FOUND, "Notification not found", 404);
    return success(c, item);
  } catch (err: unknown) {
    console.error("Error fetching notification:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.notifications.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put(
  "/:id",
  async (c, next) => validateBody(c, next, updateNotificationSchema),
  async (c) => {
    try {
      const body = c.get("body") as {
        title?: string;
        body?: string;
        type?: NotificationType;
        url?: string;
        icon?: string;
        image?: string;
        badge?: string;
        data?: Record<string, unknown>;
        scheduleAt?: string;
      };

      await dbConnect();
      const existing = await Notification.findById(c.req.param("id"));
      if (!existing) return error(c, ErrorCodes.NOT_FOUND, "Notification not found", 404);
      if (existing.status !== "draft" && existing.status !== "scheduled") {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "Only draft or scheduled notifications can be updated",
          400
        );
      }

      const updates: Partial<Record<string, unknown>> = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.body !== undefined) updates.body = body.body;
      if (body.type !== undefined) updates.type = body.type;
      if (body.url !== undefined) updates.url = body.url;
      if (body.icon !== undefined) updates.icon = body.icon;
      if (body.image !== undefined) updates.image = body.image;
      if (body.badge !== undefined) updates.badge = body.badge;
      if (body.data !== undefined) updates.data = body.data;
      if (body.scheduleAt !== undefined) {
        updates.scheduledAt = new Date(body.scheduleAt);
      }

      const updated = await Notification.findByIdAndUpdate(c.req.param("id"), updates, {
        returnDocument: "after",
      });

      return success(c, updated);
    } catch (err: unknown) {
      console.error("Error updating notification:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.notifications.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/:id", async (c) => {
  try {
    await dbConnect();
    const existing = await Notification.findById(c.req.param("id"));
    if (!existing) return error(c, ErrorCodes.NOT_FOUND, "Notification not found", 404);
    if (existing.status !== "draft" && existing.status !== "scheduled") {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Only draft or scheduled notifications can be deleted",
        400
      );
    }

    await Notification.findByIdAndDelete(c.req.param("id"));
    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting notification:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.notifications.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/resend", async (c) => {
  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return error(c, ErrorCodes.INTERNAL_ERROR, "VAPID keys not configured", 500);
    }

    await dbConnect();
    const existing = await Notification.findById(c.req.param("id"));
    if (!existing) return error(c, ErrorCodes.NOT_FOUND, "Notification not found", 404);
    if (existing.status === "draft" || existing.status === "scheduled") {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Cannot resend a draft or scheduled notification",
        400
      );
    }

    const query: Record<string, unknown> = { active: true };
    const targetFilter = existing.targetFilter as
      | { allUsers?: boolean; userIds?: string[]; roles?: string[] }
      | undefined;

    if (targetFilter && !targetFilter.allUsers) {
      if (targetFilter.roles?.length) {
        const users = (await mongoose
          .model("User")
          .find({ role: { $in: targetFilter.roles } }, { _id: 1 })
          .lean()) as Array<{ _id: mongoose.Types.ObjectId }>;
        query.userId = { $in: users.map((u) => u._id) };
      } else if (targetFilter.userIds?.length) {
        query.userId = { $in: targetFilter.userIds.map((id) => new mongoose.Types.ObjectId(id)) };
      }
    }

    const subscriptions = await PushSubscription.find(query).lean();
    const totalSubs = subscriptions.length;

    if (totalSubs === 0) {
      return success(c, {
        success: true,
        sentCount: 0,
        failedCount: 0,
      });
    }

    const { sentCount, failedCount } = await sendBulkPush(
      subscriptions as unknown as Array<{
        _id: string;
        endpoint: string;
        keys: { p256dh: string; auth: string };
        preferences?: Record<string, boolean>;
      }>,
      {
        title: existing.title,
        body: existing.body,
        type: existing.type,
        icon: existing.icon,
        badge: existing.badge,
        image: existing.image,
        data: existing.data,
        url: existing.url,
      }
    );

    existing.sentCount += sentCount;
    existing.failedCount += failedCount;
    existing.status = failedCount > 0 && sentCount === 0 ? "failed" : "sent";
    existing.sentAt = new Date();
    await existing.save();

    return success(c, {
      success: true,
      sentCount,
      failedCount,
      totalSubs,
    });
  } catch (err: unknown) {
    console.error("Error resending notification:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.notifications.resend",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
