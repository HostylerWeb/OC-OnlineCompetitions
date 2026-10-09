import { PushSubscription } from "@oc/api-db/models";
import { getEnv } from "@oc/env/server";
import mongoose from "mongoose";
import webpush from "web-push";
import type { PushPayload, SendPushOptions, SendPushResult } from "./types";
import { BATCH_INTERVAL_MS, BATCH_SIZE, DEFAULT_ICON } from "./types";

const vapidPublicKey = getEnv("VAPID_PUBLIC_KEY");
const vapidPrivateKey = getEnv("VAPID_PRIVATE_KEY");

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:notifications@onlinecompetitions.com", vapidPublicKey, vapidPrivateKey);
}

function buildPayload(p: PushPayload): string {
  return JSON.stringify({
    title: p.title,
    body: p.body,
    icon: p.icon ?? DEFAULT_ICON,
    badge: p.badge ?? DEFAULT_ICON,
    image: p.image,
    data: p.data ?? {},
    url: p.url ?? "/",
    tag: p.tag,
    actions: p.actions,
    requireInteraction: p.requireInteraction,
    silent: p.silent,
    vibrate: p.vibrate,
  });
}

export async function sendPushNotification(
  payload: PushPayload,
  options: SendPushOptions = {}
): Promise<SendPushResult> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[push] VAPID keys not configured — skipping notification");
    return { sentCount: 0, failedCount: 0, totalTargeted: 0, details: [] };
  }

  const query: Record<string, unknown> = { active: true };

  const { userId, subscriptionId } = options;

  if (userId && Array.isArray(userId) && userId.length > 0) {
    query.userId = { $in: userId.map((id) => new mongoose.Types.ObjectId(id)) };
  } else if (userId && typeof userId === "string") {
    query.userId = new mongoose.Types.ObjectId(userId);
  }

  if (subscriptionId && Array.isArray(subscriptionId) && subscriptionId.length > 0) {
    query._id = { $in: subscriptionId.map((id) => new mongoose.Types.ObjectId(id)) };
  } else if (subscriptionId && typeof subscriptionId === "string") {
    query._id = new mongoose.Types.ObjectId(subscriptionId);
  }

  let subscriptions = await PushSubscription.find(query).lean();

  const notifType = payload.type;
  if (notifType) {
    subscriptions = subscriptions.filter(
      (sub) =>
        !sub.preferences ||
        (sub.preferences as Record<string, boolean | undefined>)[notifType] !== false
    );
  }

  const totalTargeted = subscriptions.length;

  if (totalTargeted === 0) {
    return { sentCount: 0, failedCount: 0, totalTargeted: 0, details: [] };
  }

  const payloadString = buildPayload(payload);
  let sentCount = 0;
  let failedCount = 0;
  const details: { subscriptionId: string; status: "sent" | "failed"; error?: string }[] = [];

  for (let i = 0; i < totalTargeted; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webpush.sendNotification(sub as unknown as webpush.PushSubscription, payloadString)
      )
    );

    for (let j = 0; j < results.length; j++) {
      const settledResult = results[j]!;
      const subId = (batch[j] as { _id: { toString: () => string } })._id.toString();

      if (settledResult.status === "fulfilled") {
        sentCount++;
        details.push({ subscriptionId: subId, status: "sent" });
        options.onSent?.(subId);
      } else {
        failedCount++;
        const error = settledResult.reason as Error & { statusCode?: number };
        details.push({ subscriptionId: subId, status: "failed", error: error.message });

        if (error.statusCode === 410 || error.statusCode === 404) {
          await PushSubscription.findByIdAndDelete(subId).catch((err) =>
            console.warn("[push] failed to remove stale subscription:", err)
          );
        }
        options.onFailed?.(subId, error);
      }
    }

    if (i + BATCH_SIZE < totalTargeted) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL_MS));
    }
  }

  return { sentCount, failedCount, totalTargeted, details };
}
