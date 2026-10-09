import { beforeEach, describe, expect, test, vi } from "vitest";
import checkoutApp from "./checkout";

const VALID_ORDER_ID = "507f1f77bcf86cd799439011";

const __mock = vi.hoisted(() => {
  const createStripeClient = vi.fn();
  const resolveStripeConfig = vi.fn();
  const createCheckoutSession = vi.fn();

  const sendShopOrderConfirmationEmail = vi.fn();
  const invalidateByChannelSafe = vi.fn();
  const getCurrentContext = vi.fn();

  const shopOrderFindOne = vi.fn();
  const shopOrderFindByIdAndUpdate = vi.fn();
  const shopCartUpdateOne = vi.fn();
  const shopProductUpdateOne = vi.fn();
  const shopProductVariantUpdateOne = vi.fn();

  const validateCheckoutItems = vi.fn();
  const createPendingShopOrder = vi.fn();

  return {
    createStripeClient,
    resolveStripeConfig,
    createCheckoutSession,
    sendShopOrderConfirmationEmail,
    invalidateByChannelSafe,
    getCurrentContext,
    shopOrderFindOne,
    shopOrderFindByIdAndUpdate,
    shopCartUpdateOne,
    shopProductUpdateOne,
    shopProductVariantUpdateOne,
    validateCheckoutItems,
    createPendingShopOrder,
  };
});

vi.mock("@oc/api-infra/db", () => ({ default: vi.fn(async () => {}) }));

vi.mock("@oc/api-server/middleware/auth", () => ({
  requireGuestCheckout: async (
    c: {
      set: (key: string, value: unknown) => void;
    },
    next: () => Promise<void>
  ) => {
    c.set("user", { id: "user-test-1", email: "buyer@example.com", isAnonymous: false });
    c.set("userId", "user-test-1");
    c.set("email", "buyer@example.com");
    c.set("sessionResolved", true);
    await next();
  },
}));

vi.mock("@oc/api-db/models", () => ({
  ShopCart: {
    updateOne: (...args: unknown[]) => __mock.shopCartUpdateOne(...args),
  },
  ShopOrder: {
    findOne: (...args: unknown[]) => __mock.shopOrderFindOne(...args),
    findByIdAndUpdate: (...args: unknown[]) => __mock.shopOrderFindByIdAndUpdate(...args),
  },
  ShopProduct: {
    updateOne: (...args: unknown[]) => __mock.shopProductUpdateOne(...args),
  },
  ShopProductVariant: {
    updateOne: (...args: unknown[]) => __mock.shopProductVariantUpdateOne(...args),
  },
}));

vi.mock("@oc/api-shop/checkout", () => ({
  validateCheckoutItems: (...args: unknown[]) => __mock.validateCheckoutItems(...args),
  createPendingShopOrder: (...args: unknown[]) => __mock.createPendingShopOrder(...args),
}));

vi.mock("@oc/api-shop/email", () => ({
  sendShopOrderConfirmationEmail: (...args: unknown[]) =>
    __mock.sendShopOrderConfirmationEmail(...args),
}));

vi.mock("@oc/api-infra/cache", () => ({
  CH: {
    shopProducts: "shopProducts",
    shopProduct: "shopProduct",
    shopCategories: "shopCategories",
    paymentConfig: "paymentConfig",
    paymentProviders: "paymentProviders",
  },
  invalidateByChannelSafe: (...args: unknown[]) => __mock.invalidateByChannelSafe(...args),
}));

vi.mock("@oc/api-infra/env", () => ({
  getCurrentContext: (...args: unknown[]) => __mock.getCurrentContext(...args),
}));

vi.mock("@oc/api-payment-stripe", () => ({
  createStripeClient: (...args: unknown[]) => __mock.createStripeClient(...args),
  resolveStripeConfig: (...args: unknown[]) => __mock.resolveStripeConfig(...args),
}));

function makeOrder(overrides: Record<string, unknown> = {}): {
  _id: string;
  orderNumber: number;
  status: string;
  provider: string;
  providerSessionId: string;
  email: string;
  userId: string;
  total: number;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  save: ReturnType<typeof vi.fn>;
  metadata?: Record<string, unknown>;
} {
  return {
    _id: VALID_ORDER_ID,
    orderNumber: 424242,
    status: "pending",
    provider: "",
    providerSessionId: "",
    email: "buyer@example.com",
    userId: "user-test-1",
    total: 2499,
    items: [{ productId: "prod_test_1", variantId: "variant_test_1", quantity: 2 }],
    save: vi.fn(async () => {}),
    ...overrides,
  };
}

function checkoutPostBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    items: [{ productId: "prod_test_1", quantity: 1 }],
    shippingAddress: {
      firstName: "Ada",
      lastName: "Lovelace",
      addressLine1: "1 Analytical Engine Way",
      city: "London",
      postcode: "SW1A 1AA",
      country: "GB",
    },
    email: "buyer@example.com",
    provider: "stripe",
    ...overrides,
  };
}

const SHOP_ORIGIN = "https://shop.onlinecompetitions.co.uk";

describe("shop checkout stripe — POST / (create Checkout Session)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mock.createStripeClient.mockReturnValue({
      createCheckoutSession: __mock.createCheckoutSession,
    });
    __mock.resolveStripeConfig.mockReturnValue({
      secretKey: "sk_test_1",
      webhookSecret: "whsec_test",
    });
    __mock.getCurrentContext.mockReturnValue({
      frontendUrl: "https://fallback.app.example.com",
      shopUrl: SHOP_ORIGIN,
    });
    __mock.validateCheckoutItems.mockResolvedValue({
      valid: true,
      items: [
        {
          productId: "prod_test_1",
          quantity: 1,
          unitPrice: 2499,
          name: "Test Product",
          sku: "TEST-1",
          subtotal: 2499,
        },
      ],
      total: 2499,
      errors: [],
    });
    __mock.createPendingShopOrder.mockImplementation(
      async (params: { providerSessionId: string }) =>
        makeOrder({ providerSessionId: params.providerSessionId })
    );
    __mock.createCheckoutSession.mockResolvedValue({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/c/pay/cs_test_abc",
      paymentIntentId: null,
    });
    __mock.shopOrderFindByIdAndUpdate.mockResolvedValue(null);
  });

  test("creates a Checkout Session with the validation total converted to minor units (pence *100) and shop-origin URLs", async () => {
    const res = await checkoutApp.request("http://localhost/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: SHOP_ORIGIN,
      },
      body: JSON.stringify(checkoutPostBody()),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(__mock.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(__mock.createCheckoutSession).toHaveBeenCalledWith({
      amount: 249900,
      currency: "gbp",
      successUrl: `${SHOP_ORIGIN}/orders/${VALID_ORDER_ID}?stripe_success=1`,
      cancelUrl: `${SHOP_ORIGIN}/checkout?cancelled=1`,
      metadata: { orderId: VALID_ORDER_ID, userId: "user-test-1", shopOrder: "true" },
    });

    const createdOrder = await __mock.createPendingShopOrder.mock.results[0]?.value;
    expect(createdOrder.provider).toBe("stripe");
    expect(createdOrder.providerSessionId).toBe("cs_test_abc");
    expect(createdOrder.save).toHaveBeenCalled();

    expect(body.data).toMatchObject({
      orderId: VALID_ORDER_ID,
      orderNumber: 424242,
      status: "pending",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_abc",
      sessionId: "cs_test_abc",
    });
  });

  test("builds Stripe redirect URLs from the configured SHOP_URL (Origin header never used)", async () => {
    const res = await checkoutApp.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(checkoutPostBody()),
    });

    expect(res.status).toBe(200);
    expect(__mock.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 249900,
        successUrl: `${SHOP_ORIGIN}/orders/${VALID_ORDER_ID}?stripe_success=1`,
        cancelUrl: `${SHOP_ORIGIN}/checkout?cancelled=1`,
      })
    );
  });

  test("persists metadata.stripePaymentIntentId when the session exposes one at creation", async () => {
    __mock.createCheckoutSession.mockResolvedValue({
      id: "cs_test_abc",
      url: "https://checkout.stripe.com/c/pay/cs_test_abc",
      paymentIntentId: "pi_test_xyz",
    });

    const res = await checkoutApp.request("http://localhost/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: SHOP_ORIGIN,
      },
      body: JSON.stringify(checkoutPostBody()),
    });

    expect(res.status).toBe(200);
    expect(__mock.shopOrderFindByIdAndUpdate).toHaveBeenCalledWith(VALID_ORDER_ID, {
      $set: { "metadata.stripePaymentIntentId": "pi_test_xyz" },
    });
  });

  test("marks the dangling pending order failed when the Stripe session cannot be created", async () => {
    __mock.createCheckoutSession.mockRejectedValue(new Error("stripe down"));

    const res = await checkoutApp.request("http://localhost/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: SHOP_ORIGIN,
      },
      body: JSON.stringify(checkoutPostBody()),
    });

    expect(res.status).toBe(500);
    expect(__mock.shopOrderFindByIdAndUpdate).toHaveBeenCalledWith(
      { _id: VALID_ORDER_ID, status: "pending" },
      { $set: { status: "failed" } }
    );
  });
});

describe("shop checkout — GET /status/:sessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function prepareLookup(doc: Record<string, unknown> | null) {
    __mock.shopOrderFindOne.mockImplementation(() => ({
      select: vi.fn(() => ({ lean: vi.fn(async () => doc) })),
    }));
  }

  test("looks up by providerSessionId (stripe checkout session id)", async () => {
    prepareLookup({ status: "pending", provider: "stripe", providerSessionId: "cs_test_abc" });

    const res = await checkoutApp.request("http://localhost/status/cs_test_abc");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      status: "pending",
      provider: "stripe",
      sessionId: "cs_test_abc",
    });
  });

  test("looks up by metadata.stripePaymentIntentId", async () => {
    prepareLookup({ status: "paid", provider: "stripe", providerSessionId: "cs_test_abc" });

    const res = await checkoutApp.request("http://localhost/status/pi_test_xyz");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      status: "paid",
      provider: "stripe",
      sessionId: "cs_test_abc",
    });
  });

  test("unknown session id returns 404", async () => {
    prepareLookup(null);

    const res = await checkoutApp.request("http://localhost/status/cs_unknown_1");

    expect(res.status).toBe(404);
  });
});
