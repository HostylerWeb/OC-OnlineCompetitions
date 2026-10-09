import { beforeEach, describe, expect, test, vi } from "vitest";

const __webhookMocks = vi.hoisted(() => {
  class StripeError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
      this.name = "StripeError";
    }
  }
  return {
    StripeError,
    verifyWebhookSignature: vi.fn(),
    handleShopStripeWebhook: vi.fn(),
    dispatchWebhook: vi.fn(),
    processedWebhookFindOne: vi.fn(async () => null),
    processedWebhookCreate: vi.fn(async () => ({})),
  };
});

vi.mock("@oc/api-infra/db", () => ({ default: vi.fn(async () => {}) }));
vi.mock("@oc/api-payment-stripe", () => ({
  createStripeClient: () => ({ verifyWebhookSignature: __webhookMocks.verifyWebhookSignature }),
  StripeError: __webhookMocks.StripeError,
}));
vi.mock("@oc/api-server/lib/payment/providers", () => ({
  getAdapter: () => ({ handleWebhook: vi.fn() }),
  paymentProcessors: [],
}));
vi.mock("@oc/api-server/lib/payment/providers/stripe", () => ({
  getResolvedWebhookSecret: async () => "whsec_test",
}));
vi.mock("@oc/api-server/lib/payment/shop-webhook-handler", () => ({
  handleShopStripeWebhook: (...args: unknown[]) => __webhookMocks.handleShopStripeWebhook(...args),
}));
vi.mock("@oc/api-server/lib/payment/providers/_shared/webhook-helpers", () => ({
  dispatchWebhook: (...args: unknown[]) => __webhookMocks.dispatchWebhook(...args),
}));
vi.mock("@oc/api-db/models", () => ({
  Order: {
    findOne: vi.fn(async () => null),
    findOneAndUpdate: vi.fn(async () => null),
    findById: vi.fn(async () => null),
    findByIdAndUpdate: vi.fn(async () => null),
  },
  PaymentMethod: { findOne: vi.fn(async () => null), find: vi.fn(async () => []) },
  Profile: { findOne: vi.fn(async () => null), findById: vi.fn(async () => null) },
  ShopOrder: { findOne: vi.fn(async () => null), findByIdAndUpdate: vi.fn(async () => null) },
  ProcessedWebhook: {
    findOne: () => ({
      lean: (...args: unknown[]) => __webhookMocks.processedWebhookFindOne(...args),
    }),
    create: (...args: unknown[]) => __webhookMocks.processedWebhookCreate(...args),
  },
}));

import { buildPaytriotErrorUrlParams, decidePaytriotPaymentParam } from "./payments";

describe("decidePaytriotPaymentParam — payment-param decision matrix", () => {
  test("dispatch=completed + no fulfillmentFailed -> success", () => {
    expect(decidePaytriotPaymentParam("completed", {})).toBe("success");
  });

  test("dispatch=processing + no fulfillmentFailed -> success", () => {
    expect(decidePaytriotPaymentParam("processing", {})).toBe("success");
  });

  test("dispatch=failed + no fulfillmentFailed -> failed", () => {
    expect(decidePaytriotPaymentParam("failed", {})).toBe("failed");
  });

  test("dispatch=pending + no fulfillmentFailed -> failed", () => {
    expect(decidePaytriotPaymentParam("pending", {})).toBe("failed");
  });

  test("dispatch='' + no fulfillmentFailed -> failed", () => {
    expect(decidePaytriotPaymentParam("", {})).toBe("failed");
  });

  test("dispatch=completed + orderMeta=null -> success", () => {
    expect(decidePaytriotPaymentParam("completed", null)).toBe("success");
  });

  test("REGRESSION GUARD: dispatch=completed + fulfillmentFailed=true -> captured-but-not-fulfilled", () => {
    expect(decidePaytriotPaymentParam("completed", { fulfillmentFailedAfterCapture: true })).toBe(
      "captured-but-not-fulfilled"
    );
  });

  test("dispatch=processing + fulfillmentFailed=true -> captured-but-not-fulfilled", () => {
    expect(decidePaytriotPaymentParam("processing", { fulfillmentFailedAfterCapture: true })).toBe(
      "captured-but-not-fulfilled"
    );
  });

  test("dispatch=failed + fulfillmentFailed=true -> captured-but-not-fulfilled", () => {
    expect(decidePaytriotPaymentParam("failed", { fulfillmentFailedAfterCapture: true })).toBe(
      "captured-but-not-fulfilled"
    );
  });

  test("FULFILLMENT PRIORITY: fulfillmentFailed beats paytriotErrorCategory", () => {
    expect(
      decidePaytriotPaymentParam("completed", {
        fulfillmentFailedAfterCapture: true,
        paytriotErrorCategory: "CARD_DECLINED",
      })
    ).toBe("captured-but-not-fulfilled");
  });

  test("FULFILLMENT PRIORITY: fulfillmentFailed beats failed dispatch", () => {
    expect(
      decidePaytriotPaymentParam("failed", {
        fulfillmentFailedAfterCapture: true,
        paytriotErrorCategory: "INTERNAL_ERROR",
      })
    ).toBe("captured-but-not-fulfilled");
  });
});

describe("buildPaytriotErrorUrlParams — rich error param extraction", () => {
  test("null orderMeta returns no params", () => {
    expect(buildPaytriotErrorUrlParams(null)).toEqual({});
  });

  test("empty orderMeta returns no params", () => {
    expect(buildPaytriotErrorUrlParams({})).toEqual({});
  });

  test("card declined with all rich params", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "CARD_DECLINED",
      paytriotErrorTitle: "Card declined",
      paytriotErrorUserMessage: "Your card was declined.",
      paytriotErrorRecommendedAction: "contact_bank",
      paytriotErrorWasCharged: false,
    });
    expect(params).toEqual({
      code: "CARD_DECLINED",
      title: "Card declined",
      msg: "Your card was declined.",
      action: "contact_bank",
      wasCharged: "false",
    });
  });

  test("card referred includes referralPhone", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "CARD_REFERRED",
      paytriotReferralPhone: "+441234567890",
    });
    expect(params.referralPhone).toBe("+441234567890");
  });

  test("CVV mismatch detected via avsField=cvv", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "CARD_DECLINED",
      paytriotAvs: { cv2Check: "not matched" },
    });
    expect(params.avsField).toBe("cvv");
  });

  test("address mismatch detected via avsField=address", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "CARD_DECLINED",
      paytriotAvs: { addressCheck: "not matched" },
    });
    expect(params.avsField).toBe("address");
  });

  test("postcode mismatch detected via avsField=postcode", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "CARD_DECLINED",
      paytriotAvs: { postcodeCheck: "partially matched" },
    });
    expect(params.avsField).toBe("postcode");
  });

  test("matched AVS does NOT set avsField", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "CARD_DECLINED",
      paytriotAvs: {
        cv2Check: "matched",
        addressCheck: "matched",
        postcodeCheck: "matched",
      },
    });
    expect(params.avsField).toBeUndefined();
  });

  test("not-checked AVS does NOT set avsField", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "CARD_DECLINED",
      paytriotAvs: {
        cv2Check: "not checked",
        addressCheck: "not checked",
        postcodeCheck: "not checked",
      },
    });
    expect(params.avsField).toBeUndefined();
  });

  test("3DS auth failure (N) sets threeDS param", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "THREE_DS_AUTH_FAILED",
      paytriotThreeDS: { authenticated: "N" },
    });
    expect(params.threeDS).toBe("N");
  });

  test("3DS authenticated (Y) does NOT set threeDS param", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "CARD_DECLINED",
      paytriotThreeDS: { authenticated: "Y" },
    });
    expect(params.threeDS).toBeUndefined();
  });

  test("FULFILLMENT_FAILED category emits user-facing params", () => {
    const params = buildPaytriotErrorUrlParams({
      paytriotErrorCategory: "FULFILLMENT_FAILED",
      paytriotErrorTitle: "Order processing failed",
      paytriotErrorUserMessage:
        'Order processing failed after payment capture: TICKETS_SOLD_OUT:Only 0 tickets available for "2000£ TAX FREE CASH"',
      paytriotErrorRecommendedAction: "contact_support",
      paytriotErrorWasCharged: true,
    });
    expect(params).toEqual({
      code: "FULFILLMENT_FAILED",
      title: "Order processing failed",
      msg: 'Order processing failed after payment capture: TICKETS_SOLD_OUT:Only 0 tickets available for "2000£ TAX FREE CASH"',
      action: "contact_support",
      wasCharged: "true",
    });
  });
});

describe("decidePaytriotPaymentParam + buildPaytriotErrorUrlParams — captured-but-not-fulfilled URL", () => {
  test("FULFILLMENT_FAILED: produces payment=captured-but-not-fulfilled with rich params", () => {
    const orderMeta = {
      fulfillmentFailedAfterCapture: true,
      paytriotErrorCategory: "FULFILLMENT_FAILED",
      paytriotErrorTitle: "Order processing failed",
      paytriotErrorUserMessage:
        "Order processing failed after payment capture: TICKETS_SOLD_OUT:Only 0 tickets available",
      paytriotErrorRecommendedAction: "contact_support",
      paytriotErrorWasCharged: true,
    };
    const paymentParam = decidePaytriotPaymentParam("completed", orderMeta);
    expect(paymentParam).toBe("captured-but-not-fulfilled");
    const errorParams = buildPaytriotErrorUrlParams(orderMeta);
    expect(errorParams.code).toBe("FULFILLMENT_FAILED");
    expect(errorParams.title).toBe("Order processing failed");
    expect(errorParams.action).toBe("contact_support");
    expect(errorParams.wasCharged).toBe("true");
  });

  test("dispatch=completed WITHOUT fulfillmentFailed still returns success (regression guard)", () => {
    const orderMeta = {
      paytriotErrorCategory: "SUCCESS",
      paytriotErrorTitle: "Payment successful",
    };
    expect(decidePaytriotPaymentParam("completed", orderMeta)).toBe("success");
  });
});

describe("unified stripe webhook — POST /webhook/stripe event routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __webhookMocks.handleShopStripeWebhook.mockImplementation(async () => ({
      eventType: "checkout.session.completed",
      sessionId: "cs_1",
      status: "completed",
      orderId: "shop_order_1",
    }));
    __webhookMocks.dispatchWebhook.mockImplementation(async () => ({
      eventType: "payment_intent.succeeded",
      sessionId: "pi_1",
      status: "completed",
    }));
    __webhookMocks.processedWebhookFindOne.mockResolvedValue(null);
    __webhookMocks.processedWebhookCreate.mockResolvedValue({});
  });

  function endpoint() {
    return import("./payments");
  }

  function stripeEventBody(type: string, object: Record<string, unknown>): string {
    return JSON.stringify({
      id: "evt_test_1",
      type,
      created: 1730000000,
      data: { object },
      livemode: false,
      pending_webhooks: 0,
    });
  }

  test("routes checkout.session.completed to the shop fulfillment path", async () => {
    const { default: app } = await endpoint();
    __webhookMocks.verifyWebhookSignature.mockImplementation(async (body: string) =>
      JSON.parse(body)
    );

    const res = await app.request("http://localhost/webhook/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=valid" },
      body: stripeEventBody("checkout.session.completed", {
        id: "cs_1",
        payment_intent: "pi_1",
        payment_status: "paid",
      }),
    });

    expect(res.status).toBe(200);
    expect(__webhookMocks.verifyWebhookSignature).toHaveBeenCalledTimes(1);
    expect(__webhookMocks.handleShopStripeWebhook).toHaveBeenCalledTimes(1);
    expect(__webhookMocks.handleShopStripeWebhook).toHaveBeenCalledWith(
      expect.stringContaining("checkout.session.completed"),
      expect.objectContaining({ type: "checkout.session.completed" }),
      { signature: "t=1,v1=valid" }
    );
    expect(__webhookMocks.dispatchWebhook).not.toHaveBeenCalled();
  });

  test("routes orders events (payment_intent.succeeded) to the orders flow", async () => {
    const { default: app } = await endpoint();
    __webhookMocks.verifyWebhookSignature.mockImplementation(async (body: string) =>
      JSON.parse(body)
    );

    const res = await app.request("http://localhost/webhook/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=valid" },
      body: stripeEventBody("payment_intent.succeeded", { id: "pi_1" }),
    });

    expect(res.status).toBe(200);
    expect(__webhookMocks.handleShopStripeWebhook).not.toHaveBeenCalled();
    expect(__webhookMocks.dispatchWebhook).toHaveBeenCalledTimes(1);
    expect(__webhookMocks.dispatchWebhook).toHaveBeenCalledWith(
      "stripe",
      expect.stringContaining("payment_intent.succeeded"),
      expect.objectContaining({ "stripe-signature": "t=1,v1=valid" })
    );
  });

  test("rejects a missing stripe-signature header with 400", async () => {
    const { default: app } = await endpoint();

    const res = await app.request("http://localhost/webhook/stripe", {
      method: "POST",
      body: stripeEventBody("checkout.session.completed", { id: "cs_1" }),
    });

    expect(res.status).toBe(400);
    expect(__webhookMocks.verifyWebhookSignature).not.toHaveBeenCalled();
    expect(__webhookMocks.handleShopStripeWebhook).not.toHaveBeenCalled();
  });

  test("rejects an invalid signature with 400 without touching handlers", async () => {
    const { default: app } = await endpoint();
    __webhookMocks.verifyWebhookSignature.mockRejectedValue(
      new __webhookMocks.StripeError("WEBHOOK_INVALID", "bad sig")
    );

    const res = await app.request("http://localhost/webhook/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=bogus" },
      body: stripeEventBody("checkout.session.completed", { id: "cs_1" }),
    });

    expect(res.status).toBe(400);
    expect(__webhookMocks.handleShopStripeWebhook).not.toHaveBeenCalled();
    expect(__webhookMocks.dispatchWebhook).not.toHaveBeenCalled();
  });
});
