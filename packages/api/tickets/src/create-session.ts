import { randomInt } from "node:crypto";
import { Order } from "@oc/api-db/models";
import { SOFT_DELETE_FLAG } from "@oc/api-db/plugins/soft-delete";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import { createLogger } from "@oc/api-logger";
import type { CheckoutLineItem } from "@oc/api-tickets/load-cart";
import { Types } from "mongoose";

export interface CreatePendingOrderParams {
  userId: string;
  items: CheckoutLineItem[];
  subtotal: number;
  discount: number;
  promoCode?: string;
  promoCodeId?: string;
  discountType?: string;
  promoDiscountPercent?: number;
  referralCode?: string;
  providerSessionId: string;
  provider: string;
  idempotencyKey?: string;
  cartId?: string;
  referralBonusTickets?: number;
  referralBalanceUsed?: number;
  siteCreditApplied?: number;
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    country?: string;
  };
  /** True when the buyer is an anonymous guest user. */
  isGuestCheckout?: boolean;
  /** The real email the customer provided at checkout (for guest orders). */
  orderEmail?: string;
}

/** Order states from which an existing checkout order can still be paid. */
const REUSABLE_ORDER_STATUSES = new Set(["pending", "processing"]);

export async function generateOrderNumber(retries = 3): Promise<number> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const orderNumber = randomInt(1, 1_000_000_000_000);
    const exists = await Order.findOne({ orderNumber }, { _id: 1 });
    if (!exists) return orderNumber;
  }
  throw new Error("Failed to generate unique order number after 3 attempts");
}

export async function createPendingCheckoutOrder(params: CreatePendingOrderParams) {
  log.debug("[createSession.enter]", {
    paramKeys: Object.keys(params),
    itemsLength: params.items?.length,
  });

  const totalAmount = Math.max(0, params.subtotal - params.discount);
  const siteCreditApplied = params.siteCreditApplied ?? 0;
  const gatewayAmount = Math.max(0, totalAmount - siteCreditApplied);
  const competitionIds = params.items.map((item) => item.competitionId);

  const orderNumber = await generateOrderNumber();

  const baseMetadata: Record<string, unknown> = {
    competitionIds: competitionIds.join(","),
    items: JSON.stringify(params.items),
    ...(params.promoDiscountPercent != null
      ? { promoDiscountPercent: params.promoDiscountPercent }
      : {}),
    ...(params.discountType ? { discountType: params.discountType } : {}),
    ...(params.promoCode ? { promoCode: params.promoCode } : {}),
    ...(params.referralCode ? { referralCode: params.referralCode } : {}),
    ...(params.cartId ? { cartId: params.cartId } : {}),
    ...(siteCreditApplied > 0
      ? { siteCreditApplied, gatewayAmount }
      : {}),
  };

  const userId = new Types.ObjectId(params.userId);
  const provider = params.provider as "local" | "paytriot";

  if (params.idempotencyKey) {
    // The idempotency key is derived from the cart id, and one cart outlives
    // every checkout attempt made from it. An order that can no longer be paid
    // for must therefore give the key up, or it blocks that cart forever:
    //
    //   - a finished order (completed/failed/refunded) keeps being matched by
    //     the upsert, so a new payment is attached to an order fulfillment
    //     will refuse to touch — the customer pays and receives nothing;
    //   - a soft-deleted order is hidden from the upsert filter by the
    //     soft-delete plugin, yet still occupies the unique
    //     {userId, idempotencyKey} index slot, so the insert that follows
    //     fails with E11000 on every attempt.
    //
    // The key is rewritten rather than unset: the unique index is not sparse,
    // so several orders missing the field would collide on {userId, null}.
    const blocking = await Order.findOne({ userId, idempotencyKey: params.idempotencyKey })
      .setOptions({ [SOFT_DELETE_FLAG]: true })
      .select("_id status deletedAt")
      .lean();

    if (
      blocking &&
      (blocking.deletedAt != null || !REUSABLE_ORDER_STATUSES.has(String(blocking.status)))
    ) {
      const releasedKey = `${params.idempotencyKey}:released:${blocking._id.toString()}`;
      await Order.updateOne(
        { _id: blocking._id },
        { $set: { idempotencyKey: releasedKey } }
      ).setOptions({ [SOFT_DELETE_FLAG]: true });
      log.debug("[createSession.releasedIdempotencyKey]", {
        orderId: blocking._id.toString(),
        status: blocking.status,
        deleted: blocking.deletedAt != null,
      });
    }

    const order = await Order.findOneAndUpdate(
      { userId, idempotencyKey: params.idempotencyKey },
      {
        $setOnInsert: {
          orderNumber,
          status: "pending",
          subtotal: params.subtotal,
          discountAmount: params.discount,
          total: totalAmount,
          provider,
          referralCode: params.referralCode,
          referralBonusTickets: params.referralBonusTickets ?? 0,
          referralBalanceUsed: params.referralBalanceUsed ?? 0,
          competitionIds,
          metadata: baseMetadata,
          ...(params.promoCodeId ? { promoCodeId: new Types.ObjectId(params.promoCodeId) } : {}),
        },
        $set: {
          providerSessionId: params.providerSessionId,
          shippingAddress: params.shippingAddress,
          isGuestCheckout: params.isGuestCheckout,
          orderEmail: params.orderEmail,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    // The idempotency key is derived from the cart, which outlives a single
    // checkout attempt. When the upsert matched an existing order the cart may
    // have changed since it was written, and the priced fields above only
    // apply on insert — leaving the order quoting a stale total while a fresh
    // payment is taken for the current basket. Refresh them, but only while
    // the order is still open, so a completed or refunded order is never
    // rewritten. Metadata is written key-by-key to preserve runtime state
    // already on the doc (fulfillment locks, provider ids, refund claims).
    if (order?.status === "pending") {
      const metadataSet = Object.fromEntries(
        Object.entries(baseMetadata).map(([key, value]) => [`metadata.${key}`, value])
      );
      const refreshed = await Order.findOneAndUpdate(
        { _id: order._id, status: "pending" },
        {
          $set: {
            subtotal: params.subtotal,
            discountAmount: params.discount,
            total: totalAmount,
            competitionIds,
            referralBonusTickets: params.referralBonusTickets ?? 0,
            referralBalanceUsed: params.referralBalanceUsed ?? 0,
            ...metadataSet,
            ...(params.promoCodeId ? { promoCodeId: new Types.ObjectId(params.promoCodeId) } : {}),
          },
        },
        { returnDocument: "after" }
      );
      if (refreshed) return refreshed;
    }

    return order;
  }

  try {
    const created = await Order.create({
      orderNumber,
      userId,
      status: "pending",
      subtotal: params.subtotal,
      discountAmount: params.discount,
      total: totalAmount,
      providerSessionId: params.providerSessionId,
      provider,
      referralCode: params.referralCode,
      referralBonusTickets: params.referralBonusTickets ?? 0,
      referralBalanceUsed: params.referralBalanceUsed ?? 0,
      isGuestCheckout: params.isGuestCheckout,
      orderEmail: params.orderEmail,
      idempotencyKey: params.providerSessionId,
      shippingAddress: params.shippingAddress,
      competitionIds,
      metadata: baseMetadata,
      ...(params.promoCodeId ? { promoCodeId: new Types.ObjectId(params.promoCodeId) } : {}),
    });
    return created;
  } catch (err: unknown) {
    if (params.idempotencyKey && isDuplicateKeyError(err)) {
      const existing = await Order.findOneAndUpdate(
        { userId, idempotencyKey: params.idempotencyKey },
        {
          $set: {
            providerSessionId: params.providerSessionId,
            shippingAddress: params.shippingAddress,
            isGuestCheckout: params.isGuestCheckout,
            orderEmail: params.orderEmail,
          },
        },
        { returnDocument: "after" }
      );
      if (existing) {
        log.debug("[createSession.e11000]", {
          orderId: existing._id.toString(),
          provider: existing.provider,
          providerSessionId: existing.providerSessionId,
        });
        return existing;
      }
    }
    throw err;
  }
}

export function computeCheckoutTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount);
}

export function computeGatewayChargeAmount(
  subtotal: number,
  discount: number,
  siteCreditApplied = 0
): number {
  return Math.max(0, subtotal - discount - siteCreditApplied);
}

const log = createLogger("app");
