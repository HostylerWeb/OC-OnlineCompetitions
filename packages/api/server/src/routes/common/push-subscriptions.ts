import { PushSubscription } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { created, error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { requireAdmin, requireSession } from "@oc/api-server/middleware/auth";
import { pushSubscribeRateLimit } from "@oc/api-server/middleware/rate-limit";
import { getEnv } from "@oc/env/server";
import { Hono } from "hono";
import webpush from "web-push";

const log = createLogger("push-subscriptions");
const app = new Hono();

const vapidPublicKey = getEnv("VAPID_PUBLIC_KEY");
const vapidPrivateKey = getEnv("VAPID_PRIVATE_KEY");

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:notifications@onlinecompetitions.com", vapidPublicKey, vapidPrivateKey);
}

app.post("/subscribe", requireSession, pushSubscribeRateLimit(), async (c) => {
  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return error(c, ErrorCodes.INTERNAL_ERROR, "VAPID keys not configured", 500);
    }

    const userId = c.get("userId")!;
    const body = await c.req.json<{ endpoint: string; keys: { p256dh: string; auth: string } }>();

    await dbConnect();

    await PushSubscription.findOneAndUpdate(
      { endpoint: body.endpoint },
      {
        endpoint: body.endpoint,
        keys: body.keys,
        active: true,
        userId,
        userAgent: c.req.header("user-agent"),
      },
      { upsert: true, new: true }
    );

    return created(c, { success: true });
  } catch (err: unknown) {
    log.error("Failed to subscribe push", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "push.subscribe",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/unsubscribe", async (c) => {
  try {
    const userId = c.get("userId");

    if (userId) {
      await dbConnect();
      await PushSubscription.deleteMany({ userId });
    }

    return success(c, { success: true });
  } catch (err: unknown) {
    log.error("Failed to unsubscribe push", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "push.unsubscribe",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/preferences", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return error(c, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
    }

    await dbConnect();

    const sub = await PushSubscription.findOne({ userId, active: true }, { preferences: 1 })
      .sort({ updatedAt: -1 })
      .lean();

    const preferences = (sub as { preferences?: Record<string, boolean> } | null)?.preferences ?? {
      marketing: true,
      system: true,
      draw_result: true,
      promotional: true,
      reminder: true,
    };

    return success(c, { preferences });
  } catch (err: unknown) {
    log.error("Failed to get push preferences", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "push.getPreferences",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.patch("/preferences", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return error(c, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
    }

    const body = await c.req.json<{
      marketing?: boolean;
      system?: boolean;
      draw_result?: boolean;
      promotional?: boolean;
      reminder?: boolean;
    }>();

    await dbConnect();

    const update: Record<string, boolean> = {};
    for (const key of ["marketing", "system", "draw_result", "promotional", "reminder"] as const) {
      if (body[key] !== undefined) {
        update[`preferences.${key}`] = body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      return success(c, { success: true, preferences: body });
    }

    await PushSubscription.updateMany({ userId, active: true }, { $set: update });

    return success(c, { success: true, preferences: body });
  } catch (err: unknown) {
    log.error("Failed to update push preferences", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "push.preferences",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/notify", requireAdmin, async (c) => {
  try {
    const body = await c.req.json<{ message: string }>();
    const result = await sendPushNotification(
      {
        title: "Online Competitions",
        body: body.message,
        url: "/",
      },
      {}
    );
    return success(c, { success: true, ...result });
  } catch (err: unknown) {
    log.error("Failed to send push notification", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "push.notify",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
