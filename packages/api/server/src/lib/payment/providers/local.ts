import { randomBytes } from "node:crypto";
import {
  Balance,
  BalanceTransaction,
  Competition,
  InstantPrizeWin,
  Order,
  Profile,
} from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import {
  getItemsFromOrder,
  processBalanceTopUp,
  processOrderFulfillment,
} from "@oc/api-payment-core";
import {
  computeCheckoutTotal,
  computeGatewayChargeAmount,
  createPendingCheckoutOrder,
  generateOrderNumber,
} from "@oc/api-tickets/create-session";
import { clearCheckoutCartFromMetadata } from "@oc/api-tickets/load-cart";
import { releasePromoCodeUsage } from "@oc/api-tickets/promo-codes";
import { Types } from "mongoose";
import { buildFulfillmentDeps, reserveCheckoutPromoCode } from "../build-fulfillment-deps";
import { debitSiteCreditForOrder } from "../debit-site-credit-for-order";
import { fireOrderPurchaseConversion } from "../fire-order-conversion";
import { getProviderCurrency } from "./_shared/currency";
import { getSessionStatusFromOrder } from "./_shared/order-helpers";
import type {
  CreateSessionParams,
  CreateSessionResult,
  PaymentProviderAdapter,
  PaymentProviderId,
  PaymentSessionStatus,
  WebhookResult,
} from "./types";

export const localAdapter: PaymentProviderAdapter = {
  id: "local" as PaymentProviderId,

  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    log.debug(
      `[local.createSession] ENTER userId=${params.userId} cartId=${params.cartId ?? "<none>"} subtotal=${params.subtotal} discount=${params.discount} items.length=${params.items.length} referralBalanceUsed=${params.referralBalanceUsed ?? 0} referralBonusTickets=${params.referralBonusTickets ?? 0}`
    );
    for (let i = 0; i < params.items.length; i++) {
      const it = params.items[i]!;
      log.debug(
        `[local.createSession] params.items[${i}] compId=${it.competitionId} qty=${it.quantity} paidQty=${it.paidQty ?? "<undef>"} walletQty=${it.walletQty ?? "<undef>"} answerIndex=${it.answerIndex}`
      );
    }

    if (params.idempotencyKey) {
      const existingOrder = await Order.findOne({
        userId: new Types.ObjectId(params.userId),
        idempotencyKey: params.idempotencyKey,
        provider: "local",
      }).lean();

      if (existingOrder) {
        const status = existingOrder.status;
        const isInFlightOrCompleted =
          status === "pending" || status === "processing" || status === "completed";

        if (isInFlightOrCompleted) {
          log.debug(
            `[local.createSession] IDEMPOTENT HIT existingOrderId=${existingOrder._id.toString()} status=${existingOrder.status} providerSessionId=${existingOrder.providerSessionId}`
          );
          return {
            sessionId: existingOrder.providerSessionId as string,
            orderId: existingOrder._id.toString(),
            redirectUrl: `${params.frontendUrl}/checkout/success?provider=local&session_id=${existingOrder.providerSessionId}`,
          };
        }

        log.debug(
          `[local.createSession] IDEMPOTENT LOOKUP FOUND TERMINAL ORDER existingOrderId=${existingOrder._id.toString()} status=${status} — invalidating and creating new order`
        );
        await Order.deleteOne({ _id: existingOrder._id });
      }
    }

    const sessionId = `local_${randomBytes(16).toString("hex")}`;
    const siteCreditApplied = params.siteCreditApplied ?? 0;
    const orderTotal = computeCheckoutTotal(
      Number(params.subtotal) || 0,
      Number(params.discount) || 0
    );
    const totalAmount = computeGatewayChargeAmount(
      Number(params.subtotal) || 0,
      Number(params.discount) || 0,
      siteCreditApplied
    );

    const competitionIds: string[] = [];
    for (const item of params.items) {
      const competition = await Competition.findById(item.competitionId).lean();
      if (!competition) throw new Error(`Competition ${item.competitionId} not found`);
      competitionIds.push(item.competitionId);
    }

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
      provider: "local",
      idempotencyKey: params.idempotencyKey ?? sessionId,
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
        await Order.deleteOne({ _id: orderRecord._id }).catch(() => {});
        throw new Error("Promo code could not be reserved — it may have reached its maximum uses");
      }
    }

    const orderId = orderRecord._id.toString();
    try {
      const metadata = {
        competitionIds: competitionIds.join(","),
        items: JSON.stringify(params.items),
        ...(params.promoCode ? { promoCode: params.promoCode } : {}),
        ...(totalAmount <= 0 && siteCreditApplied <= 0 ? { freeEntry: true } : {}),
        ...(siteCreditApplied > 0 ? { siteCreditApplied, gatewayAmount: totalAmount } : {}),
      };

      log.debug(
        `[local.createSession] order pending created orderId=${orderId} sessionId=${sessionId} totalAmount=${totalAmount} competitionIds=${metadata.competitionIds} metadata.items=${metadata.items}`
      );

      await Order.findByIdAndUpdate(orderId, {
        status: "processing",
        paidAt: new Date(),
      });

      log.debug(`[local.createSession] order set processing orderId=${orderId}`);

      const guestProfile = await Profile.findById(params.userId).lean();
      const deps = buildFulfillmentDeps({ isGuest: guestProfile?.isGuestCheckout });

      if (siteCreditApplied > 0) {
        await debitSiteCreditForOrder({
          userId: params.userId,
          orderId,
          amount: siteCreditApplied,
        });
      }

      const fulfillmentItems = getItemsFromOrder({ metadata });
      log.debug(
        `[local.createSession] calling processOrderFulfillment orderId=${orderId} items=${JSON.stringify(fulfillmentItems)}`
      );

      const result = await processOrderFulfillment({
        orderId,
        orderNumber: orderRecord.orderNumber,
        userId: params.userId,
        competitionIds,
        items: fulfillmentItems,
        subtotal: params.subtotal,
        discountAmount: params.discount,
        total: orderTotal,
        metadata,
        logPrefix: "Local",
        deps,
        referralBalanceUsed: params.referralBalanceUsed ?? 0,
        shippingAddress: params.shippingAddress,
      });

      log.debug(
        `[local.createSession] processOrderFulfillment OK orderId=${orderId} totalQuantity=${result.totalQuantity} assignedCompetitions=${result.allAssignedNumbers.length} emailItems=${result.emailItems.length}`
      );
      for (let i = 0; i < result.allAssignedNumbers.length; i++) {
        const an = result.allAssignedNumbers[i]!;
        log.debug(
          `[local.createSession] assigned[${i}] compId=${an.competitionId} ticketCount=${an.ticketNumbers.length} sampleNumbers=${JSON.stringify(an.ticketNumbers.slice(0, 5))} entryIdSample=${JSON.stringify(an.entryIds.slice(0, 5))}`
        );
      }

      await Order.findByIdAndUpdate(orderId, {
        status: "completed",
        fulfillmentStatus: "completed",
      });
      log.debug(`[local.createSession] order COMPLETED orderId=${orderId}`);

      // Fire the purchase conversion (postback tracking) for paid local
      // checkouts, mirroring the Paytriot webhook path. Zero-total carts are
      // excluded by the guard inside fireOrderPurchaseConversion.
      fireOrderPurchaseConversion({
        order: orderRecord,
        userId: params.userId,
        email: params.orderEmail,
      });

      // Auto-claim instant prizes for guest users (they can't access dashboard)
      if (orderRecord.isGuestCheckout) {
        void InstantPrizeWin.updateMany(
          { userId: new Types.ObjectId(params.userId), claimed: false },
          { $set: { claimed: true, claimedAt: new Date() } }
        ).catch((err: unknown) => {
          console.error("[Local] Guest auto-claim failed:", err);
        });
      }
    } catch (err: unknown) {
      if (params.promoCode) {
        await releasePromoCodeUsage(params.promoCode, params.userId).catch(() => {});
      }
      console.error("[Local] Order fulfillment failed:", err);
      log.debug(
        `[local.createSession] FULFILLMENT FAILED orderId=${orderRecord._id.toString()} error=${err instanceof Error ? err.message : String(err)}`
      );
      await Order.findByIdAndUpdate(orderRecord._id, { status: "failed" });
      throw err instanceof Error ? err : new Error("Order fulfillment failed");
    }

    await clearCheckoutCartFromMetadata(
      orderRecord.metadata as Record<string, unknown>,
      params.userId
    );

    const redirectUrl = `${params.frontendUrl}/checkout/success?provider=local&session_id=${sessionId}&order_id=${orderId}&payment=success`;
    log.debug(
      `[local.createSession] EXIT OK orderId=${orderId} sessionId=${sessionId} redirectUrl=${redirectUrl}`
    );

    return {
      sessionId,
      orderId,
      redirectUrl,
    };
  },

  async getSessionStatus(sessionId: string): Promise<PaymentSessionStatus> {
    return getSessionStatusFromOrder(sessionId);
  },
  async captureSession(sessionId: string): Promise<PaymentSessionStatus> {
    return getSessionStatusFromOrder(sessionId);
  },

  async handleWebhook(_body: string, _sig: string | null | undefined): Promise<WebhookResult> {
    return { eventType: "LOCAL.ORDER.COMPLETED", sessionId: "local", status: "completed" };
  },

  async testCredentials(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  },

  async voidSession(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  },
};

/**
 * Local-only balance top-up. Lives outside the `PaymentProviderAdapter`
 * contract because top-up is a single-method concern (only `local` drives it)
 * and lives behind its own `POST /api/balance/top-up` route, not the generic
 * checkout flow. The route calls this directly rather than going through the
 * adapter lookup.
 */
export async function createLocalBalanceTopUpSession(params: {
  amount: number;
  userId: string;
  userEmail: string;
  transactionId: string;
  frontendUrl: string;
}): Promise<CreateSessionResult> {
  const sessionId = `local_topup_${randomBytes(16).toString("hex")}`;
  const orderRecord = await Order.create({
    orderNumber: await generateOrderNumber(),
    userId: new Types.ObjectId(params.userId),
    status: "completed",
    subtotal: params.amount,
    discountAmount: 0,
    total: params.amount,
    providerSessionId: sessionId,
    paidAt: new Date(),
    metadata: {
      transactionId: params.transactionId,
      type: "balance_top_up",
      currency: getProviderCurrency(localAdapter.id),
    },
  } as Parameters<typeof Order.create>[0]);

  await processBalanceTopUp({
    orderId: orderRecord._id.toString(),
    userId: params.userId,
    total: params.amount,
    transactionId: params.transactionId,
    logPrefix: "Local",
    deps: {
      updateBalance: async (userId, amount) => {
        return await Balance.findOneAndUpdate(
          { userId },
          { $inc: { available: amount } },
          { returnDocument: "after", upsert: false }
        );
      },
      updateBalanceTransaction: async (transactionId, status, balanceAfter) => {
        await BalanceTransaction.findOneAndUpdate(
          { _id: transactionId },
          { $set: { status, balanceAfter } }
        );
      },
    },
  });

  return {
    sessionId,
    orderId: orderRecord._id.toString(),
    redirectUrl: `${params.frontendUrl}/account/balance?topup=success`,
  };
}

const log = createLogger("local");
