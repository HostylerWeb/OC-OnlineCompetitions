import { Order } from "@oc/api-db/models";
import { markOrderFailed } from "@oc/api-server/lib/payment/providers/_shared/order-helpers";

/** Fail in-flight checkouts so reserved spend and promo holds are released when the user clears the cart. */
export async function abandonOpenCheckoutOrdersForUser(userId: string): Promise<number> {
  const openOrders = await Order.find({
    userId,
    status: { $in: ["pending", "processing"] },
  }).lean();

  let released = 0;
  for (const order of openOrders) {
    try {
      await markOrderFailed(order);
      released++;
    } catch (err) {
      console.warn(
        `[abandon-open-orders] failed orderId=${order._id.toString()} userId=${userId}:`,
        err
      );
    }
  }
  return released;
}
