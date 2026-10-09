import { PaymentMethod } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import { createStripeClient, type StripeClient } from "@oc/api-payment-stripe";
import { getEnv } from "@oc/env/server";
import {
  getStripeEnvironmentFromEnv,
  hasStripeEnvCredentials,
} from "./ensure-stripe-payment-method";
import { setCachedWebhookSecret } from "./providers/stripe";

export const STRIPE_WEBHOOK_EVENTS: string[] = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
];

export const STRIPE_SHOP_WEBHOOK_EVENTS: string[] = [
  "checkout.session.completed",
  "payment_intent.succeeded",
];

/** Events that must be delivered to the single unified webhook endpoint. */
export const STRIPE_UNIFIED_WEBHOOK_EVENTS: string[] = [
  ...STRIPE_WEBHOOK_EVENTS,
  "checkout.session.completed",
];

const log = createLogger("stripe:webhooks");

function resolveWebhookBaseUrl(): string | null {
  const override = getEnv("PUBLIC_WEBHOOK_URL")?.trim();
  if (override) return override.replace(/\/+$/, "");
  const appUrl = getEnv("APP_URL")?.trim();
  if (!appUrl) return null;
  return appUrl.replace(/\/+$/, "");
}

function isLocalUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return true;
  }
}

async function persistCreatedWebhookSecret(secret: string): Promise<void> {
  const environment = getStripeEnvironmentFromEnv();
  const credentialsField = environment === "live" ? "liveCredentials" : "sandboxCredentials";
  // Dotted-path set so the existing credentials object (secret key etc.) is
  // preserved instead of being clobbered by a whole-object replacement.
  await PaymentMethod.findOneAndUpdate(
    { provider: "stripe" },
    { $set: { [`${credentialsField}.webhookSecret`]: secret } }
  );
}

async function ensureEndpoint(
  client: StripeClient,
  url: string,
  enabledEvents: string[]
): Promise<void> {
  const endpoints = await client.listWebhookEndpoints();
  const existing = endpoints.data.find((ep) => ep.url === url);
  if (existing) {
    const existingEvents = (existing as { enabled_events?: string[] }).enabled_events ?? [];
    const existingSet = new Set(existingEvents);
    const drift = enabledEvents.some((ev) => !existingSet.has(ev));
    if (drift) {
      log.info(`[stripe] webhook endpoint at ${url} has event drift — updating enabled_events`, {
        expected: enabledEvents,
        actual: existingEvents,
      });
      const updated = await client.updateWebhookEndpoint({
        id: existing.id,
        enabledEvents,
      });
      if (updated.secret) {
        setCachedWebhookSecret(updated.secret);
        await persistCreatedWebhookSecret(updated.secret);
      }
      return;
    }
    log.info(`[stripe] webhook endpoint already registered at ${url}`);
    return;
  }

  const created = await client.createWebhookEndpoint({ url, enabledEvents });
  if (created.secret) {
    setCachedWebhookSecret(created.secret);
    await persistCreatedWebhookSecret(created.secret);
  }
  log.info(`[stripe] webhook endpoint created at ${url}`);
}

/**
 * Auto-registers the single unified Stripe webhook endpoint (orders + shop
 * events) at bootstrap. Idempotent by exact URL and reconciles enabled-event
 * drift; fail-open so a Stripe API error never breaks startup.
 * Skipped when: no Stripe credentials configured, a STRIPE_WEBHOOK_SECRET env
 * secret is set (manual mode), or the public URL is a local dev host.
 */
export async function registerStripeWebhooks(): Promise<void> {
  const envWebhookSecret = getEnv("STRIPE_WEBHOOK_SECRET")?.trim();
  if (envWebhookSecret) return;

  if (!hasStripeEnvCredentials()) return;

  const baseUrl = resolveWebhookBaseUrl();
  if (!baseUrl || isLocalUrl(baseUrl)) return;

  const client = createStripeClient();
  try {
    await ensureEndpoint(client, `${baseUrl}/api/payments/webhook/stripe`, [
      ...STRIPE_UNIFIED_WEBHOOK_EVENTS,
    ]);
  } catch (err) {
    log.error(
      `[stripe] webhook auto-registration failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
