import { PendingWebhook } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";

const log = createLogger("pending-webhooks");

export interface StorePendingWebhookParams {
  body: string;
  provider: string;
  orderId: string | null;
  eventId: string;
  signature?: string | null;
}

export async function storePendingWebhook(params: StorePendingWebhookParams): Promise<void> {
  try {
    await PendingWebhook.create({
      provider: params.provider,
      eventId: params.eventId,
      orderId: params.orderId,
      payload: params.body,
      signature: params.signature ?? null,
    });
    log.warn(
      `[pending-webhook] Stored unprocessed ${params.provider} webhook eventId=${params.eventId}`
    );
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      log.debug(
        `[pending-webhook] Duplicate event skipped provider=${params.provider} eventId=${params.eventId}`
      );
      return;
    }
    log.error(
      `[pending-webhook] Failed to store event provider=${params.provider} eventId=${params.eventId} error=${err instanceof Error ? err.message : "unknown"}`
    );
  }
}
