import { sendEmail } from "@oc/api-email/client";
import { ShopOrderConfirmationEmail } from "@oc/api-email/templates/shop-order-confirmation";
import { ShopOrder } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import { getEnv } from "@oc/env/server";
import { formatOrderNumber } from "@oc/utils";
import { render } from "@react-email/render";

const log = createLogger("shop-email");

export async function sendShopOrderConfirmationEmail(order: any): Promise<void> {
  try {
    const frontendUrl = getEnv("FRONTEND_URL") || getEnv("APP_URL") || "http://localhost:3444";

    const items = order.items.map((item: any) => ({
      name: item.productSnapshot?.name || "Product",
      sku: item.productSnapshot?.sku || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      image: item.productSnapshot?.image,
    }));

    const html = await render(
      ShopOrderConfirmationEmail({
        userName: order.email?.split("@")[0] || "Customer",
        orderNumber: order.orderNumber,
        orderDate: new Date(order.createdAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        items,
        subtotal: order.subtotal,
        total: order.total,
        shippingAddress: order.shippingAddress,
        frontendUrl,
      })
    );

    await sendEmail({
      to: order.email,
      subject: `Order Confirmed — ${formatOrderNumber(order.orderNumber)}`,
      html,
    });

    if (order._id) {
      await ShopOrder.findByIdAndUpdate(order._id, {
        $set: { "metadata.confirmationEmailSentAt": new Date() },
      });
    }

    log.info(`Order confirmation email sent for order ${formatOrderNumber(order.orderNumber)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (order._id) {
      await ShopOrder.findByIdAndUpdate(order._id, {
        $set: { "metadata.confirmationEmailLastError": message },
        $inc: { "metadata.confirmationEmailAttempts": 1 },
      }).catch(() => {});
    }
    log.error("Failed to send order confirmation email:", err);
    throw err;
  }
}
