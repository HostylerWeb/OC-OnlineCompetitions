import { Order, PaymentMethod } from "@oc/api-db/models";
import { withMongoTransactionOptional } from "@oc/api-infra/mongo-capabilities";
import { createLogger } from "@oc/api-logger";
import { rollbackOrderRefund } from "@oc/api-payment-core";
import type { StripeWebhookEvent } from "@oc/api-payment-stripe";
import {
  createStripeClient,
  resolveStripeConfig,
  type StripeClient,
  StripeError,
} from "@oc/api-payment-stripe";
import {
  computeCheckoutTotal,
  computeGatewayChargeAmount,
  createPendingCheckoutOrder,
} from "@oc/api-tickets/create-session";
import { Types } from "mongoose";
import { reserveCheckoutPromoCode } from "../build-fulfillment-deps";
import { buildRefundDeps } from "../build-refund-deps";
import { getStripeEnvironmentFromEnv } from "../ensure-stripe-payment-method";
import { finalizeSuccessfulOrder } from "../finalize-successful-order";
import { resolveOrderReadScope } from "../guest-order-owners";
import {
  getStripeChargeLookupIds,
  getStripePaymentIntentIdFromEvent,
} from "../stripe-webhook-lookup";
import { getProviderCurrency } from "./_shared/currency";
import { markOrderFailed } from "./_shared/order-helpers";
import { storePendingWebhook } from "./_shared/pending-webhooks";
import { retryStuckFulfillment } from "./_shared/retry-helpers";
import type {
  CreateSessionParams,
  CreateSessionResult,
  PaymentProviderAdapter,
  PaymentProviderId,
  PaymentSessionStatus,
  WebhookResult,
} from "./types";

let _cachedWebhookSecret: string | null = null;

export function setCachedWebhookSecret(secret: string): void {
  _cachedWebhookSecret = secret;
}

async function readWebhookSecretFromDb(): Promise<string | null> {
  try {
    const environment = getStripeEnvironmentFromEnv();
    const credentialsField = environment === "live" ? "liveCredentials" : "sandboxCredentials";
    const row = (await PaymentMethod.findOne({ provider: "stripe" }).lean()) as
      | (Record<string, unknown> & {
          sandboxCredentials?: unknown;
          liveCredentials?: unknown;
        })
      | null;
    const creds = row?.[credentialsField] as { webhookSecret?: string } | undefined;
    return creds?.webhookSecret?.trim() || null;
  } catch {
    return null;
  }
}

export async function getResolvedWebhookSecret(): Promise<string> {
  if (_cachedWebhookSecret) return _cachedWebhookSecret;
  const config = resolveStripeConfig();
  if (config.webhookSecret) {
    _cachedWebhookSecret = config.webhookSecret;
    return _cachedWebhookSecret;
  }
  const fromDb = await readWebhookSecretFromDb();
  if (fromDb) {
    _cachedWebhookSecret = fromDb;
    return fromDb;
  }
  throw new Error("STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED");
}

function getStripeClient(): StripeClient {
  return createStripeClient();
}

/**
 * PaymentIntent states the customer can still pay from. The Payment Element
 * reuses a single PaymentIntent across attempts, so a declined attempt puts
 * the intent back into `requires_payment_method` instead of ending it.
 */
const RETRYABLE_INTENT_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
]);

/**
 * States in which a client secret can still be handed to Elements. Narrower
 * than the retryable set: an intent that is already `processing` must not be
 * mounted for a fresh payment attempt.
 */
const REUSABLE_INTENT_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

/** Strip the `_secret_…` suffix from a client secret to get the intent id. */
function intentIdFromSessionId(sessionId: string): string {
  return sessionId.includes("_secret_") ? sessionId.split("_secret_")[0]! : sessionId;
}

/**
 * True when `sessionId` still points at a PaymentIntent the customer can pay.
 * A canceled or already-succeeded intent cannot be mounted by Elements — it
 * fails to load and the checkout page reports the session as expired, with no
 * way to recover because the stale id is handed back on every retry.
 */
async function isReusableSession(sessionId: string): Promise<boolean> {
  try {
    const intent = await getStripeClient().retrievePaymentIntent(intentIdFromSessionId(sessionId));
    return REUSABLE_INTENT_STATUSES.has(String(intent.status ?? ""));
  } catch (err: unknown) {
    log.warn("[stripe.createSession] could not verify existing intent, creating a new one", {
      sessionId: intentIdFromSessionId(sessionId),
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function extractChargeMetadata(data: Record<string, unknown>): {
  paymentMethodType?: string;
  last4?: string;
  brand?: string;
} {
  const charges = data.charges as { data?: Array<Record<string, unknown>> } | undefined;
  if (!charges?.data?.length) return {};
  const charge = charges.data[0] as Record<string, unknown> | undefined;
  if (!charge) return {};
  const pmDetails = charge.payment_method_details as Record<string, unknown> | undefined;
  if (!pmDetails) return {};
  const card = pmDetails.card as Record<string, unknown> | undefined;
  return {
    paymentMethodType: (pmDetails.type as string) ?? undefined,
    last4: (card?.last4 as string) ?? undefined,
    brand: (card?.brand as string) ?? undefined,
  };
}

export const stripeAdapter: PaymentProviderAdapter = {
  id: "stripe" as PaymentProviderId,

  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    log.debug(`[stripe.createSession] enter`, {
      userId: params.userId,
      itemsLength: params.items.length,
      competitionIds: params.items.map((i) => i.competitionId),
      idempotencyKey: params.idempotencyKey ? "present" : "missing",
    });

    if (params.idempotencyKey) {
      const siteCreditApplied = params.siteCreditApplied ?? 0;
      const gatewayAmount = computeGatewayChargeAmount(
        params.subtotal,
        params.discount,
        siteCreditApplied
      );

      const existingOrder = await Order.findOne({
        userId: new Types.ObjectId(params.userId),
        idempotencyKey: params.idempotencyKey,
        provider: "stripe",
        status: "pending",
      }).lean();

      if (existingOrder?.providerSessionId) {
        const sessionId = existingOrder.providerSessionId;
        const storedGateway =
          Number((existingOrder.metadata as Record<string, unknown> | undefined)?.gatewayAmount) ||
          existingOrder.total ||
          0;
        const totalsMatch = Math.abs(storedGateway - gatewayAmount) < 0.01;
        if (totalsMatch && (await isReusableSession(sessionId))) {
          log.debug(`[stripe.createSession] pendingOrderExists=true, returning existing session`);
          return {
            sessionId,
            orderId: existingOrder._id.toString(),
            redirectUrl: `${params.frontendUrl}/checkout/success?provider=stripe&session_id=${sessionId}&order_id=${existingOrder._id.toString()}`,
          };
        }
        // Stale session — fall through and mint a fresh intent. Cancel the old
        // one best-effort so it does not linger as an open intent on Stripe.
        log.info("[stripe.createSession] existing intent is no longer payable, replacing it", {
          orderId: existingOrder._id.toString(),
          intentId: intentIdFromSessionId(sessionId),
        });
        await Promise.resolve(stripeAdapter.voidSession(sessionId)).catch(() => {});
      }
    }

    const siteCreditApplied = params.siteCreditApplied ?? 0;
    const gatewayAmount = computeGatewayChargeAmount(
      params.subtotal,
      params.discount,
      siteCreditApplied
    );
    const totalInCents = Math.round(gatewayAmount * 100);

    const client = getStripeClient();
    const intent = await client.createPaymentIntent({
      amount: totalInCents,
      currency: getProviderCurrency(stripeAdapter.id).toLowerCase(),
      metadata: {
        userId: params.userId,
        cartId: params.cartId ?? "",
      },
    });

    if (!intent.id) {
      throw new Error("Stripe payment intent creation failed");
    }

    log.debug(`[stripe.createSession] PaymentIntent created`, {
      intentId: intent.id,
      status: "created",
    });

    const sessionIdForVoid = intent.clientSecret ?? intent.id;

    let orderRecord;
    try {
      orderRecord = await createPendingCheckoutOrder({
        userId: params.userId,
        items: params.items,
        subtotal: params.subtotal,
        discount: params.discount,
        promoCode: params.promoCode,
        referralCode: params.referralCode,
        providerSessionId: intent.clientSecret ?? intent.id,
        provider: "stripe",
        idempotencyKey: params.idempotencyKey,
        shippingAddress: params.shippingAddress,
        cartId: params.cartId,
        referralBonusTickets: params.referralBonusTickets,
        referralBalanceUsed: params.referralBalanceUsed,
        siteCreditApplied: siteCreditApplied > 0 ? siteCreditApplied : undefined,
        isGuestCheckout: params.isGuestCheckout,
        orderEmail: params.orderEmail,
      });
    } catch (err: unknown) {
      // The pending order could not be recorded — cancel the intent
      // best-effort so no dangling payment session is left behind, then
      // surface the original failure.
      await Promise.resolve(stripeAdapter.voidSession(sessionIdForVoid)).catch(() => {});
      throw err;
    }

    await Order.findByIdAndUpdate(orderRecord._id, {
      $set: { "metadata.stripePaymentIntentId": intent.id },
    });

    // Best-effort: tag the PaymentIntent with the order id so remote lookups
    // (status polling, capture) can resolve it. Never fails the checkout.
    void Promise.resolve(
      client.updatePaymentIntent({
        paymentIntentId: intent.id,
        metadata: { ...(intent.metadata ?? {}), orderId: orderRecord._id.toString() },
      })
    ).catch((err: unknown) => {
      log.warn("[stripe.createSession] failed to attach orderId metadata to intent", {
        orderId: orderRecord._id.toString(),
        intentId: intent.id,
        err: err instanceof Error ? err.message : String(err),
      });
    });

    // `createPendingCheckoutOrder` upserts on the idempotency key, so repeated
    // checkout attempts for one cart all resolve to the *same* order. Reserving
    // the promo code again on every attempt burns its usage allowance until
    // reservation starts failing — which then voids each new intent and locks
    // the customer out of checkout entirely. Reserve once per order.
    const orderMetadata = (orderRecord.metadata ?? {}) as Record<string, unknown>;
    if (params.promoCode && !orderMetadata.promoReservedAt) {
      const promoReserved = await reserveCheckoutPromoCode(params.promoCode, params.userId);
      if (!promoReserved) {
        await Order.findByIdAndUpdate(orderRecord._id, { $set: { status: "failed" } });
        await Promise.resolve(stripeAdapter.voidSession(sessionIdForVoid)).catch(() => {});
        throw new Error("Promo code could not be reserved — it may have reached its maximum uses");
      }
      await Order.findByIdAndUpdate(orderRecord._id, {
        $set: { "metadata.promoReservedAt": new Date().toISOString() },
      });
    }

    log.debug(`[stripe.createSession] order record created`, {
      orderId: orderRecord._id.toString(),
      status: "pending",
    });
    log.debug(`[stripe.createSession] exit`);
    return {
      sessionId: intent.clientSecret ?? intent.id,
      orderId: orderRecord._id.toString(),
      redirectUrl: `${params.frontendUrl}/checkout/success?provider=stripe&session_id=${intent.clientSecret ?? intent.id}&order_id=${orderRecord._id.toString()}`,
    };
  },

  async getSessionStatus(sessionId: string, userId?: string): Promise<PaymentSessionStatus> {
    const scope = userId ? await resolveOrderReadScope(userId) : undefined;
    const sessionMatch = {
      $or: [{ providerSessionId: sessionId }, { "metadata.stripePaymentIntentId": sessionId }],
    };
    const ownerMatch = scope
      ? { $or: [{ userId: { $in: scope.userIds } }, { orderEmail: { $in: scope.emails } }] }
      : null;

    const order = await Order.findOne(
      ownerMatch ? { $and: [sessionMatch, ownerMatch] } : sessionMatch
    ).lean();

    if (!order) {
      if (scope) {
        // Trace from the client secret (possession of the secret is the
        // auth factor — it only ever leaves the server inside the creator's
        // redirect URL). Verifies against Stripe before trusting the order.
        const possessed = await findOrderBySessionPossession(sessionId, sessionMatch);
        if (possessed) {
          if (possessed.status === "completed" || possessed.status === "processing") {
            return { status: possessed.status, orderId: possessed._id.toString() };
          }
          return { status: "pending", orderId: possessed._id.toString() };
        }
      }
      return { status: "failed", orderId: undefined };
    }

    if (order.status === "completed") {
      return { status: "completed", orderId: order._id.toString() };
    }
    if (order.status === "pending") {
      return { status: "pending", orderId: order._id.toString() };
    }
    if (order.status === "processing") {
      return { status: "processing", orderId: order._id.toString() };
    }

    return {
      status: order.status as PaymentSessionStatus["status"],
      orderId: order._id.toString(),
    };
  },

  async captureSession(sessionId: string, userId?: string): Promise<PaymentSessionStatus> {
    const scope = userId ? await resolveOrderReadScope(userId) : undefined;
    const sessionMatch = {
      $or: [{ providerSessionId: sessionId }, { "metadata.stripePaymentIntentId": sessionId }],
    };
    const ownerMatch = scope
      ? { $or: [{ userId: { $in: scope.userIds } }, { orderEmail: { $in: scope.emails } }] }
      : null;

    let order = await Order.findOne(
      ownerMatch ? { $and: [sessionMatch, ownerMatch] } : sessionMatch
    );
    if (!order && scope) {
      const possessed = await findOrderBySessionPossession(sessionId, sessionMatch);
      if (possessed) {
        order = await Order.findOne(sessionMatch);
      }
    }
    if (!order) {
      throw new Error("Order not found");
    }

    if (
      order.status === "completed" ||
      order.status === "refunded" ||
      order.status === "processing"
    ) {
      return {
        status: order.status as PaymentSessionStatus["status"],
        orderId: order._id.toString(),
      };
    }

    if (order.status === "pending") {
      // The webhook may not have landed yet — ask Stripe for ground truth.
      // If the PaymentIntent already succeeded, finalize exactly like the
      // webhook would so the customer is not left hanging.
      const metadata = (order.metadata ?? {}) as Record<string, unknown>;
      let intentId = metadata.stripePaymentIntentId as string | undefined;
      if (!intentId && order.providerSessionId) {
        const raw = order.providerSessionId;
        intentId = raw.includes("_secret_") ? raw.split("_secret_")[0]! : raw;
      }
      if (intentId) {
        try {
          const intent = await getStripeClient().retrievePaymentIntent(intentId);
          if (intent.status === "succeeded") {
            await Order.findByIdAndUpdate(order._id, {
              $set: { "metadata.stripePaymentIntentId": intentId },
            });
            const uid =
              order.userId instanceof Types.ObjectId
                ? order.userId.toString()
                : String(order.userId);
            const finalizeResult = await finalizeSuccessfulOrder({
              orderId: order._id.toString(),
              userId: uid,
              captureId: intentId,
              source: "capture",
              logPrefix: "Stripe",
            });
            return {
              status: finalizeResult === "in-progress" ? "processing" : ("completed" as const),
              orderId: order._id.toString(),
            };
          }
        } catch (err: unknown) {
          // Tolerate retrieval/finalize failures here — the webhook remains
          // the authoritative completion path. Surface status as-is.
          log.warn("[stripe.captureSession] remote intent check failed", {
            intentId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return { status: "pending", orderId: order._id.toString() };
    }

    return stripeAdapter.getSessionStatus(sessionId, userId);
  },

  async handleWebhook(body: string, sig: string | null | undefined): Promise<WebhookResult> {
    if (!sig) {
      throw new Error("STRIPE_WEBHOOK_SIGNATURE_MISSING");
    }

    const webhookSecret = await getResolvedWebhookSecret();
    const client = getStripeClient();

    let event: StripeWebhookEvent;
    try {
      event = await client.verifyWebhookSignature(body, sig, webhookSecret);
    } catch (err) {
      if (err instanceof StripeError && err.code === "WEBHOOK_INVALID") {
        throw new Error("STRIPE_WEBHOOK_SIGNATURE_INVALID");
      }
      throw err;
    }

    const eventType = event.type;
    const data = event.data.object;
    const sessionId = String(data.id ?? "");

    if (eventType === "payment_intent.succeeded") {
      const intentId = getStripePaymentIntentIdFromEvent(event);
      const order = await Order.findOne({
        $or: [{ "metadata.stripePaymentIntentId": intentId }, { providerSessionId: intentId }],
      });
      if (!order) {
        await storePendingWebhook({
          body,
          provider: "stripe",
          orderId: null,
          eventId: event.id,
          signature: sig,
        });
        return { eventType, sessionId: intentId, status: "failed" };
      }

      if (order.status === "failed") {
        // The order was marked failed (cleanup, payment_failed, promo
        // failure) but the payment ultimately succeeded — we cannot fulfill
        // it. Never finalize-throw here: that 500s the webhook and Stripe
        // retries forever (retry storm). Instead claim an automatic refund
        // through the existing refund machinery and always return 200.
        await claimFailedOrderAutoRefund(order);
        return {
          eventType,
          sessionId: intentId,
          status: "processing",
          orderId: order._id.toString(),
        };
      }

      const userId =
        typeof order.userId === "string"
          ? order.userId
          : (order.userId as Types.ObjectId).toString();

      const chargeMeta = extractChargeMetadata(data);
      await Order.findByIdAndUpdate(order._id, {
        $set: {
          "metadata.stripePaymentMethodType": chargeMeta.paymentMethodType ?? null,
          "metadata.stripeLast4": chargeMeta.last4 ?? null,
          "metadata.stripeBrand": chargeMeta.brand ?? null,
          "metadata.stripePaymentIntentId": intentId,
        },
      });

      const finalizeResult = await finalizeSuccessfulOrder({
        orderId: order._id.toString(),
        userId,
        captureId: intentId,
        source: "webhook",
        logPrefix: "Stripe",
      });

      return {
        eventType,
        sessionId: intentId,
        status: finalizeResult === "in-progress" ? "processing" : "completed",
        orderId: order._id.toString(),
      };
    }

    if (eventType === "payment_intent.payment_failed") {
      const intentId = data.id as string;
      const order = await Order.findOne({
        $or: [{ "metadata.stripePaymentIntentId": intentId }, { providerSessionId: intentId }],
      });

      // A declined attempt is not the end of the payment. The Payment Element
      // reuses one PaymentIntent, so Stripe returns it to a payable state and
      // the customer can try another card on the same intent. Failing the
      // order here means the eventual `payment_intent.succeeded` finds it
      // already failed and takes the auto-refund branch — stranding a customer
      // who paid successfully on their second attempt. Record the attempt and
      // leave the order open.
      const intentStatus = String(data.status ?? "");
      if (RETRYABLE_INTENT_STATUSES.has(intentStatus)) {
        if (order) {
          const lastError = data.last_payment_error as { code?: string } | undefined;
          await Order.findByIdAndUpdate(order._id, {
            $set: {
              "metadata.stripeLastAttemptFailedAt": new Date().toISOString(),
              "metadata.stripeLastAttemptErrorCode": lastError?.code ?? null,
            },
          });
        }
        log.info("[stripe.webhook] payment attempt failed but intent is still payable", {
          intentId,
          intentStatus,
          orderId: order?._id.toString() ?? null,
        });
        return {
          eventType,
          sessionId: intentId,
          status: "pending",
          orderId: order?._id.toString(),
        };
      }

      if (order && order.status !== "completed" && order.status !== "refunded") {
        await markOrderFailed(order);
      }
      return { eventType, sessionId: intentId, status: "failed", orderId: order?._id.toString() };
    }

    if (eventType === "charge.refunded") {
      const { chargeId, paymentIntentId } = getStripeChargeLookupIds(event);
      const order = await Order.findOne({
        $or: [
          { "metadata.stripePaymentIntentId": paymentIntentId },
          { providerSessionId: paymentIntentId },
        ],
      });
      if (order) {
        await withMongoTransactionOptional(async (txnSession) => {
          const now = new Date().toISOString();
          const claimed = await Order.findOneAndUpdate(
            { _id: order._id, "metadata.refundProcessedAt": { $exists: false } },
            {
              $set: {
                "metadata.refundProcessedAt": now,
                "metadata.refundedVia": "stripe_webhook",
                "metadata.refundedAt": now,
              },
            },
            { returnDocument: "after", session: txnSession ?? undefined }
          );
          if (!claimed) return;

          const refundDeps = buildRefundDeps();
          const refundResult = await rollbackOrderRefund(
            order._id.toString(),
            order.userId.toString(),
            null,
            "Stripe refund webhook",
            refundDeps,
            txnSession ?? undefined
          );

          if (!refundResult.success) {
            throw new Error(refundResult.error ?? "Stripe refund rollback failed");
          }

          await Order.findByIdAndUpdate(
            order._id,
            {
              $set: { status: "refunded" },
              $push: {
                "metadata.refunds": {
                  refundId: chargeId,
                  source: "stripe_webhook",
                  at: now,
                },
              },
            },
            { session: txnSession ?? undefined }
          );
        });
      }
      return { eventType, sessionId, status: "processing", orderId: order?._id.toString() };
    }

    if (eventType === "charge.dispute.created") {
      const chargeId = data.id as string;
      const piId = data.payment_intent as string | undefined;
      const order = await Order.findOne({
        $or: [
          ...(piId
            ? [{ "metadata.stripePaymentIntentId": piId }, { providerSessionId: piId }]
            : []),
          ...(chargeId ? [{ "metadata.refunds.refundId": chargeId }] : []),
        ].filter(Boolean),
      });
      if (order) {
        // Claim-style append (no read-modify-write of the whole array) so
        // concurrent dispute events cannot clobber each other.
        await Order.findOneAndUpdate(
          { _id: order._id, "metadata.disputes.disputeId": { $ne: data.id } },
          {
            $push: {
              "metadata.disputes": {
                disputeId: data.id as string,
                chargeId,
                reason: data.reason as string,
                status: data.status as string,
                createdAt: new Date().toISOString(),
              },
            },
          }
        );
      }
      return { eventType, sessionId, status: "processing", orderId: order?._id.toString() };
    }

    if (eventType === "charge.dispute.closed") {
      const _chargeId = data.id as string;
      const order = await Order.findOne({
        "metadata.disputes.disputeId": data.id as string,
      });
      if (order) {
        await Order.findOneAndUpdate(
          { _id: order._id, "metadata.disputes.disputeId": data.id as string },
          {
            $set: {
              "metadata.disputes.$.resolution": data.status as string,
              "metadata.disputes.$.resolvedAt": new Date().toISOString(),
            },
          }
        );
      }
      return { eventType, sessionId, status: "processing", orderId: order?._id.toString() };
    }

    return { eventType, sessionId, status: "processing" };
  },

  async testCredentials(
    environment: "sandbox" | "live",
    _clientIdOverride?: string,
    secretOverride?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stripeEnv = environment === "sandbox" ? "test" : "live";
      const client = createStripeClient({
        secretKey: secretOverride,
        environment: stripeEnv,
      });
      await client.retrievePaymentIntent("pi_test_credentials_validation");
      return { success: true };
    } catch (err: unknown) {
      if (err instanceof StripeError) {
        if (err.code === "AUTH_FAILED") {
          return { success: false, error: err.message };
        }
        if (err.code === "INVALID_REQUEST" || err.code === "INVALID_INTENT") {
          return { success: true };
        }
      }
      const message = err instanceof Error ? err.message : "Stripe credential test failed";
      return { success: false, error: message };
    }
  },

  async voidSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const piId = sessionId.includes("_secret_") ? sessionId.split("_secret_")[0]! : sessionId;
      await getStripeClient().cancelPaymentIntent(piId);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stripe void failed";
      return { success: false, error: message };
    }
  },
};

/**
 * Resolve an order purely from possession of the provider session id (the
 * Stripe client secret only ever reaches the creator's redirect URL). The
 * remote intent check gates the match so unowned orders can never be probed
 * into visibility via a guessable / leaked id.
 */
async function findOrderBySessionPossession(
  sessionId: string,
  sessionMatch: Record<string, unknown>
): Promise<{ _id: Types.ObjectId; status: string } | null> {
  const candidate = await Order.findOne(sessionMatch).lean();
  if (!candidate) return null;

  try {
    const piId = sessionId.includes("_secret_") ? sessionId.split("_secret_")[0]! : sessionId;
    const intent = await getStripeClient().retrievePaymentIntent(piId);
    if (intent.status !== "succeeded") return null;
  } catch (err: unknown) {
    log.warn("[stripe.findOrderBySessionPossession] intent check failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  return candidate as { _id: Types.ObjectId; status: string };
}

export async function retryStuckStripeFulfillment(
  orderId: string,
  _userId: string
): Promise<"fulfilled" | "already-finalized" | "in-progress" | "skipped"> {
  return retryStuckFulfillment({
    orderId,
    providerId: "stripe",
    resolveCaptureId: (order) => {
      const metadata = (order.metadata ?? {}) as Record<string, unknown>;
      return (metadata.stripePaymentIntentId as string | undefined) ?? undefined;
    },
  });
}

/**
 * Auto-refund an order that was marked failed but whose PaymentIntent later
 * succeeded. Claim-guarded by `metadata.refundProcessedAt` so concurrent
 * events / replays only ever run the rollback once. Never throws: a failure
 * here must not turn the webhook into a 500 (Stripe would retry forever).
 */
async function claimFailedOrderAutoRefund(
  order: NonNullable<Awaited<ReturnType<typeof Order.findOne>>>
): Promise<void> {
  const now = new Date().toISOString();
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, "metadata.refundProcessedAt": { $exists: false } },
    {
      $set: {
        "metadata.refundProcessedAt": now,
        "metadata.refundedVia": "stripe_failed_order_refund",
      },
    },
    { returnDocument: "after" }
  );
  if (!claimed) return;

  try {
    const refundDeps = buildRefundDeps();
    const refundResult = await rollbackOrderRefund(
      order._id.toString(),
      order.userId.toString(),
      null,
      "Stripe failed-order auto-refund",
      refundDeps
    );
    if (!refundResult.success) {
      throw new Error(refundResult.error ?? "Stripe failed-order auto-refund failed");
    }
    await Order.findByIdAndUpdate(order._id, {
      $set: { status: "refunded" },
      $push: {
        "metadata.refunds": {
          refundId: "",
          source: "stripe_failed_order_refund",
          at: now,
        },
      },
    });
    log.info("[stripe.webhook] failed order auto-refunded after late success", {
      orderId: order._id.toString(),
    });
  } catch (err: unknown) {
    log.error("[stripe.webhook] failed-order auto-refund error", {
      orderId: order._id.toString(),
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

const log = createLogger("stripe");
