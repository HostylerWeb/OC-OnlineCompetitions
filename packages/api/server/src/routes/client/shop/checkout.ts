import { randomUUID } from "node:crypto";
import { ShopCart, ShopOrder } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { createLocalClient } from "@oc/api-payment-local";
import { assertComplianceForCheckout } from "@oc/api-compliance/compliance-checks";
import { ComplianceError } from "@oc/api-errors";
import { isLocalPaymentAllowed } from "@oc/api-server/lib/payment/local-payment-policy";
import { reduceInventoryFromOrder } from "@oc/api-server/lib/payment/shop-webhook-handler";
import { requireGuestCheckout } from "@oc/api-server/middleware/auth";
import { createPendingShopOrder, validateCheckoutItems } from "@oc/api-shop/checkout";
import { sendShopOrderConfirmationEmail } from "@oc/api-shop/email";
import {
  type ShopCreateCheckoutSessionInput,
  shopCreateCheckoutSessionSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";

const log = createLogger("shop-checkout");
const app = new Hono({ strict: false });

app.use("*", requireGuestCheckout);

app.post(
  "/",
  async (c, next) => validateBody(c, next, shopCreateCheckoutSessionSchema),
  async (c) => {
    try {
      await dbConnect();
      const body = c.get("body") as ShopCreateCheckoutSessionInput;
      const user = c.get("user")!;
      const userId = c.get("userId")!;
      const isGuest = (user as { isAnonymous?: boolean }).isAnonymous ?? false;

      const email = body.email ?? c.get("email");
      if (!email) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Email is required for guest checkout", 400);
      }

      if (isGuest) {
        const { createGuestCheckoutProfile } = await import("@oc/auth-admin/auth-hooks");
        await createGuestCheckoutProfile(userId, { guestEmail: email });
      }

      const validation = await validateCheckoutItems(body.items);
      if (!validation.valid) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          validation.errors.map((e: { message: string }) => e.message).join("; "),
          400
        );
      }

      try {
        await assertComplianceForCheckout({
          userId,
          cartTotal: validation.total,
          competitionIds: [],
          blockCardPayment: body.provider === "paytriot" || body.provider === "stripe",
          projectedCreditSpend:
            body.provider === "paytriot" || body.provider === "stripe" ? validation.total : 0,
        });
      } catch (err: unknown) {
        if (err instanceof ComplianceError) {
          return error(c, err.code, err.message, err.status);
        }
        throw err;
      }

      if (body.provider === "local") {
        if (!isLocalPaymentAllowed()) {
          return error(
            c,
            ErrorCodes.PAYMENT_DISABLED,
            "This payment method is not available",
            403
          );
        }
        const localClient = createLocalClient({ sessionIdPrefix: "shop_local_" });
        const sessionId = localClient.createSessionId();

        const order = await createPendingShopOrder({
          items: validation.items,
          subtotal: validation.total,
          shippingAddress: body.shippingAddress,
          email,
          userId,
          isGuestCheckout: isGuest,
          providerSessionId: sessionId,
          idempotencyKey: body.idempotencyKey,
          notes: body.notes,
        });

        order.provider = "local";
        order.status = "paid";
        order.paidAt = new Date();
        await order.save();

        await reduceInventoryFromOrder(order);

        await invalidateByChannelSafe(CH.shopProducts, CH.shopProduct, CH.shopCategories);

        log.info(`Shop order ${order.orderNumber} completed via local provider`);

        void sendShopOrderConfirmationEmail(order).catch(() => {});

        return success(c, {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
        });
      }

      const order = await createPendingShopOrder({
        items: validation.items,
        subtotal: validation.total,
        shippingAddress: body.shippingAddress,
        email,
        userId,
        isGuestCheckout: isGuest,
        providerSessionId: "",
        idempotencyKey: body.idempotencyKey,
        notes: body.notes,
      });

      if (body.provider === "paytriot") {
        const { Gateway, sign } = await import("@oc/api-payment-paytriot");
        const { PAYTRIOT_HOSTED_URL } = await import("@oc/api-payment-paytriot");

        const { getPaytriotCredentials } = await import(
          "@oc/api-server/lib/payment/ensure-paytriot-payment-method"
        );
        const creds = getPaytriotCredentials();
        const frontendUrl = (await import("@oc/api-infra/env")).getCurrentContext().frontendUrl;

        const transactionUnique = `${order._id.toString()}-${randomUUID().slice(0, 8)}`;

        const requestData: Record<string, unknown> = {
          merchantID: creds.merchantId,
          action: "SALE",
          type: 1,
          transactionUnique,
          countryCode: 826,
          currencyCode: 826,
          amount: validation.total * 100,
          redirectURL: `${frontendUrl}/api/payments/paytriot/return`,
          threeDSRedirectURL: `${frontendUrl}/api/payments/paytriot/return`,
          remoteAddress: (() => {
            const ip =
              c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
              c.req.header("x-real-ip") ??
              "127.0.0.1";
            return ip;
          })(),
          customerEmail: email,
          customerName:
            [body.shippingAddress?.firstName, body.shippingAddress?.lastName]
              .filter(Boolean)
              .join(" ") || undefined,
          customerAddress: body.shippingAddress?.addressLine1,
          customerPostCode: body.shippingAddress?.postcode,
          customerTown: body.shippingAddress?.city,
          customerPhone: body.phone,
          customerPhoneMandatory: body.phone ? "Y" : "N",
          customerCountryCode: "826",
          orderRef: order.orderNumber,
          duplicateDelay: 600,
          captureDelay: 0,
          cardCVVMandatory: "N",
          customerAddressMandatory: body.shippingAddress?.addressLine1 ? "Y" : "N",
          customerPostcodeMandatory: body.shippingAddress?.postcode ? "Y" : "N",
          customerEmailMandatory: email ? "Y" : "N",
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
          statementNarrative1: creds.statementNarrative1 ?? "Paytrio*Ukcomp",
          statementNarrative2: creds.statementNarrative2 ?? "02038841611",
        } satisfies Record<string, unknown>;

        requestData.signature = sign(requestData, creds.merchantSecret);

        const gateway = new Gateway({
          hostedUrl: PAYTRIOT_HOSTED_URL,
          merchantID: creds.merchantId,
          merchantSecret: creds.merchantSecret,
        });
        const formHtml = gateway.hostedRequest(requestData);

        order.provider = "paytriot";
        order.providerSessionId = transactionUnique;
        await ShopOrder.findByIdAndUpdate(order._id, {
          $set: {
            "metadata.paytriotFormHtml": formHtml,
            "metadata.paytriotTotal": validation.total,
          },
        });
        await order.save();

        await ShopCart.updateOne({ userId }, { $set: { items: [] } });

        return success(c, {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          checkoutUrl: `${frontendUrl}/checkout/paytriot-redirect?orderId=${order._id}`,
          formHtml,
          sessionId: order._id.toString(),
        });
      }

      if (body.provider === "stripe") {
        const { createStripeClient } = await import("@oc/api-payment-stripe");
        const client = createStripeClient();

        // The shop app origin — server-side configured SHOP_URL is the only
        // trustworthy source for Stripe redirect URLs (Origin header is
        // client-controlled and must never drive redirect destinations).
        const shopOrigin = (await import("@oc/api-infra/env"))
          .getCurrentContext()
          .shopUrl.trim()
          .replace(/\/+$/, "");

        let session: {
          id: string;
          url: string | null;
          paymentIntentId: string | null;
        };
        try {
          session = await client.createCheckoutSession({
            amount: validation.total * 100,
            currency: "gbp",
            successUrl: `${shopOrigin}/orders/${order._id}?stripe_success=1`,
            cancelUrl: `${shopOrigin}/checkout?cancelled=1`,
            metadata: {
              orderId: order._id.toString(),
              userId,
              shopOrder: "true",
            },
          });
        } catch (err: unknown) {
          // The Stripe session could not be created — never leave a dangling
          // empty pending ShopOrder behind. Mark it failed (pending only, so
          // an idempotent replay can never flip a completed order) so it
          // cannot be fulfilled by the webhook.
          await ShopOrder.findByIdAndUpdate(
            { _id: order._id, status: "pending" },
            { $set: { status: "failed" } }
          ).catch(() => {});
          throw err;
        }

        order.provider = "stripe";
        // Concurrent duplicate submits: the idempotent upsert may have
        // returned an order that already owns a live session. If so, void
        // the session we just created and keep the existing one — one
        // order, one charge.
        if (order.providerSessionId && order.providerSessionId !== session.id) {
          await client.cancelCheckoutSession(session.id).catch(() => {});
          return success(c, {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            checkoutUrl: `${shopOrigin}/orders/${order._id}?stripe_success=1`,
            sessionId: order.providerSessionId,
          });
        }
        order.providerSessionId = session.id;
        await order.save();

        if (session.paymentIntentId) {
          await ShopOrder.findByIdAndUpdate(order._id, {
            $set: { "metadata.stripePaymentIntentId": session.paymentIntentId },
          });
        }

        return success(c, {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          checkoutUrl: session.url,
          sessionId: session.id,
        });
      }

      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Unsupported payment provider: ${body.provider}`,
        400
      );
    } catch (err: unknown) {
      log.error("Error creating checkout session:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "shop.checkout.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.get("/status/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    await dbConnect();

    const order = await ShopOrder.findOne({
      $or: [{ providerSessionId: sessionId }, { "metadata.stripePaymentIntentId": sessionId }],
    })
      .select("status providerSessionId provider")
      .lean();

    if (!order) {
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }

    return success(c, {
      status: order.status,
      provider: order.provider,
      sessionId: order.providerSessionId,
    });
  } catch (err) {
    log.error("Error fetching shop order status:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
