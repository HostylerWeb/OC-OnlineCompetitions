import { Order } from "@oc/api-db/models";
import {
  type CreatePendingOrderParams,
  createPendingCheckoutOrder,
} from "@oc/api-tickets/create-session";
import { releasePromoCodeUsage } from "@oc/api-tickets/promo-codes";
import { Types } from "mongoose";
import { reserveCheckoutPromoCode } from "../../build-fulfillment-deps";

/**
 * Look up an existing order for an idempotency key. Returns `null` when no
 * key is provided or no order exists. Used by the `createSession` adapters
 * to short-circuit when the user re-tries checkout (the first attempt's
 * pending order is reused).
 */
export async function findExistingOrderForIdempotency(
  userId: string,
  idempotencyKey: string | undefined
) {
  if (!idempotencyKey) return null;
  return Order.findOne({
    userId: new Types.ObjectId(userId),
    idempotencyKey,
  }).lean();
}

/**
 * Reserve the promo code, then create the pending order. Returns the order
 * doc (existing or new). Wraps the two calls that every `createSession`
 * adapter needs in sequence so the adapters can be 50-line shells.
 *
 * Note: the existing `createPendingCheckoutOrder` in `lib/checkout/create-session.ts`
 * also handles idempotency (returns the existing order if found). This helper
 * is a wrapper that adds the `reserveCheckoutPromoCode` call *before* the
 * order is created — order matters because reservation should happen before
 * the order row exists.
 */
export async function reservePromoAndCreatePendingOrder(
  params: CreatePendingOrderParams
): Promise<Awaited<ReturnType<typeof createPendingCheckoutOrder>>> {
  const promoReserved = params.promoCode
    ? await reserveCheckoutPromoCode(params.promoCode, params.userId)
    : true;
  if (params.promoCode && !promoReserved) {
    throw new Error("Promo code could not be reserved — it may have reached its maximum uses");
  }
  try {
    return await createPendingCheckoutOrder(params);
  } catch (err) {
    if (params.promoCode) {
      await releasePromoCodeUsage(params.promoCode, params.userId).catch(() => {});
    }
    throw err;
  }
}
