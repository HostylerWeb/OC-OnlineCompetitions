import { createLogger } from "@oc/api-logger";
import { getAdapter } from "../index";
import type { PaymentProviderId, WebhookResult } from "../types";

/**
 * Dispatch a webhook to the right provider adapter, with no provider-specific
 * header parsing at the route level. Each adapter's `handleWebhook` reads
 * whatever headers it needs from the `headers` map; the SDK package owns
 * the signature verification.
 */
export async function dispatchWebhook(
  provider: string,
  body: string,
  headers: Record<string, string | null | undefined>
): Promise<WebhookResult> {
  log.info("[dispatchWebhook] ENTER", {
    provider,
    bodyLength: body.length,
    headerKeys: Object.keys(headers),
  });
  const adapter = getAdapter(provider as PaymentProviderId);

  const sig = extractSignature(provider, headers);
  try {
    const result = await adapter.handleWebhook(body, sig);
    log.info("[dispatchWebhook] adapter returned", {
      provider,
      eventType: result.eventType,
      status: result.status,
      sessionId: result.sessionId,
      orderId: result.orderId,
    });
    return result;
  } catch (err) {
    log.error("[dispatchWebhook] adapter threw", {
      provider,
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
}

function extractSignature(
  _provider: string,
  _headers: Record<string, string | null | undefined>
): string | null {
  if (_provider === "stripe") {
    return _headers["stripe-signature"] ?? null;
  }
  // Paytriot signature is in POST body, not a header
  return null;
}

const log = createLogger("webhook");
