import { randomUUID } from "node:crypto";
import { Competition, Order, PaymentAttempt } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import type { GatewayRequest, PaytriotResponse } from "@oc/api-payment-paytriot";
import {
  Gateway,
  getPaytriotErrorInfo,
  httpParseQuery,
  PAYTRIOT_NUMERIC_CURRENCIES,
  sanitizeUserMessage,
  sign,
  verifyResponse,
} from "@oc/api-payment-paytriot";
import { incrementCounter } from "@oc/api-server/lib/observability/metrics";
import {
  computeCheckoutTotal,
  computeGatewayChargeAmount,
  createPendingCheckoutOrder,
} from "@oc/api-tickets/create-session";
import { releasePromoCodeUsage } from "@oc/api-tickets/promo-codes";
import { getEnv } from "@oc/env/server";
import { Types } from "mongoose";
import { reserveCheckoutPromoCode } from "../build-fulfillment-deps";
import { finalizeSuccessfulOrder } from "../finalize-successful-order";
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

function getPaytriotCurrencyNumeric(): number {
  const currency = getProviderCurrency(paytriotAdapter.id);
  return PAYTRIOT_NUMERIC_CURRENCIES[currency] ?? 826;
}

/**
 * Within this window, concurrent/recent session-creates on the SAME order
 * reuse the stored Paytriot payload (same transactionUnique) instead of
 * generating a fresh one. The webhook dedups by SHA-256(body), so identical
 * transactionUnique values protect against a double charge when a user opens
 * two checkout tabs at once.
 */
const PAYTRIOT_SESSION_REUSE_MS = 15 * 60 * 1000;

interface BuildGatewayRequestParams {
  merchantID: string;
  frontendUrl: string;
  transactionUnique: string;
  amountPence: number;
  remoteAddress: string | undefined;
  userEmail: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  userPhone: string | undefined;
  shippingAddress: { addressLine1?: string; postcode?: string; city?: string } | undefined;
  orderRef: string | number;
  statementNarrative1: string;
  statementNarrative2: string;
  checkoutMode?: "hosted" | "popup";
}

function buildGatewayRequest(p: BuildGatewayRequestParams): GatewayRequest {
  const popupSuffix = p.checkoutMode === "popup" ? "?popup=1" : "";
  const customerName = p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : undefined;

  return {
    merchantID: p.merchantID,
    action: "SALE",
    type: 1,
    transactionUnique: p.transactionUnique,
    countryCode: 826,
    currencyCode: getPaytriotCurrencyNumeric(),
    amount: p.amountPence,
    redirectURL: `${p.frontendUrl}/api/payments/paytriot/return${popupSuffix}`,
    threeDSRedirectURL: `${p.frontendUrl}/api/payments/paytriot/return${popupSuffix}`,
    remoteAddress: p.remoteAddress ?? "127.0.0.1",
    customerEmail: p.userEmail,
    customerName,
    customerAddress: p.shippingAddress?.addressLine1,
    customerPostCode: p.shippingAddress?.postcode,
    customerTown: p.shippingAddress?.city,
    customerCountryCode: "826",
    customerPhone: p.userPhone,
    orderRef: String(p.orderRef),
    duplicateDelay: 600,
    captureDelay: 0,
    cardCVVMandatory: "N",
    customerAddressMandatory: p.shippingAddress?.addressLine1 ? "Y" : "N",
    customerPostcodeMandatory: p.shippingAddress?.postcode ? "Y" : "N",
    customerEmailMandatory: p.userEmail ? "Y" : "N",
    customerPhoneMandatory: p.userPhone ? "Y" : "N",
    avscv2CheckRequired: "Y",
    cv2CheckPref: "not known,not checked,not matched,partially matched,matched",
    addressCheckPref: "not known,not checked,not matched,partially matched,matched",
    postcodeCheckPref: "not known,not checked,not matched,partially matched,matched",
    threeDSRequired: "Y",
    threeDSCheckPref:
      "not known,not checked,not authenticated,attempted authentication,authenticated",
    customerReceiptsRequired: "N",
    notifyEmailRequired: "N",
    merchantCategoryCode: "8999",
    statementNarrative1: p.statementNarrative1,
    statementNarrative2: p.statementNarrative2,
  };
}

export const paytriotAdapter: PaymentProviderAdapter = {
  id: "paytriot" as PaymentProviderId,

  /**
   * @param subtotal - Amount in pounds decimal (e.g., £12.00 → 12). Converted to pence internally via * 100.
   */
  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    log.info("[paytriot.createSession] ENTER", {
      userId: params.userId,
      subtotal: params.subtotal,
      discount: params.discount,
      itemCount: params.items.length,
      itemIds: params.items.map((i) => i.competitionId),
      cartId: params.cartId ?? "<none>",
      idempotencyKey: params.idempotencyKey ? `${params.idempotencyKey.slice(0, 12)}...` : "<none>",
      promoCode: params.promoCode ?? "<none>",
      referralCode: params.referralCode ?? "<none>",
      isGuest: !!params.isGuestCheckout,
      frontendUrl: params.frontendUrl,
      remoteAddress: params.remoteAddress,
      email: params.userEmail ?? "<none>",
      phone: params.userPhone ?? "<none>",
      shipping: params.shippingAddress
        ? {
            line1: params.shippingAddress.addressLine1,
            city: params.shippingAddress.city,
            postcode: params.shippingAddress.postcode,
          }
        : "<none>",
    });

    const merchantID = getEnv("PAYTRIOT_MERCHANT_ID") ?? "";
    const merchantSecret = getEnv("PAYTRIOT_MERCHANT_SECRET") ?? "";
    log.info("[paytriot.createSession] merchant", {
      merchantID,
      merchantSecretPresent: merchantSecret.length > 0,
      merchantSecretLength: merchantSecret.length,
    });

    const siteCreditApplied = params.siteCreditApplied ?? 0;
    const totalAmount = computeGatewayChargeAmount(
      params.subtotal,
      params.discount,
      siteCreditApplied
    );
    log.info("[paytriot.createSession] totalAmount", {
      subtotal: params.subtotal,
      discount: params.discount,
      siteCreditApplied,
      totalAmount,
    });

    const hexIds = params.items
      .map((i) => i.competitionId)
      .filter((id) => /^[a-f\d]{24}$/i.test(id));
    if (hexIds.length > 0) {
      const competitions = await Competition.find({ _id: { $in: hexIds } })
        .select("_id status ticketsSold ticketsHeld maxTickets title")
        .lean();
      log.info("[paytriot.createSession] competition validation", {
        hexIdsCount: hexIds.length,
        competitionsFound: competitions.length,
        competitionData: competitions.map((c) => ({
          id: c._id.toString(),
          title: c.title,
          status: c.status,
          ticketsSold: c.ticketsSold,
          maxTickets: c.maxTickets,
          available: c.maxTickets - (c.ticketsSold ?? 0) - (c.ticketsHeld ?? 0),
        })),
      });
      const compMap = new Map(competitions.map((c) => [c._id.toString(), c]));
      for (const item of params.items) {
        const id = item.competitionId;
        if (!/^[a-f\d]{24}$/i.test(id)) continue;
        const comp = compMap.get(id);
        if (!comp) {
          throw new Error(`Competition not found: ${id}`);
        }
        if (comp.status !== "active") {
          throw new Error(
            `"${comp.title}" is no longer available (${comp.status}). Please remove it from your cart.`
          );
        }
        const available = comp.maxTickets - (comp.ticketsSold ?? 0) - (comp.ticketsHeld ?? 0);
        if (item.quantity > available) {
          throw new Error(
            `Not enough tickets available for "${comp.title}". Requested ${item.quantity}, only ${Math.max(0, available)} left.`
          );
        }
      }
    }

    // Reuses a recently-claimed session (same transactionUnique → webhook
    // body-hash dedup protects against double charge) or atomically claims the
    // order for generating a fresh one. Returns:
    //   { reused: true, result }        fresh claim + matching financials + payload
    //   { reused: false, transactionUnique }  claim won — generate with this
    //   { reused: false, lost: true }   another request claimed first
    type SessionClaimResult =
      | { reused: true; result: CreateSessionResult }
      | { reused: false; transactionUnique: string; lost?: false }
      | { reused: false; lost: true };

    const claimOrReuseSession = async (order: {
      _id: Types.ObjectId;
      providerSessionId?: string;
      subtotal?: number;
      total?: number;
      metadata?: Record<string, unknown>;
    }): Promise<SessionClaimResult> => {
      const baseId = order._id.toString();
      const now = new Date();
      const cutoff = new Date(now.getTime() - PAYTRIOT_SESSION_REUSE_MS);
      const meta = (order.metadata ?? {}) as Record<string, unknown>;
      const isPopup = params.checkoutMode === "popup";

      const totalsMatch = order.subtotal === params.subtotal && order.total === totalAmount;
      const claimAt = meta.paytriotSessionClaimAt
        ? new Date(meta.paytriotSessionClaimAt as string).getTime()
        : 0;

      if (claimAt > cutoff.getTime() && totalsMatch) {
        const sessionId = order.providerSessionId ?? (meta.paytriotSessionClaim as string);
        if (isPopup && meta.paytriotFields && meta.paytriotGatewayUrl) {
          return {
            reused: true,
            result: {
              sessionId,
              orderId: baseId,
              fields: meta.paytriotFields as Record<string, string>,
              gatewayUrl: meta.paytriotGatewayUrl as string,
            },
          };
        }
        if (!isPopup && meta.paytriotFormHtml) {
          return {
            reused: true,
            result: {
              sessionId,
              orderId: baseId,
              formHtml: meta.paytriotFormHtml as string,
            },
          };
        }
      }

      const transactionUnique = `${baseId}-${randomUUID().slice(0, 8)}`;
      const claimed = await Order.findOneAndUpdate(
        {
          _id: order._id,
          $or: [
            { "metadata.paytriotSessionClaim": { $exists: false } },
            { "metadata.paytriotSessionClaimAt": { $lt: cutoff } },
          ],
        },
        {
          $set: {
            "metadata.paytriotSessionClaim": transactionUnique,
            "metadata.paytriotSessionClaimAt": now,
          },
        },
        { returnDocument: "after" }
      ).lean();

      if (!claimed) return { reused: false, lost: true };
      return { reused: false, transactionUnique };
    };

    // After losing the claim race, re-read the order and reuse the winner's
    // payload so both tabs share the same transactionUnique. Returns null only
    // if the winner hasn't written its payload yet (micro-race fallback).
    const reuseWonPayload = async (
      orderId: Types.ObjectId,
      baseId: string,
      isPopup: boolean
    ): Promise<CreateSessionResult | null> => {
      const fresh = await Order.findById(orderId).lean();
      const freshMeta = (fresh?.metadata ?? {}) as Record<string, unknown>;
      const storedTotal = Number(freshMeta.paytriotTotal ?? fresh?.total ?? NaN);
      if (!Number.isNaN(storedTotal) && Math.abs(storedTotal - totalAmount) >= 0.01) {
        return null;
      }
      const sessionId = fresh?.providerSessionId ?? (freshMeta.paytriotSessionClaim as string);
      if (isPopup && freshMeta.paytriotFields && freshMeta.paytriotGatewayUrl) {
        return {
          sessionId,
          orderId: baseId,
          fields: freshMeta.paytriotFields as Record<string, string>,
          gatewayUrl: freshMeta.paytriotGatewayUrl as string,
        };
      }
      if (!isPopup && freshMeta.paytriotFormHtml) {
        return {
          sessionId,
          orderId: baseId,
          formHtml: freshMeta.paytriotFormHtml as string,
        };
      }
      return null;
    };

    // Regenerates the Paytriot payload for an existing order with the current
    // cart financials. Used for pending retries AND for orders whose stored
    // payload is missing (e.g. a promo reservation failure that failed before
    // the gateway ever produced fields) or was created under a different
    // checkoutMode. A fresh transactionUnique suffix sidesteps Paytriot's
    // duplicate detection (responseCode 65554); the webhook handler finds the
    // order by prefix fallback when providerSessionId doesn't match exactly.
    const regenerateOrderSession = async (existingOrder: {
      _id: Types.ObjectId;
      status?: string;
      orderNumber: number;
      providerSessionId?: string;
      subtotal?: number;
      total?: number;
      metadata?: Record<string, unknown>;
    }): Promise<CreateSessionResult> => {
      const reqAmount = Math.round(totalAmount * 100);
      const gw = new Gateway({ merchantID, merchantSecret });
      const baseId = existingOrder._id.toString();
      const isPopup = params.checkoutMode === "popup";

      const claim = await claimOrReuseSession(existingOrder);
      if (claim.reused) return claim.result;

      let newTransactionUnique: string;
      if (claim.lost) {
        const won = await reuseWonPayload(existingOrder._id, baseId, isPopup);
        if (won) return won;
        // Winner hasn't written its payload yet (micro-race) — generate anyway.
        newTransactionUnique = `${baseId}-${randomUUID().slice(0, 8)}`;
      } else {
        newTransactionUnique = claim.transactionUnique;
      }

      log.info("[paytriot.createSession] regenerating payment session for existing order", {
        orderId: baseId,
        status: existingOrder.status,
        newTransactionUnique,
        reqAmount,
        orderRef: existingOrder.orderNumber,
      });

      const gwRequest = buildGatewayRequest({
        merchantID,
        frontendUrl: params.frontendUrl,
        transactionUnique: newTransactionUnique,
        amountPence: reqAmount,
        remoteAddress: params.remoteAddress,
        userEmail: params.userEmail,
        firstName: params.firstName,
        lastName: params.lastName,
        userPhone: params.userPhone,
        shippingAddress: params.shippingAddress,
        orderRef: existingOrder.orderNumber,
        statementNarrative1: getEnv("PAYTRIOT_STATEMENT_NARRATIVE_1") ?? "",
        statementNarrative2: getEnv("PAYTRIOT_STATEMENT_NARRATIVE_2") ?? "",
        checkoutMode: params.checkoutMode,
      });

      const orderUpdate: Record<string, unknown> = {
        providerSessionId: newTransactionUnique,
        subtotal: params.subtotal,
        total: totalAmount,
        discountAmount: params.discount,
        // A previously failed order gets a fresh payment attempt — bring it
        // back to pending so session polling and the webhook work correctly.
        status: "pending",
        referralCode: params.referralCode,
        competitionIds: params.items.map((i) => i.competitionId),
        "metadata.items": JSON.stringify(params.items),
        "metadata.promoCode": params.promoCode,
        "metadata.discountType": params.discountType,
        "metadata.promoDiscountPercent": params.promoDiscountPercent,
        "metadata.paytriotTotal": totalAmount,
        "metadata.paytriotIdempotencyRegenerated": new Date().toISOString(),
        "metadata.paytriotSessionClaim": newTransactionUnique,
        "metadata.paytriotSessionClaimAt": new Date(),
      };

      if (params.checkoutMode === "popup") {
        const fields = gw.getSignedFields(gwRequest);
        const gwUrl = gw.popupUrl;
        log.info("[paytriot.createSession] regenerated signed fields for popup", {
          fieldCount: Object.keys(fields).length,
        });
        orderUpdate["metadata.paytriotFields"] = fields;
        orderUpdate["metadata.paytriotGatewayUrl"] = gwUrl;
        await Order.findByIdAndUpdate(existingOrder._id, { $set: orderUpdate });
        return {
          sessionId: newTransactionUnique,
          orderId: baseId,
          fields,
          gatewayUrl: gwUrl,
        };
      }

      const html = gw.hostedRequest(gwRequest);
      log.info("[paytriot.createSession] regenerated form HTML length", {
        htmlLength: html.length,
      });
      orderUpdate["metadata.paytriotFormHtml"] = html;
      await Order.findByIdAndUpdate(existingOrder._id, { $set: orderUpdate });
      return {
        sessionId: newTransactionUnique,
        orderId: baseId,
        formHtml: html,
      };
    };

    if (params.idempotencyKey) {
      const existingOrder = await Order.findOne({
        userId: new Types.ObjectId(params.userId),
        idempotencyKey: params.idempotencyKey,
        provider: "paytriot",
      }).lean();

      if (existingOrder?.providerSessionId) {
        log.info("[paytriot.createSession] existing order found", {
          orderId: existingOrder._id.toString(),
          status: existingOrder.status,
          providerSessionId: existingOrder.providerSessionId,
        });
        // Phase 6: hard-block retries on orders that were previously
        // captured (even if fulfillment failed). The customer was charged
        // on that order — allow a retry would cause a second charge.
        // Declined/errored attempts are still retryable.
        let lastAttempt: Record<string, unknown> | null = null;
        try {
          lastAttempt = (await PaymentAttempt.findOne({ orderId: existingOrder._id })
            .sort({ attemptNumber: -1 })
            .lean()) as Record<string, unknown> | null;
          if (lastAttempt?.status === "captured") {
            if (lastAttempt.fulfillmentFailed) {
              throw new Error(
                "ORDER_CAPTURED_BUT_FAILED: This order was charged but couldn't be fulfilled. " +
                  "Contact support — do not retry."
              );
            }
            throw new Error(
              "ORDER_ALREADY_COMPLETED: This order was already paid. Reload your order history."
            );
          }
        } catch (err) {
          if (
            err instanceof Error &&
            (err.message.startsWith("ORDER_CAPTURED_BUT_FAILED") ||
              err.message.startsWith("ORDER_ALREADY_COMPLETED"))
          ) {
            throw err;
          }
          // Non-fatal: payment attempt lookup failed — allow retry
        }

        const meta = (existingOrder.metadata ?? {}) as Record<string, unknown>;
        const isPopup = params.checkoutMode === "popup";

        // The stored payload is only reusable when it exists AND matches the
        // mode the client is rendering. Otherwise the client receives a
        // response without fields/formHtml and surfaces "Paytriot did not
        // return payment fields" — regenerate instead.
        const storedPayloadUsable = isPopup
          ? Boolean(meta.paytriotFields && meta.paytriotGatewayUrl)
          : Boolean(meta.paytriotFormHtml);
        const storedTotal = Number(meta.paytriotTotal ?? existingOrder.total ?? NaN);
        const totalsMatch =
          !Number.isNaN(storedTotal) && Math.abs(storedTotal - totalAmount) < 0.01;

        if (existingOrder.status === "pending" || !storedPayloadUsable || !totalsMatch) {
          // Re-run the promo reservation when retrying a non-pending order
          // that never reached the gateway (no payment attempt), so a
          // maxUsesPerUser=1 code can't be reused by routing through the
          // regeneration path. Pending orders already hold a reservation.
          if (existingOrder.status !== "pending" && params.promoCode) {
            const promoChanged = params.promoCode !== meta.promoCode;
            if (promoChanged || !lastAttempt) {
              // The stored order may still hold a reservation for a previous
              // promo (declined orders keep it until the cleanup job). Release
              // it when switching codes so usage isn't leaked.
              if (promoChanged && meta.promoCode) {
                await releasePromoCodeUsage(String(meta.promoCode), params.userId).catch(() => {});
              }
              const reserved = await reserveCheckoutPromoCode(params.promoCode, params.userId);
              if (!reserved) {
                await Order.findByIdAndUpdate(existingOrder._id, {
                  $set: { status: "failed" },
                });
                throw new Error(
                  "Promo code could not be reserved — it may have reached its maximum uses"
                );
              }
            }
          }

          return await regenerateOrderSession(existingOrder);
        }

        if (isPopup) {
          return {
            sessionId: existingOrder.providerSessionId,
            orderId: existingOrder._id.toString(),
            fields: meta.paytriotFields as Record<string, string>,
            gatewayUrl: meta.paytriotGatewayUrl as string,
          };
        }
        return {
          sessionId: existingOrder.providerSessionId,
          orderId: existingOrder._id.toString(),
          formHtml: meta.paytriotFormHtml as string,
        };
      }
    }

    log.info("[paytriot.createSession] no existing order — creating new one");
    const sessionId = `paytriot_${randomUUID()}`;
    log.info("[paytriot.createSession] generated sessionId", { sessionId });

    const orderRecord = await createPendingCheckoutOrder({
      userId: params.userId,
      items: params.items,
      subtotal: params.subtotal,
      discount: params.discount,
      promoCode: params.promoCode,
      promoCodeId: params.promoCodeId,
      discountType: params.discountType,
      promoDiscountPercent: params.promoDiscountPercent,
      referralCode: params.referralCode,
      providerSessionId: sessionId,
      provider: "paytriot",
      idempotencyKey: params.idempotencyKey,
      shippingAddress: params.shippingAddress,
      cartId: params.cartId,
      referralBonusTickets: params.referralBonusTickets,
      referralBalanceUsed: params.referralBalanceUsed,
      siteCreditApplied: siteCreditApplied > 0 ? siteCreditApplied : undefined,
      isGuestCheckout: params.isGuestCheckout,
      orderEmail: params.orderEmail,
    });

    if (params.promoCode) {
      const promoReserved = await reserveCheckoutPromoCode(params.promoCode, params.userId);
      if (!promoReserved) {
        // Delete the just-created order instead of leaving a failed order with
        // no Paytriot payload behind. Reusing it via the idempotency branch
        // would return an empty payload and surface a misleading "did not
        // return payment fields" error on every later retry.
        await Order.deleteOne({ _id: orderRecord._id }).catch(() => {});
        log.info("[paytriot.createSession] deleted order after promo reservation failure", {
          orderId: orderRecord._id.toString(),
          promoCode: params.promoCode,
        });
        throw new Error("Promo code could not be reserved — it may have reached its maximum uses");
      }
    }

    try {
      log.info("[paytriot.createSession] order created", {
        orderId: orderRecord._id.toString(),
        orderNumber: orderRecord.orderNumber,
        sessionId,
        totalAmount,
      });

      const gateway = new Gateway({ merchantID, merchantSecret });
      const baseId = orderRecord._id.toString();
      const isPopup = params.checkoutMode === "popup";

      // Reuse a recently-claimed session (same transactionUnique) or atomically
      // claim this order so two concurrent creates can't double-charge.
      const claim = await claimOrReuseSession(orderRecord);
      if (claim.reused) return claim.result;
      let transactionUnique: string;
      if (claim.lost) {
        const won = await reuseWonPayload(orderRecord._id, baseId, isPopup);
        if (won) return won;
        // Winner hasn't written its payload yet (micro-race) — generate anyway.
        transactionUnique = `${baseId}-${randomUUID().slice(0, 8)}`;
      } else {
        transactionUnique = claim.transactionUnique;
      }

      const requestAmount = Math.round(totalAmount * 100);

      log.info("[paytriot.createSession] building gateway request", {
        transactionUnique,
        requestAmount,
        statementNarrative1: getEnv("PAYTRIOT_STATEMENT_NARRATIVE_1") ?? "",
      });

      const request = buildGatewayRequest({
        merchantID,
        frontendUrl: params.frontendUrl,
        transactionUnique,
        amountPence: requestAmount,
        remoteAddress: params.remoteAddress,
        userEmail: params.userEmail,
        firstName: params.firstName,
        lastName: params.lastName,
        userPhone: params.userPhone,
        shippingAddress: params.shippingAddress,
        orderRef: orderRecord.orderNumber,
        statementNarrative1: getEnv("PAYTRIOT_STATEMENT_NARRATIVE_1") ?? "",
        statementNarrative2: getEnv("PAYTRIOT_STATEMENT_NARRATIVE_2") ?? "",
        checkoutMode: params.checkoutMode,
      });

      if (isPopup) {
        const fields = gateway.getSignedFields(request);
        const gwUrl = gateway.popupUrl;
        log.info("[paytriot.createSession] signed fields generated for popup", {
          fieldCount: Object.keys(fields).length,
        });

        await Order.findByIdAndUpdate(orderRecord._id, {
          $set: {
            "metadata.paytriotFields": fields,
            "metadata.paytriotGatewayUrl": gwUrl,
            "metadata.paytriotTotal": totalAmount,
            "metadata.paytriotSessionClaim": transactionUnique,
            "metadata.paytriotSessionClaimAt": new Date(),
          },
        });

        const result: CreateSessionResult = {
          sessionId,
          orderId: orderRecord._id.toString(),
          fields,
          gatewayUrl: gwUrl,
        };
        log.info("[paytriot.createSession] RETURN (popup)", result);
        return result;
      }

      const formHtml = gateway.hostedRequest(request);
      log.info("[paytriot.createSession] form HTML generated", {
        htmlLength: formHtml.length,
        formActionMatch: formHtml.match(/action="([^"]+)"/)?.[1],
        amountInForm: formHtml.match(/name="amount"\s+value="(\d+)"/)?.[1],
        sigInForm: formHtml.includes("signature") ? "present" : "missing",
      });

      await Order.findByIdAndUpdate(orderRecord._id, {
        $set: {
          "metadata.paytriotFormHtml": formHtml,
          "metadata.paytriotTotal": totalAmount,
          "metadata.paytriotSessionClaim": transactionUnique,
          "metadata.paytriotSessionClaimAt": new Date(),
        },
      });

      const result: CreateSessionResult = {
        sessionId,
        orderId: orderRecord._id.toString(),
        formHtml,
      };
      log.info("[paytriot.createSession] RETURN", result);
      return result;
    } catch (err) {
      if (params.promoCode) {
        await releasePromoCodeUsage(params.promoCode, params.userId).catch(() => {});
      }
      throw err;
    }
  },

  async getSessionStatus(sessionId: string, userId?: string): Promise<PaymentSessionStatus> {
    // Phase 4: also look up by transactionUnique (covers retries where
    // the URL carries <orderId>-<8hex> as sessionId).
    const orFilters: Record<string, unknown>[] = [
      { providerSessionId: sessionId },
      { transactionUnique: sessionId },
    ];
    if (/^[a-f\d]{24}$/i.test(sessionId)) {
      orFilters.push({ _id: new Types.ObjectId(sessionId) });
    }
    const query: Record<string, unknown> = { provider: "paytriot", $or: orFilters };
    if (userId) query.userId = new Types.ObjectId(userId);
    const order = await Order.findOne(query).lean();
    if (!order) {
      return { status: "failed", orderId: undefined };
    }

    const orderId = order._id.toString();
    const meta = (order.metadata ?? {}) as Record<string, unknown>;

    // Prefer PaymentAttempt data over order metadata.
    let latestAttempt: Record<string, unknown> | null = null;
    try {
      const att = await PaymentAttempt.findOne({ orderId }).sort({ attemptNumber: -1 }).lean();
      latestAttempt = att as Record<string, unknown> | null;
    } catch {} // non-fatal; fall back to order metadata

    const errorCategory =
      (latestAttempt?.category as string | undefined) ??
      (meta.paytriotErrorCategory as string | undefined);
    const errorTitle =
      (latestAttempt?.errorTitle as string | undefined) ??
      (meta.paytriotErrorTitle as string | undefined);
    const errorMessage =
      (latestAttempt?.errorUserMessage as string | undefined) ??
      (meta.paytriotErrorUserMessage as string | undefined);
    const recommendedAction =
      (latestAttempt?.errorRecommendedAction as string | undefined) ??
      (meta.paytriotErrorRecommendedAction as string | undefined);
    const wasCharged =
      (latestAttempt?.wasCharged as boolean | undefined) ??
      (meta.paytriotErrorWasCharged as boolean | undefined);
    const fulfillmentFailed =
      (latestAttempt?.fulfillmentFailed as boolean | undefined) ??
      (meta.fulfillmentFailed as boolean | undefined) ??
      (meta.fulfillmentFailedAfterCapture as boolean | undefined);

    const baseStatus: PaymentSessionStatus = {
      status: (order.status ?? "failed") as PaymentSessionStatus["status"],
      orderId,
      errorCode: errorCategory,
      errorMessage,
    };

    if (errorCategory) {
      baseStatus.errorCode = errorCategory;
      baseStatus.errorTitle = errorTitle;
      baseStatus.errorMessage = errorMessage;
      baseStatus.recommendedAction = recommendedAction as PaymentSessionStatus["recommendedAction"];
      baseStatus.wasCharged = wasCharged ?? false;
      baseStatus.fulfillmentFailed = fulfillmentFailed;
    }

    if (order.status === "completed") {
      return { ...baseStatus, status: "completed" };
    }
    if (order.status === "pending") {
      return { ...baseStatus, status: "pending" };
    }
    if (order.status === "processing") {
      return { ...baseStatus, status: "processing" };
    }

    return baseStatus;
  },

  async captureSession(sessionId: string, userId?: string): Promise<PaymentSessionStatus> {
    return paytriotAdapter.getSessionStatus(sessionId, userId);
  },

  async handleWebhook(body: string, sig: string | null | undefined): Promise<WebhookResult> {
    log.info("[paytriot.handleWebhook] ENTER", {
      bodyLength: body.length,
      sigPresent: !!sig,
    });
    const parsed = httpParseQuery(body) as unknown as PaytriotResponse;
    log.info("[paytriot.handleWebhook] parsed body", {
      responseCode: parsed.responseCode,
      responseMessage: parsed.responseMessage,
      transactionUnique: parsed.transactionUnique,
      transactionID: parsed.transactionID,
      xref: parsed.xref,
      state: parsed.state,
      amountReceived: parsed.amountReceived,
      cardType: parsed.cardType,
      cardScheme: parsed.cardScheme,
    });
    const merchantSecret = getEnv("PAYTRIOT_MERCHANT_SECRET") ?? "";

    let signatureVerified = false;
    try {
      verifyResponse(parsed as unknown as Record<string, unknown>, merchantSecret);
      signatureVerified = true;
    } catch (sigErr) {
      const rawUnique = parsed.transactionUnique ?? "";
      const orderId = rawUnique.split("-")[0];
      if (orderId) {
        try {
          await Order.findByIdAndUpdate(orderId, {
            $set: {
              "metadata.paytriotSigError":
                sigErr instanceof Error ? sigErr.message : "Signature verification failed",
              "metadata.paytriotSigAcceptedWithWarning": true,
            },
          });
        } catch {} // non-fatal diagnostic write
      }
      // Hosted form response signatures are unreliable for all response codes
      // due to auto-added fields. Continue processing — the correct success or
      // failure path is determined by responseCode/state below, not by the
      // signature. The warning is stored on the order for manual review.
    }

    const responseCode = Number(parsed.responseCode);
    const sessionId = parsed.transactionUnique ?? "";
    const transactionId = parsed.transactionID ?? parsed.xref ?? "";

    const rawUnique = parsed.transactionUnique ?? "";
    let orderId = "";
    if (rawUnique) {
      const byProviderSessionId = await Order.findOne({ providerSessionId: rawUnique })
        .select("_id")
        .lean();
      if (byProviderSessionId) {
        orderId = byProviderSessionId._id.toString();
      } else {
        const hexPrefix = rawUnique.split("-")[0] ?? "";
        if (/^[a-f\d]{24}$/i.test(hexPrefix)) {
          orderId = hexPrefix;
        }
      }
    }
    if (!orderId) {
      await storePendingWebhook({
        body,
        provider: "paytriot",
        orderId: null,
        eventId: transactionId,
        signature: sig,
      });
      return { eventType: "PAYTRIOT.ORDER_NOT_FOUND", sessionId, status: "failed" };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      await storePendingWebhook({
        body,
        provider: "paytriot",
        orderId: null,
        eventId: transactionId,
        signature: sig,
      });
      return { eventType: "PAYTRIOT.ORDER_NOT_FOUND", sessionId, status: "failed" };
    }
    log.info("[paytriot.handleWebhook] order found", {
      orderId: order._id.toString(),
      orderStatus: order.status,
      providerSessionId: order.providerSessionId,
      metadataKeys: Object.keys((order.metadata ?? {}) as Record<string, unknown>),
    });

    const userId =
      order.userId instanceof Types.ObjectId ? order.userId.toString() : String(order.userId);

    const commonMeta: Record<string, unknown> = {
      paytriotResponseCode: responseCode,
      paytriotResponseMessage: parsed.responseMessage,
      paytriotTransactionId: transactionId,
      paytriotXref: parsed.xref,
      paytriotState: parsed.state,
      paytriotAuthCode: parsed.authorisationCode,
      paytriotAmountReceived: parsed.amountReceived,
      paytriotOrderRef: parsed.orderRef,
      paytriotTimestamp: parsed.timestamp,
      paytriotRawBody: body.length > 2000 ? `${body.slice(0, 1997)}...` : body,
      paytriotReferralPhone: parsed.referralPhone,
    };

    if (parsed.vcsResponseCode) {
      commonMeta.paytriotVCS = {
        code: parsed.vcsResponseCode,
        message: parsed.vcsResponseMessage,
      };
    }

    if (parsed.threeDSDetails) {
      commonMeta.paytriotThreeDSDetails = parsed.threeDSDetails;
    }

    if (parsed.avscv2AuthEntity) {
      commonMeta.paytriotAvsAuthEntity = parsed.avscv2AuthEntity;
    }

    const computedErrorInfo = getPaytriotErrorInfo({
      responseCode,
      responseMessage: parsed.responseMessage,
      cv2Check: parsed.cv2Check,
      addressCheck: parsed.addressCheck,
      postcodeCheck: parsed.postcodeCheck,
      avsResponseMessage: parsed.avscv2ResponseMessage,
      threeDSEnrolled: parsed.threeDSEnrolled,
      threeDSAuthenticated: parsed.threeDSAuthenticated,
      threeDSErrorCode: parsed.threeDSErrorCode,
      threeDSErrorDescription: parsed.threeDSErrorDescription,
      state: parsed.state,
      referralPhone: parsed.referralPhone,
      vcsResponseCode: parsed.vcsResponseCode,
      vcsResponseMessage: parsed.vcsResponseMessage,
    });

    // Phase 2: store error category on commonMeta for order diagnostic surface.
    // The decision-critical fields (category, title, wasCharged) are now
    // persisted via PaymentAttempt — the order metadata only carries them
    // for backward-compat with admin tooling and legacy polling until all
    // consumers are migrated. The URL builder reads from PaymentAttempt.
    commonMeta.paytriotErrorCategory = computedErrorInfo.category;
    commonMeta.paytriotErrorTitle = computedErrorInfo.title;
    commonMeta.paytriotErrorUserMessage = sanitizeUserMessage(computedErrorInfo.description);
    commonMeta.paytriotErrorRecommendedAction = computedErrorInfo.recommendedAction;
    commonMeta.paytriotErrorWasCharged = computedErrorInfo.wasCharged;

    if (parsed.cardType || parsed.cardTypeCode) {
      commonMeta.paytriotCard = {
        type: parsed.cardType,
        typeCode: parsed.cardTypeCode,
        scheme: parsed.cardScheme,
        schemeCode: parsed.cardSchemeCode,
        masked: parsed.cardNumberMask,
        issuer: parsed.cardIssuer,
        issuerCountry: parsed.cardIssuerCountry,
        issuerCountryCode: parsed.cardIssuerCountryCode,
      };
    }

    if (parsed.avscv2Enabled || parsed.avscv2ResponseCode) {
      commonMeta.paytriotAvs = {
        enabled: parsed.avscv2Enabled,
        code: parsed.avscv2ResponseCode,
        message: parsed.avscv2ResponseMessage,
        cv2Check: parsed.cv2Check,
        addressCheck: parsed.addressCheck,
        postcodeCheck: parsed.postcodeCheck,
      };
    }

    if (parsed.threeDSEnabled || parsed.threeDSEnrolled) {
      commonMeta.paytriotThreeDS = {
        enabled: parsed.threeDSEnabled,
        enrolled: parsed.threeDSEnrolled,
        authenticated: parsed.threeDSAuthenticated,
        xid: parsed.threeDSXID,
        cavv: parsed.threeDSCAVV,
        eci: parsed.threeDSECI,
        cavvAlgorithm: parsed.threeDSCAVVAlgorithm,
        responseCode: (parsed as unknown as Record<string, unknown>).threeDSResponseCode,
        responseMessage: (parsed as unknown as Record<string, unknown>).threeDSResponseMessage,
        version: (parsed as unknown as Record<string, unknown>).threeDSVersion,
        policy: (parsed as unknown as Record<string, unknown>).threeDSPolicy,
      };
    }

    // ── Phase 2: Create PaymentAttempt record ──────────────────────────
    const attemptNumber =
      ((await PaymentAttempt.countDocuments({ orderId: order._id })) as number) + 1;
    const attemptDoc = new PaymentAttempt({
      orderId: order._id,
      userId: order.userId,
      provider: "paytriot",
      providerSessionId: order.providerSessionId,
      providerTransactionId: transactionId,
      transactionUnique: rawUnique,
      attemptNumber,
      status: responseCode === 0 ? "captured" : "declined",
      responseCode,
      responseMessage: parsed.responseMessage,
      category: computedErrorInfo.category,
      wasCharged: computedErrorInfo.wasCharged,
      errorTitle: computedErrorInfo.title,
      errorUserMessage: sanitizeUserMessage(computedErrorInfo.description),
      errorRecommendedAction: computedErrorInfo.recommendedAction,
      rawBody: body.length > 2000 ? `${body.slice(0, 1997)}...` : body,
      receivedAt: new Date(),
    });
    await attemptDoc.save();
    try {
      await Order.findByIdAndUpdate(order._id, {
        $set: { "metadata.paytriotLastAttemptId": attemptDoc._id },
      });
    } catch {} // non-fatal pointer update

    if (responseCode === 0) {
      const lenientSig = getEnv("PAYTRIOT_LENIENT_RESPONSE_SIGNATURE") === "true";
      if (!signatureVerified && !lenientSig) {
        log.warn("[paytriot.handleWebhook] rejected success: invalid signature", {
          orderId: order._id.toString(),
          transactionUnique: rawUnique,
        });
        await Order.findByIdAndUpdate(order._id, {
          $set: {
            "metadata.paytriotRejectedReason": "invalid_signature",
            "metadata.paytriotSigAcceptedWithWarning": false,
          },
        });
        return {
          eventType: "PAYTRIOT.SIGNATURE_INVALID",
          sessionId,
          status: "failed",
        };
      }

      const expectedPence = Math.round(order.total * 100);
      if (
        parsed.amountReceived == null ||
        Number(parsed.amountReceived) !== expectedPence
      ) {
        log.warn("[paytriot.handleWebhook] rejected success: amount mismatch", {
          orderId: order._id.toString(),
          expectedPence,
          amountReceived: parsed.amountReceived,
        });
        await Order.findByIdAndUpdate(order._id, {
          $set: {
            "metadata.paytriotRejectedReason": "amount_mismatch",
            "metadata.paytriotExpectedPence": expectedPence,
            "metadata.paytriotAmountReceived": parsed.amountReceived,
          },
        });
        return {
          eventType: "PAYTRIOT.AMOUNT_MISMATCH",
          sessionId,
          status: "failed",
        };
      }

      // Payment was captured — reset order to pending if needed so fulfillment
      // always proceeds. This handles retries on orders left in "failed" state
      // by a previous attempt. Terminal states (completed/refunded) are skipped.
      if (order.status !== "pending" && order.status !== "processing") {
        if (order.status === "completed" || order.status === "refunded") {
          log.warn("[paytriot.handleWebhook] terminal order, skipping fulfillment", {
            orderId: order._id.toString(),
            status: order.status,
          });
        } else {
          await Order.findByIdAndUpdate(order._id, {
            $set: { status: "pending" },
            $unset: {
              "metadata.fulfillmentFailedAfterCapture": "",
              "metadata.fulfillmentLock": "",
              "metadata.fulfillmentError": "",
              "metadata.paytriotSigError": "",
              "metadata.paytriotSigAcceptedWithWarning": "",
            },
          });
          log.info("[paytriot.handleWebhook] order reset to pending for retry", {
            orderId: order._id.toString(),
            previousStatus: order.status,
          });
        }
      }

      log.info("[paytriot.handleWebhook] SUCCESS path - calling finalize", {
        orderId: order._id.toString(),
        captureId: transactionId,
      });
      const finalizeResult = await finalizeSuccessfulOrder({
        orderId: order._id.toString(),
        userId,
        captureId: transactionId,
        source: "webhook",
        logPrefix: "Paytriot",
      });
      log.info("[paytriot.handleWebhook] finalize result", {
        orderId: order._id.toString(),
        result: finalizeResult,
      });

      const stateOk =
        parsed.state && ["approved", "captured", "tendered", "accepted"].includes(parsed.state);
      if (parsed.state && !stateOk) {
        log.warn("[paytriot.webhook] unexpected state for responseCode=0", {
          orderId: order._id.toString(),
          state: parsed.state,
          responseCode,
        });
      }

      // Re-read order to detect post-capture fulfillment failure.
      const orderAfterFinalize = await Order.findById(order._id);
      const fulfillmentFailed =
        orderAfterFinalize?.status === "failed" ||
        (
          orderAfterFinalize as unknown as {
            metadata?: { fulfillmentFailedAfterCapture?: boolean };
          } | null
        )?.metadata?.fulfillmentFailedAfterCapture === true;

      log.info("[paytriot.handleWebhook] post-finalize order state", {
        orderId: order._id.toString(),
        orderStatus: orderAfterFinalize?.status,
        fulfillmentFailed,
      });

      await attemptDoc.updateOne({
        $set: {
          finalizedAt: new Date(),
          fulfillmentFailed,
          fulfillmentErrorMessage: fulfillmentFailed
            ? ((
                orderAfterFinalize as unknown as {
                  metadata?: { fulfillmentError?: { message?: string } };
                }
              )?.metadata?.fulfillmentError?.message ?? null)
            : null,
        },
      });

      // Set order-level fulfillmentFailed flag ONCE — never overwritten by
      // future attempts. This is the persistent truth about the order.
      if (fulfillmentFailed) {
        await Order.findOneAndUpdate(
          { _id: order._id, "metadata.fulfillmentFailed": { $exists: false } },
          { $set: { "metadata.fulfillmentFailed": true } }
        );
      }

      // Still persist gateway diagnostics on the order for admin tooling.
      const ovrMeta: Record<string, unknown> = {
        "metadata.paytriotReceivedAt": new Date().toISOString(),
      };
      for (const [k, v] of Object.entries(commonMeta)) {
        // Never overwrite error context set by finalizeSuccessfulOrder
        // when the order was captured but fulfillment failed.
        if (fulfillmentFailed && k.startsWith("paytriotError")) continue;
        ovrMeta[`metadata.${k}`] = v;
      }
      try {
        await Order.findByIdAndUpdate(order._id, { $set: ovrMeta });
      } catch (err) {
        log.error("[paytriot.handleWebhook] post-finalize metadata write failed", {
          orderId: order._id.toString(),
          err: err instanceof Error ? err.message : String(err),
        });
      }

      incrementCounter("payment.session.completed");
      log.info("[paytriot.webhook] completed", {
        orderId: order._id.toString(),
        responseCode,
        cardType: parsed.cardType,
        state: parsed.state,
        category: fulfillmentFailed ? "FULFILLMENT_FAILED" : computedErrorInfo.category,
      });

      const result: WebhookResult = {
        eventType: fulfillmentFailed
          ? "PAYTRIOT.PAYMENT.CAPTURED_BUT_NOT_FULFILLED"
          : "PAYTRIOT.PAYMENT.SUCCESS",
        sessionId: order.providerSessionId ?? sessionId,
        status: finalizeResult === "in-progress" ? "processing" : "completed",
        orderId: order._id.toString(),
      };
      log.info("[paytriot.handleWebhook] returning", result);
      return result;
    }

    // ── Failure path ───────────────────────────────────────
    // Write diagnostic metadata on the order for admin tooling.
    {
      const failureMetaSet: Record<string, unknown> = {
        "metadata.paytriotReceivedAt": new Date().toISOString(),
      };
      for (const [k, v] of Object.entries(commonMeta)) {
        failureMetaSet[`metadata.${k}`] = v;
      }
      try {
        await Order.findByIdAndUpdate(order._id, { $set: failureMetaSet });
      } catch {} // non-fatal diagnostic write
    }
    await markOrderFailed(order);

    incrementCounter("payment.session.failed");
    log.error("[paytriot.webhook] declined", {
      orderId: order._id.toString(),
      responseCode,
      category: computedErrorInfo.category,
      cardType: parsed.cardType,
      cardScheme: parsed.cardScheme,
      state: parsed.state,
      responseMessage: parsed.responseMessage,
    });
    if (computedErrorInfo.isConfigError) {
      log.error("[paytriot.webhook] config error detected", {
        orderId: order._id.toString(),
        responseCode,
        category: computedErrorInfo.category,
      });
    }

    const failResult: WebhookResult = {
      eventType: "PAYTRIOT.PAYMENT.FAILED",
      sessionId: order.providerSessionId ?? sessionId,
      status: "failed",
      orderId: order._id.toString(),
    };
    log.info("[paytriot.handleWebhook] returning", failResult);
    return failResult;
  },

  async testCredentials(
    _environment: "sandbox" | "live",
    merchantIdOverride?: string,
    secretOverride?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const merchantID = merchantIdOverride ?? getEnv("PAYTRIOT_MERCHANT_ID") ?? "";
      const merchantSecret = secretOverride ?? getEnv("PAYTRIOT_MERCHANT_SECRET") ?? "";

      if (!merchantID || !/^\d{6}$/.test(merchantID)) {
        return { success: false, error: "Paytriot merchant ID must be 6 digits" };
      }

      if (!merchantSecret) {
        return { success: false, error: "Paytriot merchant secret is required" };
      }

      sign({ merchantID }, merchantSecret);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Paytriot credential test failed";
      return { success: false, error: message };
    }
  },

  async voidSession(): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "Paytriot void not supported" };
  },
};

export async function retryStuckPaytriotFulfillment(
  orderId: string,
  _userId: string
): Promise<"fulfilled" | "already-finalized" | "in-progress" | "skipped"> {
  return retryStuckFulfillment({
    orderId,
    providerId: "paytriot",
    resolveCaptureId: (order) => {
      const metadata = (order.metadata ?? {}) as Record<string, unknown>;
      return (metadata.paytriotTransactionId as string) ?? undefined;
    },
    shouldRetry: (order) => {
      const sessionId = (order.providerSessionId as string | undefined) ?? "";
      return sessionId.startsWith("paytriot_");
    },
  });
}

const log = createLogger("paytriot");
