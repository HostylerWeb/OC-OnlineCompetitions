import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { handleShopStripeWebhook } from "./shop-webhook-handler";

const __mocks = vi.hoisted(() => ({
  __shopOrderFindOne: vi.fn(),
  __shopOrderFindByIdAndUpdate: vi.fn(),
  __shopProductUpdateOne: vi.fn(),
  __shopProductVariantUpdateOne: vi.fn(),
  __storePendingWebhook: vi.fn(async () => {}),
  __sendShopOrderConfirmationEmail: vi.fn(async () => {}),
  __invalidateByChannelSafe: vi.fn(async () => {}),
}));

vi.mock("@oc/api-db/models", () => ({
  ShopOrder: {
    findOne: (...args: unknown[]) => __mocks.__shopOrderFindOne(...args),
    findByIdAndUpdate: (...args: unknown[]) => __mocks.__shopOrderFindByIdAndUpdate(...args),
  },
  ShopProduct: { updateOne: (...args: unknown[]) => __mocks.__shopProductUpdateOne(...args) },
  ShopProductVariant: {
    updateOne: (...args: unknown[]) => __mocks.__shopProductVariantUpdateOne(...args),
  },
}));

vi.mock("@oc/api-infra/cache", () => ({
  CH: {
    shopProducts: "shopProducts",
    shopProduct: "shopProduct",
    shopCategories: "shopCategories",
  },
  invalidateByChannelSafe: (...args: unknown[]) => __mocks.__invalidateByChannelSafe(...args),
}));

vi.mock("@oc/api-logger", () => ({
  createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

vi.mock("@oc/api-shop/email", () => ({
  sendShopOrderConfirmationEmail: (...args: unknown[]) =>
    __mocks.__sendShopOrderConfirmationEmail(...args),
}));

vi.mock("./providers/_shared/pending-webhooks", () => ({
  storePendingWebhook: (...args: unknown[]) => __mocks.__storePendingWebhook(...args),
}));

function event(type: string, object: Record<string, unknown>, id = "evt_1") {
  return {
    id,
    type,
    created: 1730000000,
    data: { object },
    livemode: false,
    pending_webhooks: 0,
  } as const;
}

function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "shop_order_1" },
    orderNumber: 424242,
    status: "pending",
    provider: "stripe",
    providerSessionId: "cs_test_abc",
    email: "buyer@example.com",
    userId: "user-test-1",
    total: 2499,
    items: [{ productId: "prod_test_1", variantId: "variant_test_1", quantity: 2 }],
    save: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("handleShopStripeWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.__shopOrderFindByIdAndUpdate.mockResolvedValue(null);
    __mocks.__shopProductVariantUpdateOne.mockResolvedValue({});
    __mocks.__shopProductUpdateOne.mockResolvedValue({});
    __mocks.__invalidateByChannelSafe.mockResolvedValue(undefined);
    __mocks.__sendShopOrderConfirmationEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("fulfills a matching ShopOrder: marks paid, reduces inventory, persists intent id, sends email", async () => {
    const order = paidOrder();
    __mocks.__shopOrderFindOne.mockResolvedValue(order);

    const result = await handleShopStripeWebhook(
      JSON.stringify({ id: "evt_1", type: "checkout.session.completed" }),
      event("checkout.session.completed", {
        id: "cs_test_abc",
        payment_intent: "pi_test_xyz",
        payment_status: "paid",
        metadata: { orderId: "shop_order_1" },
      }),
      { signature: "t=1,v1=valid" }
    );

    expect(result.status).toBe("completed");
    expect(result.orderId).toBe("shop_order_1");
    expect(__mocks.__shopOrderFindByIdAndUpdate).toHaveBeenCalledWith(
      { toString: expect.any(Function) },
      { $set: { "metadata.stripePaymentIntentId": "pi_test_xyz" } }
    );
    expect(__mocks.__shopProductVariantUpdateOne).toHaveBeenCalled();
    expect(__mocks.__shopProductUpdateOne).not.toHaveBeenCalled();
    expect(order.status).toBe("paid");
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(order.save).toHaveBeenCalled();
    expect(__mocks.__invalidateByChannelSafe).toHaveBeenCalled();
    expect(__mocks.__sendShopOrderConfirmationEmail).toHaveBeenCalledWith(order);
    expect(__mocks.__storePendingWebhook).not.toHaveBeenCalled();
  });

  test("acks without re-fulfilling an already-paid order", async () => {
    const order = paidOrder({ status: "paid", paidAt: new Date() });
    __mocks.__shopOrderFindOne.mockResolvedValue(order);

    const result = await handleShopStripeWebhook(
      JSON.stringify({ id: "evt_1" }),
      event("checkout.session.completed", {
        id: "cs_test_abc",
        payment_status: "paid",
      })
    );

    expect(result.status).toBe("completed");
    expect(order.save).not.toHaveBeenCalled();
    expect(__mocks.__shopProductVariantUpdateOne).not.toHaveBeenCalled();
    expect(__mocks.__sendShopOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  test("acks without fulfilling when payment_status is not paid", async () => {
    const order = paidOrder();
    __mocks.__shopOrderFindOne.mockResolvedValue(order);

    const result = await handleShopStripeWebhook(
      JSON.stringify({ id: "evt_1" }),
      event("checkout.session.completed", {
        id: "cs_test_abc",
        payment_status: "unpaid",
      })
    );

    expect(result.status).toBe("pending");
    expect(order.status).toBe("pending");
    expect(order.save).not.toHaveBeenCalled();
    expect(__mocks.__shopProductVariantUpdateOne).not.toHaveBeenCalled();
  });

  test("parks an unknown session as pending and acks (never throws)", async () => {
    __mocks.__shopOrderFindOne.mockResolvedValue(null);

    const result = await handleShopStripeWebhook(
      JSON.stringify({ id: "evt_1" }),
      event("checkout.session.completed", {
        id: "cs_unknown",
        payment_intent: "pi_unknown",
        payment_status: "paid",
      }),
      { signature: "t=1,v1=valid" }
    );

    expect(result.status).toBe("failed");
    expect(__mocks.__storePendingWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "stripe",
        eventId: "evt_1",
        signature: "t=1,v1=valid",
      })
    );
    expect(__mocks.__shopProductVariantUpdateOne).not.toHaveBeenCalled();
  });

  test("claims the order by client_reference_id", async () => {
    const order = paidOrder();
    __mocks.__shopOrderFindOne.mockResolvedValue(order);

    const result = await handleShopStripeWebhook(
      JSON.stringify({ id: "evt_1" }),
      event("checkout.session.completed", {
        id: "cs_test_abc",
        client_reference_id: "shop_order_1",
        payment_status: "paid",
      })
    );

    expect(result.status).toBe("completed");
    expect(__mocks.__shopOrderFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([{ providerSessionId: "shop_order_1" }]),
      })
    );
  });
});
