import { Types } from "mongoose";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "locked-token-0000-0000-000000000000"),
}));

const __mocks = vi.hoisted(() => {
  const findByIdState: { result: unknown } = { result: null };

  function queryWithResult(result: unknown) {
    return {
      select: vi.fn(() => ({
        lean: vi.fn(async () => result),
      })),
      lean: vi.fn(async () => result),
    };
  }

  const mockOrder = (overrides: Record<string, unknown> = {}) => {
    const oid = new Types.ObjectId();
    return {
      _id: oid,
      orderNumber: "ORD-001",
      status: "pending",
      total: 1000,
      subtotal: 1000,
      discountAmount: 0,
      providerSessionId: "sess_123",
      metadata: { competitionIds: "comp1" },
      referralBalanceUsed: 0,
      shippingAddress: undefined,
      toString: () => oid.toString(),
      ...overrides,
    };
  };

  return {
    orderFindOneAndUpdate: vi.fn(),
    orderFindById: vi.fn(() => queryWithResult(findByIdState.result)),
    setFindByIdResult: (result: unknown) => {
      findByIdState.result = result;
    },
    processOrderFulfillment: vi.fn(),
    rollbackOrderFulfillment: vi.fn(),
    clearCheckoutCartFromMetadata: vi.fn(async () => {}),
    releaseReservedSpend: vi.fn(),
    sendPushNotification: vi.fn(async () => {}),
    incrementCounter: vi.fn(),
    withMongoTransactionOptional: vi.fn(async (fn: (s: null) => Promise<unknown>) => fn(null)),
    fireConversion: vi.fn(),
    getAffiliateClickId: vi.fn(() => null),
    getAffiliateSource: vi.fn(() => null),

    mockOrder,
  };
});

vi.mock("@oc/api-db/models", () => ({
  Order: {
    findOneAndUpdate: __mocks.orderFindOneAndUpdate,
    findById: __mocks.orderFindById,
  },
  Profile: {
    findById: vi.fn(() => ({
      select: vi.fn(() => ({ lean: async () => null })),
      lean: async () => null,
    })),
  },
}));

vi.mock("@oc/api-affiliate", () => ({
  fireConversion: __mocks.fireConversion,
  getAffiliateClickId: __mocks.getAffiliateClickId,
  getAffiliateSource: __mocks.getAffiliateSource,
}));

vi.mock("@oc/api-payment-core", () => ({
  processOrderFulfillment: __mocks.processOrderFulfillment,
  getItemsFromOrder: vi.fn(() => []),
}));

vi.mock("@oc/api-compliance/spend-tracking", () => ({
  releaseReservedSpend: __mocks.releaseReservedSpend,
}));

vi.mock("@oc/api-infra/mongo-capabilities", () => ({
  withMongoTransactionOptional: __mocks.withMongoTransactionOptional,
}));

vi.mock("@oc/api-logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), warn: vi.fn() })),
}));

vi.mock("@oc/api-server/lib/observability/metrics", () => ({
  incrementCounter: __mocks.incrementCounter,
}));

vi.mock("@oc/api-server/lib/push", () => ({
  sendPushNotification: __mocks.sendPushNotification,
}));

vi.mock("@oc/api-tickets/load-cart", () => ({
  clearCheckoutCartFromMetadata: __mocks.clearCheckoutCartFromMetadata,
}));

vi.mock("./build-fulfillment-deps", () => ({
  buildFulfillmentDeps: vi.fn(() => ({})),
}));

vi.mock("./rollback-order-fulfillment", () => ({
  rollbackOrderFulfillment: __mocks.rollbackOrderFulfillment,
}));

interface FinalizeParams {
  orderId: string;
  userId: string;
  captureId?: string;
  source: "capture" | "webhook";
  logPrefix: string;
}

let finalizeSuccessfulOrder: (params: FinalizeParams) => Promise<string>;

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("finalizeSuccessfulOrder", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    __mocks.setFindByIdResult(null);
    __mocks.withMongoTransactionOptional.mockImplementation(
      async (fn: (s: null) => Promise<unknown>) => fn(null)
    );
    __mocks.processOrderFulfillment.mockResolvedValue({ totalQuantity: 2 });
    __mocks.releaseReservedSpend.mockResolvedValue(undefined);
    __mocks.getAffiliateClickId.mockReturnValue(null);
    __mocks.getAffiliateSource.mockReturnValue(null);

    const mod = await import("./finalize-successful-order");
    finalizeSuccessfulOrder = mod.finalizeSuccessfulOrder;
  });

  test("acquires lock and processes fulfillment", async () => {
    const order = __mocks.mockOrder();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(order);

    const result = await finalizeSuccessfulOrder({
      orderId: order._id.toString(),
      userId: new Types.ObjectId().toString(),
      captureId: "capture_123",
      source: "capture",
      logPrefix: "TEST",
    });

    expect(result).toBe("fulfilled");
    expect(__mocks.processOrderFulfillment).toHaveBeenCalledTimes(1);
    expect(__mocks.sendPushNotification).toHaveBeenCalledTimes(1);
    expect(__mocks.clearCheckoutCartFromMetadata).toHaveBeenCalledTimes(1);
    expect(__mocks.releaseReservedSpend).toHaveBeenCalledWith(expect.any(String), order.total);
    expect(__mocks.incrementCounter).toHaveBeenCalledWith("order.fulfilled");
  });

  test("returns in-progress when lock is already held", async () => {
    const orderId = new Types.ObjectId();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(null);
    __mocks.setFindByIdResult({
      _id: orderId,
      status: "processing",
      metadata: {
        fulfillmentLock: {
          token: "other-token",
          expiresAt: new Date(Date.now() + 60000),
        },
      },
    });

    const result = await finalizeSuccessfulOrder({
      orderId: orderId.toString(),
      userId: new Types.ObjectId().toString(),
      source: "webhook",
      logPrefix: "TEST",
    });

    expect(result).toBe("in-progress");
  });

  test("returns already-finalized when order is completed", async () => {
    const orderId = new Types.ObjectId();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(null);
    __mocks.setFindByIdResult({
      _id: orderId,
      status: "completed",
    });

    const result = await finalizeSuccessfulOrder({
      orderId: orderId.toString(),
      userId: new Types.ObjectId().toString(),
      source: "webhook",
      logPrefix: "TEST",
    });

    expect(result).toBe("already-finalized");
  });

  test("returns already-finalized when order is refunded", async () => {
    const orderId = new Types.ObjectId();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(null);
    __mocks.setFindByIdResult({
      _id: orderId,
      status: "refunded",
    });

    const result = await finalizeSuccessfulOrder({
      orderId: orderId.toString(),
      userId: new Types.ObjectId().toString(),
      source: "webhook",
      logPrefix: "TEST",
    });

    expect(result).toBe("already-finalized");
  });

  test("handles fulfillment error with rollback (returns 'fulfilled' so webhook does not poison redirect)", async () => {
    const order = __mocks.mockOrder();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(order);
    __mocks.withMongoTransactionOptional.mockRejectedValue(new Error("fulfillment failed"));
    __mocks.setFindByIdResult({
      ...order,
      metadata: {
        ...order.metadata,
        fulfillmentLock: {
          token: "locked-token-0000-0000-000000000000",
          expiresAt: new Date(Date.now() + 60000),
        },
      },
    });
    __mocks.rollbackOrderFulfillment.mockResolvedValue(undefined);

    // Since cd10072d the function does NOT re-throw fulfillment errors.
    // It catches them, marks the order failed + fulfillmentFailedAfterCapture,
    // and returns "fulfilled" so the webhook handler can persist the
    // FULFILLMENT_FAILED metadata and the success page can route the
    // customer to the right UI. The error is surfaced via the order's
    // metadata, not via a thrown exception.
    const result = await finalizeSuccessfulOrder({
      orderId: order._id.toString(),
      userId: new Types.ObjectId().toString(),
      captureId: "capture_123",
      source: "capture",
      logPrefix: "TEST",
    });
    expect(result).toBe("fulfilled");

    expect(__mocks.rollbackOrderFulfillment).toHaveBeenCalledTimes(1);
    expect(__mocks.incrementCounter).toHaveBeenCalledWith("order.failed");

    // Verify the order was marked failed with the E3 + Step 2 fields.
    const failureUpdate = __mocks.orderFindOneAndUpdate.mock.calls[1]?.[1] as
      | {
          $set?: Record<string, unknown>;
        }
      | undefined;
    expect(failureUpdate?.$set?.status).toBe("failed");
    expect(failureUpdate?.$set?.["metadata.fulfillmentFailedAfterCapture"]).toBe(true);
    expect(failureUpdate?.$set?.["metadata.paytriotErrorCategory"]).toBe("FULFILLMENT_FAILED");
    expect(failureUpdate?.$set?.["metadata.paytriotErrorTitle"]).toBe("Order processing failed");
    expect(failureUpdate?.$set?.["metadata.paytriotErrorUserMessage"]).toContain(
      "fulfillment failed"
    );
    expect(failureUpdate?.$set?.["metadata.paytriotErrorRecommendedAction"]).toBe(
      "contact_support"
    );
    expect(failureUpdate?.$set?.["metadata.paytriotErrorWasCharged"]).toBe(true);
    // Provider-generic keys written for every provider, alongside legacy ones.
    expect(failureUpdate?.$set?.["metadata.paymentErrorCategory"]).toBe("FULFILLMENT_FAILED");
    expect(failureUpdate?.$set?.["metadata.paymentErrorTitle"]).toBe("Order processing failed");
    expect(failureUpdate?.$set?.["metadata.paymentErrorUserMessage"]).toContain(
      "fulfillment failed"
    );
    expect(failureUpdate?.$set?.["metadata.paymentErrorRecommendedAction"]).toBe("contact_support");
    expect(failureUpdate?.$set?.["metadata.paymentErrorWasCharged"]).toBe(true);
  });

  test("skips rollback when lock token has changed (expiry)", async () => {
    const order = __mocks.mockOrder();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(order);
    __mocks.withMongoTransactionOptional.mockRejectedValue(new Error("fulfillment failed"));
    __mocks.setFindByIdResult({
      ...order,
      metadata: {
        fulfillmentLock: {
          token: "different-token",
          expiresAt: new Date(Date.now() + 60000),
        },
      },
    });

    const result = await finalizeSuccessfulOrder({
      orderId: order._id.toString(),
      userId: new Types.ObjectId().toString(),
      captureId: "capture_123",
      source: "capture",
      logPrefix: "TEST",
    });

    expect(result).toBe("in-progress");
    expect(__mocks.rollbackOrderFulfillment).not.toHaveBeenCalled();
  });

  test("throws when capture source has no captureId", async () => {
    await expect(
      finalizeSuccessfulOrder({
        orderId: new Types.ObjectId().toString(),
        userId: new Types.ObjectId().toString(),
        source: "capture",
        logPrefix: "TEST",
      })
    ).rejects.toThrow("payment_not_confirmed");
  });

  test("throws when order not found or not in fulfillable state", async () => {
    const orderId = new Types.ObjectId();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(null);
    __mocks.setFindByIdResult(null);

    await expect(
      finalizeSuccessfulOrder({
        orderId: orderId.toString(),
        userId: new Types.ObjectId().toString(),
        source: "webhook",
        logPrefix: "TEST",
      })
    ).rejects.toThrow("Order not found or not in fulfillable state");
  });

  test("throws when order exists with unexpected status", async () => {
    const orderId = new Types.ObjectId();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(null);
    __mocks.setFindByIdResult({
      _id: orderId,
      status: "cancelled",
    });

    await expect(
      finalizeSuccessfulOrder({
        orderId: orderId.toString(),
        userId: new Types.ObjectId().toString(),
        source: "webhook",
        logPrefix: "TEST",
      })
    ).rejects.toThrow("Order not found or not in fulfillable state");
  });

  test("webhook source does not require captureId", async () => {
    const order = __mocks.mockOrder();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(order);

    const result = await finalizeSuccessfulOrder({
      orderId: order._id.toString(),
      userId: new Types.ObjectId().toString(),
      source: "webhook",
      logPrefix: "TEST",
    });

    expect(result).toBe("fulfilled");
  });

  test.each([0, -5])("does not fire conversions when order.total is %s", async (total) => {
    const order = __mocks.mockOrder({ total });
    __mocks.orderFindOneAndUpdate.mockResolvedValue(order);

    const result = await finalizeSuccessfulOrder({
      orderId: order._id.toString(),
      userId: new Types.ObjectId().toString(),
      source: "webhook",
      logPrefix: "TEST",
    });

    expect(result).toBe("fulfilled");
    await flushMicrotasks();
    expect(__mocks.fireConversion).not.toHaveBeenCalled();
  });

  test("prefers order.metadata.affiliateClickId over ALS/Profile fallback", async () => {
    const order = __mocks.mockOrder({
      metadata: { competitionIds: "comp1", affiliateClickId: "order-click-123" },
    });
    __mocks.orderFindOneAndUpdate.mockResolvedValue(order);
    __mocks.getAffiliateClickId.mockReturnValue("als-click-456");

    const result = await finalizeSuccessfulOrder({
      orderId: order._id.toString(),
      userId: new Types.ObjectId().toString(),
      source: "webhook",
      logPrefix: "TEST",
    });

    expect(result).toBe("fulfilled");
    await vi.waitFor(() => {
      expect(__mocks.fireConversion).toHaveBeenCalled();
    });
    expect(__mocks.fireConversion).toHaveBeenCalledWith(
      "purchase",
      expect.objectContaining({ clickId: "order-click-123" })
    );
  });

  test("calls fireConversion('purchase') once when order.total > 0", async () => {
    const order = __mocks.mockOrder();
    __mocks.orderFindOneAndUpdate.mockResolvedValue(order);

    const result = await finalizeSuccessfulOrder({
      orderId: order._id.toString(),
      userId: new Types.ObjectId().toString(),
      source: "webhook",
      logPrefix: "TEST",
    });

    expect(result).toBe("fulfilled");
    await vi.waitFor(() => {
      expect(__mocks.fireConversion).toHaveBeenCalled();
    });
    const purchaseCalls = __mocks.fireConversion.mock.calls.filter(
      (call) => call[0] === "purchase"
    );
    expect(purchaseCalls).toHaveLength(1);
    expect(__mocks.fireConversion).toHaveBeenCalledWith(
      "purchase",
      expect.objectContaining({ amount: order.total, currency: "GBP" })
    );
  });
});
