import { Cart, Order, PendingWebhook } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { captureRouteError } from "@oc/api-infra/sentry";
import { markOrderFailed } from "@oc/api-server/lib/payment/providers/_shared/order-helpers";
import { getAdapter } from "@oc/api-server/lib/payment/providers";
import type { PaymentProviderId } from "@oc/api-server/lib/payment/providers/types";

const ABANDONED_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_PROCESSING_TTL_MS = 2 * 60 * 60 * 1000;

export type CleanupAbandonedOrdersSummary = {
  checkedAt: string;
  abandonedCount: number;
  staleProcessingCount: number;
  releasedCount: number;
  failedCount: number;
  retriedWebhooksCount: number;
};

export async function runCleanupAbandonedOrders(): Promise<CleanupAbandonedOrdersSummary> {
  console.log("[cleanup-abandoned-orders] Running abandoned order cleanup...");
  const now = new Date();
  const cutoff = new Date(now.getTime() - ABANDONED_TTL_MS);

  let abandonedCount = 0;
  let staleProcessingCount = 0;
  let releasedCount = 0;
  let failedCount = 0;
  let retriedCount = 0;

  try {
    await dbConnect();

    const abandonedOrders = await Order.find({
      status: "pending",
      createdAt: { $lte: cutoff },
    }).lean();

    abandonedCount = abandonedOrders.length;
    const affectedUserIds = [
      ...new Set(
        abandonedOrders.map((o) => (typeof o.userId === "string" ? o.userId : String(o.userId)))
      ),
    ];

    if (abandonedCount === 0) {
      console.log("[cleanup-abandoned-orders] No abandoned orders found", {
        checkedAt: now.toISOString(),
      });
      return {
        checkedAt: now.toISOString(),
        abandonedCount: 0,
        staleProcessingCount: 0,
        releasedCount: 0,
        failedCount: 0,
        retriedWebhooksCount: 0,
      };
    }

    for (const order of abandonedOrders) {
      try {
        if (order.providerSessionId) {
          try {
            const adapter = getAdapter(order.provider as PaymentProviderId);
            await adapter.voidSession(order.providerSessionId);
          } catch {
            // Non-critical — payment may already be expired on provider side
          }
        }

        await markOrderFailed(order);
        releasedCount++;
      } catch (err) {
        console.error(
          `[cleanup-abandoned-orders] Failed to clean up order ${order._id.toString()}:`,
          err
        );
        failedCount++;
      }
    }

    const processingCutoff = new Date(now.getTime() - STALE_PROCESSING_TTL_MS);
    const staleProcessing = await Order.find({
      status: "processing",
      updatedAt: { $lte: processingCutoff },
    }).lean();
    staleProcessingCount = staleProcessing.length;
    for (const order of staleProcessing) {
      try {
        await markOrderFailed(order);
        releasedCount++;
      } catch (err) {
        console.error(
          `[cleanup-abandoned-orders] Failed to fail stale processing order ${order._id.toString()}:`,
          err
        );
        failedCount++;
      }
    }

    // Clean up abandoned carts (no activity for 7 days, with items)
    const abandonedCarts = await Cart.find({
      lastActivityAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      "items.0": { $exists: true },
    });
    for (const cart of abandonedCarts) {
      await (Cart as any).softDelete(cart._id);
    }

    // Retry pending webhooks where the order has since been found
    const pendingWebhooks = await PendingWebhook.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).lean();

    for (const pw of pendingWebhooks) {
      try {
        if (pw.eventId) {
          const orderExists = await Order.findOne({ providerSessionId: pw.eventId }).lean();
          if (!orderExists) continue;

          const adapter = getAdapter(pw.provider as PaymentProviderId);
          if (adapter.handleWebhook) {
            // If the order is already failed, skip the webhook and delete it
            if (orderExists.status === "failed") {
              await PendingWebhook.findByIdAndDelete(pw._id);
              continue;
            }

            const result = await adapter.handleWebhook(pw.payload, pw.signature ?? null);
            if (result.status === "completed") {
              await PendingWebhook.findByIdAndDelete(pw._id);
              retriedCount++;
            }
          }
        }
      } catch (err) {
        console.error(`[cleanup-abandoned-orders] Failed to retry pending webhook ${pw._id}:`, err);
      }
    }
    void invalidateByChannelSafe(
      CH.competitionAvailability,
      CH.competitionsAvailabilityBatch,
      CH.competitions,
      CH.competitionDetail
    ).catch(() => {});
    for (const uid of affectedUserIds) void invalidateUser(uid).catch(() => {});

    console.log("[cleanup-abandoned-orders] Cleanup complete", {
      abandonedCount,
      staleProcessingCount,
      releasedCount,
      failedCount,
      abandonedCartsCount: abandonedCarts.length,
      retriedWebhooksCount: retriedCount,
      checkedAt: now.toISOString(),
    });
  } catch (err: unknown) {
    console.error("[cleanup-abandoned-orders] Error during abandoned order cleanup:", {
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      checkedAt: now.toISOString(),
    });
    captureRouteError(err, {
      domain: "jobs",
      jobName: "cleanup-abandoned-orders",
      operation: "runInternalJob",
    });
    throw err;
  }

  return {
    checkedAt: now.toISOString(),
    abandonedCount,
    staleProcessingCount,
    releasedCount,
    failedCount,
    retriedWebhooksCount: retriedCount,
  };
}
