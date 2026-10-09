import { Notification } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { captureRouteError } from "@oc/api-infra/sentry";
import { sendPushNotification } from "@oc/api-server/lib/push";
import mongoose from "mongoose";

export type ProcessScheduledNotificationsSummary = {
  checkedAt: string;
  processedCount: number;
  failedCount: number;
};

export async function processScheduledNotifications(): Promise<ProcessScheduledNotificationsSummary> {
  console.log("[process-scheduled-notifications] Checking for due notifications...");
  const now = new Date();

  let processedCount = 0;
  let failedCount = 0;

  try {
    await dbConnect();

    if (!mongoose.models.User) {
      mongoose.model("User", new mongoose.Schema({}, { strict: false, collection: "user" }));
    }

    const dueNotifications = await Notification.find({
      status: "scheduled",
      scheduledAt: { $lte: now },
    }).lean();

    if (dueNotifications.length === 0) {
      console.log("[process-scheduled-notifications] No due notifications found.");
      return { checkedAt: now.toISOString(), processedCount: 0, failedCount: 0 };
    }

    console.log(
      `[process-scheduled-notifications] Found ${dueNotifications.length} due notification(s).`
    );

    for (const notification of dueNotifications) {
      try {
        await Notification.findByIdAndUpdate(notification._id, { status: "sending" });

        const targetFilter = (notification as unknown as Record<string, unknown>).targetFilter as {
          allUsers?: boolean;
          userIds?: string[];
          roles?: string[];
        } | null;

        const options: { userId?: string | string[] } = {};

        if (targetFilter && !targetFilter.allUsers) {
          if (targetFilter.roles?.length) {
            const users = (await mongoose
              .model("User")
              .find({ role: { $in: targetFilter.roles } }, { _id: 1 })
              .lean()) as Array<{ _id: mongoose.Types.ObjectId }>;
            if (users.length > 0) {
              options.userId = users.map((u) => u._id.toString());
            }
          } else if (targetFilter.userIds?.length) {
            options.userId = targetFilter.userIds.map((id) => id.toString());
          }
        }

        const result = await sendPushNotification(
          {
            title: notification.title,
            body: notification.body,
            type: notification.type as
              | "marketing"
              | "system"
              | "draw_result"
              | "promotional"
              | "reminder",
            url: notification.url ?? "/",
            icon: notification.icon ?? "/icons/icon-192x192.svg",
            badge: notification.badge,
            image: notification.image,
            data: notification.data as Record<string, unknown> | undefined,
          },
          options
        );

        const finalStatus = result.failedCount > 0 && result.sentCount === 0 ? "failed" : "sent";

        await Notification.findByIdAndUpdate(notification._id, {
          status: finalStatus,
          sentAt: new Date(),
          sentCount: result.sentCount,
          failedCount: result.failedCount,
        });

        processedCount++;
        console.log(
          `[process-scheduled-notifications] Sent notification ${notification._id}: ` +
            `${result.sentCount} sent, ${result.failedCount} failed`
        );
      } catch (err) {
        failedCount++;
        console.error(
          `[process-scheduled-notifications] Failed to process notification ${notification._id}:`,
          err
        );
        await Notification.findByIdAndUpdate(notification._id, { status: "failed" });
        captureRouteError(err, {
          domain: "internal_jobs",
          operation: "processScheduledNotifications",
        });
      }
    }
  } catch (err) {
    console.error("[process-scheduled-notifications] Fatal error:", err);
    captureRouteError(err, {
      domain: "internal_jobs",
      operation: "processScheduledNotifications",
    });
  }

  return {
    checkedAt: now.toISOString(),
    processedCount,
    failedCount,
  };
}
