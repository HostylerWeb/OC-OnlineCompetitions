import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { retryStuckStripeFulfillment, setCachedWebhookSecret, stripeAdapter } from "./stripe";

const __mocks = vi.hoisted(() => {
  class MockStripeError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "StripeError";
    }
  }

  function queryResult<T>(val: T) {
    return {
      lean: async () => val,
      then: (resolve: (v: T) => void) => resolve(val),
    };
  }

  return {
    __orderFindOne: vi.fn(),
    __orderFindOneAndUpdate: vi.fn(),
    __orderFindByIdAndUpdate: vi.fn(),
    __orderFindById: vi.fn(),
    __profileFindById: vi.fn(),
    __profileFind: vi.fn(),
    __finalizeSuccessfulOrder: vi.fn(),
    __verifyWebhookSignature: vi.fn(),
    __createPaymentIntent: vi.fn(),
    __cancelPaymentIntent: vi.fn(),
    __retrievePaymentIntent: vi.fn(),
    __updatePaymentIntent: vi.fn(),
    __rollbackOrderRefund: vi.fn(),
    __reserveCheckoutPromoCode: vi.fn(),
    __computeCheckoutTotal: () => 0,
    __createPendingCheckoutOrder: vi.fn(),
    __markOrderFailed: vi.fn(),
    __MockStripeError: MockStripeError,
    __queryResult: queryResult,
  };
});

__mocks.__orderFindById.mockImplementation(() => ({ lean: async () => null }));

vi.mock("@oc/api-payment-stripe", () => ({
  createStripeClient: () => ({
    createPaymentIntent: __mocks.__createPaymentIntent,
    retrievePaymentIntent: __mocks.__retrievePaymentIntent,
    cancelPaymentIntent: __mocks.__cancelPaymentIntent,
    updatePaymentIntent: __mocks.__updatePaymentIntent,
    verifyWebhookSignature: __mocks.__verifyWebhookSignature,
  }),
  resolveStripeConfig: () => ({ secretKey: "sk_test_xxx", webhookSecret: "whsec_test" }),
  StripeClient: class {},
  StripeError: __mocks.__MockStripeError,
}));

vi.mock("@oc/api-payment-core", () => ({
  getItemsFromOrder: () => [],
  rollbackOrderRefund: __mocks.__rollbackOrderRefund,
}));

vi.mock("@oc/api-tickets/create-session", () => ({
  computeCheckoutTotal: __mocks.__computeCheckoutTotal,
  createPendingCheckoutOrder: __mocks.__createPendingCheckoutOrder,
}));

vi.mock("../build-fulfillment-deps", () => ({
  reserveCheckoutPromoCode: __mocks.__reserveCheckoutPromoCode,
}));

vi.mock("../finalize-successful-order", () => ({
  finalizeSuccessfulOrder: __mocks.__finalizeSuccessfulOrder,
}));

vi.mock("@oc/api-db/models", () => ({
  Order: {
    findOne: __mocks.__orderFindOne,
    findOneAndUpdate: __mocks.__orderFindOneAndUpdate,
    findById: __mocks.__orderFindById,
    findByIdAndUpdate: __mocks.__orderFindByIdAndUpdate,
  },
  Profile: {
    findById: (id: unknown) => ({
      select: () => ({ lean: async () => __mocks.__profileFindById(id) }),
    }),
    find: (query: unknown) => ({
      select: () => ({ lean: async () => __mocks.__profileFind(query) }),
    }),
  },
}));

vi.mock("@oc/auth-admin/auth-hooks", () => ({
  canonicalizeEmail: (email: string) => email.toLowerCase().trim(),
}));

vi.mock("@oc/api-logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

vi.mock("@oc/api-infra/mongo-capabilities", () => ({
  withMongoTransactionOptional: async <T>(fn: (session?: unknown) => Promise<T>) => fn(undefined),
}));

vi.mock("../stripe-webhook-lookup", () => ({
  getStripePaymentIntentIdFromEvent: (event: { data: { object: Record<string, unknown> } }) =>
    event.data.object.id as string,
  getStripeChargeLookupIds: (event: { data: { object: Record<string, unknown> } }) => ({
    chargeId: event.data.object.id as string,
    paymentIntentId: event.data.object.payment_intent as string,
  }),
}));

vi.mock("./_shared/order-helpers", () => ({
  markOrderFailed: __mocks.__markOrderFailed,
}));

describe("stripe createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.__createPaymentIntent.mockResolvedValue({
      id: "pi_123",
      clientSecret: "cs_123",
      status: "requires_payment_method",
    });
    __mocks.__updatePaymentIntent.mockResolvedValue({
      id: "pi_123",
      status: "requires_payment_method",
    });
    __mocks.__createPendingCheckoutOrder.mockResolvedValue({ _id: new Types.ObjectId() });
    __mocks.__orderFindOne.mockReturnValue(__mocks.__queryResult(null));
    __mocks.__orderFindById.mockReturnValue({ lean: async () => null });
    __mocks.__reserveCheckoutPromoCode.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("creates session and returns redirect URL", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__createPendingCheckoutOrder.mockResolvedValue({ _id: orderId });

    const result = await stripeAdapter.createSession({
      items: [{ competitionId: "cmp_1", quantity: 2, answerIndex: 0 }],
      userId: new Types.ObjectId().toString(),
      userEmail: "test@example.com",
      subtotal: 25,
      discount: 0,
      frontendUrl: "https://example.com",
    });

    expect(result.sessionId).toBe("cs_123");
    expect(result.orderId).toBe(orderId.toString());
    expect(result.redirectUrl).toContain("provider=stripe");
    expect(result.redirectUrl).toContain("cs_123");
    expect(__mocks.__createPaymentIntent).toHaveBeenCalledTimes(1);
    expect(__mocks.__orderFindByIdAndUpdate).toHaveBeenCalledWith(expect.anything(), {
      $set: { "metadata.stripePaymentIntentId": "pi_123" },
    });
  });

  test("attaches orderId metadata to the PaymentIntent best-effort", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__createPaymentIntent.mockResolvedValue({
      id: "pi_123",
      clientSecret: "cs_123",
      status: "requires_payment_method",
      metadata: { userId: "user_1", cartId: "cart_1" },
    });
    __mocks.__createPendingCheckoutOrder.mockResolvedValue({ _id: orderId });

    await stripeAdapter.createSession({
      items: [{ competitionId: "cmp_1", quantity: 1, answerIndex: 0 }],
      userId: "user_1",
      userEmail: "test@example.com",
      subtotal: 10,
      discount: 0,
      frontendUrl: "https://example.com",
    });

    expect(__mocks.__updatePaymentIntent).toHaveBeenCalledWith({
      paymentIntentId: "pi_123",
      metadata: { userId: "user_1", cartId: "cart_1", orderId: orderId.toString() },
    });
  });

  test("voids the intent when createPendingCheckoutOrder fails", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__createPendingCheckoutOrder.mockRejectedValue(new Error("mongo down"));
    __mocks.__cancelPaymentIntent.mockResolvedValue({ id: "pi_123", status: "canceled" });

    await expect(
      stripeAdapter.createSession({
        items: [{ competitionId: "cmp_1", quantity: 1, answerIndex: 0 }],
        userId: orderId.toString(),
        userEmail: "test@example.com",
        subtotal: 10,
        discount: 0,
        frontendUrl: "https://example.com",
      })
    ).rejects.toThrow("mongo down");

    expect(__mocks.__cancelPaymentIntent).toHaveBeenCalledWith("cs_123");
  });

  test("returns existing order on idempotency key match", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__orderFindOne.mockReturnValue(
      __mocks.__queryResult({
        _id: orderId,
        providerSessionId: "cs_existing",
        status: "pending",
      })
    );

    const result = await stripeAdapter.createSession({
      items: [{ competitionId: "cmp_1", quantity: 1, answerIndex: 0 }],
      userId: new Types.ObjectId().toString(),
      userEmail: "test@example.com",
      subtotal: 10,
      discount: 0,
      frontendUrl: "https://example.com",
      idempotencyKey: "idem_123",
    });

    expect(result.sessionId).toBe("cs_existing");
    expect(__mocks.__createPaymentIntent).not.toHaveBeenCalled();
  });

  test("marks order failed and voids the intent when promo code reservation fails", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__createPendingCheckoutOrder.mockResolvedValue({ _id: orderId });
    __mocks.__orderFindByIdAndUpdate.mockResolvedValue({});
    __mocks.__cancelPaymentIntent.mockResolvedValue({ id: "pi_123", status: "canceled" });
    __mocks.__reserveCheckoutPromoCode.mockResolvedValue(false);

    await expect(
      stripeAdapter.createSession({
        items: [{ competitionId: "cmp_1", quantity: 1, answerIndex: 0 }],
        userId: new Types.ObjectId().toString(),
        userEmail: "test@example.com",
        subtotal: 10,
        discount: 0,
        promoCode: "INVALID",
        frontendUrl: "https://example.com",
      })
    ).rejects.toThrow("Promo code could not be reserved");

    expect(__mocks.__orderFindByIdAndUpdate).toHaveBeenCalledWith(orderId, {
      $set: { status: "failed" },
    });
    expect(__mocks.__cancelPaymentIntent).toHaveBeenCalledWith("cs_123");
  });
});

describe("stripe handleWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCachedWebhookSecret("whsec_test");
    __mocks.__verifyWebhookSignature.mockResolvedValue({
      id: "evt_123",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          charges: {
            data: [
              { payment_method_details: { type: "card", card: { last4: "4242", brand: "visa" } } },
            ],
          },
        },
      },
    });
    __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
    __mocks.__orderFindByIdAndUpdate.mockResolvedValue({});
    __mocks.__orderFindOneAndUpdate.mockResolvedValue({});
    __mocks.__rollbackOrderRefund.mockResolvedValue({ success: true });
    __mocks.__markOrderFailed.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("handles payment_intent.succeeded", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.__orderFindOne.mockResolvedValue({ _id: orderId, userId, status: "pending" });

    const result = await stripeAdapter.handleWebhook(
      JSON.stringify({
        id: "evt_123",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_123" } },
      }),
      "stripe_sig_abc"
    );

    expect(result.status).toBe("completed");
    expect(result.orderId).toBe(orderId.toString());
    expect(__mocks.__verifyWebhookSignature).toHaveBeenCalledTimes(1);
    expect(__mocks.__finalizeSuccessfulOrder).toHaveBeenCalledTimes(1);
  });

  test("handles payment_intent.succeeded for a failed order by claiming an auto-refund (no finalize, no throw)", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.__orderFindOne.mockResolvedValue({ _id: orderId, userId, status: "failed" });
    __mocks.__orderFindOneAndUpdate.mockResolvedValue({
      _id: orderId,
      status: "failed",
      metadata: { refundProcessedAt: new Date().toISOString() },
    });

    const result = await stripeAdapter.handleWebhook(
      JSON.stringify({
        id: "evt_123",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_123" } },
      }),
      "stripe_sig_abc"
    );

    expect(result.status).toBe("processing");
    expect(result.orderId).toBe(orderId.toString());
    expect(__mocks.__finalizeSuccessfulOrder).not.toHaveBeenCalled();
    expect(__mocks.__orderFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: orderId, "metadata.refundProcessedAt": { $exists: false } },
      expect.objectContaining({
        $set: expect.objectContaining({ "metadata.refundedVia": "stripe_failed_order_refund" }),
      }),
      expect.objectContaining({ returnDocument: "after" })
    );
    expect(__mocks.__rollbackOrderRefund).toHaveBeenCalledTimes(1);
    expect(__mocks.__orderFindByIdAndUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ $set: { status: "refunded" } })
    );
  });

  test("payment_intent.succeeded for a failed order already claimed a refund stays 200-equivalent", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.__orderFindOne.mockResolvedValue({ _id: orderId, userId, status: "failed" });
    __mocks.__orderFindOneAndUpdate.mockResolvedValue(null);

    const result = await stripeAdapter.handleWebhook(
      JSON.stringify({
        id: "evt_123",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_123" } },
      }),
      "stripe_sig_abc"
    );

    expect(result.status).toBe("processing");
    expect(__mocks.__rollbackOrderRefund).not.toHaveBeenCalled();
    expect(__mocks.__finalizeSuccessfulOrder).not.toHaveBeenCalled();
  });

  test("handles payment_intent.payment_failed", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__verifyWebhookSignature.mockResolvedValue({
      id: "evt_456",
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_456" } },
    });
    __mocks.__orderFindOne.mockResolvedValue({
      _id: orderId,
      userId: new Types.ObjectId(),
      status: "pending",
    });

    const result = await stripeAdapter.handleWebhook(
      JSON.stringify({
        id: "evt_456",
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_456" } },
      }),
      "stripe_sig_abc"
    );

    expect(result.status).toBe("failed");
    expect(__mocks.__markOrderFailed).toHaveBeenCalled();
  });

  test("handles charge.refunded", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.__verifyWebhookSignature.mockResolvedValue({
      id: "evt_789",
      type: "charge.refunded",
      data: { object: { id: "ch_789", payment_intent: "pi_789" } },
    });
    __mocks.__orderFindOne.mockResolvedValue({ _id: orderId, userId, status: "completed" });

    const result = await stripeAdapter.handleWebhook(
      JSON.stringify({
        id: "evt_789",
        type: "charge.refunded",
        data: { object: { id: "ch_789", payment_intent: "pi_789" } },
      }),
      "stripe_sig_abc"
    );

    expect(result.status).toBe("processing");
    expect(__mocks.__rollbackOrderRefund).toHaveBeenCalledTimes(1);
  });

  test("handles charge.dispute.created with a claim-style appends (no read-modify-write clobber)", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.__verifyWebhookSignature.mockResolvedValue({
      id: "evt_dc",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          payment_intent: "pi_1",
          reason: "fraudulent",
          status: "under_review",
        },
      },
    });
    __mocks.__orderFindOne.mockResolvedValue({ _id: orderId, userId, status: "completed" });

    const result = await stripeAdapter.handleWebhook(
      JSON.stringify({
        id: "evt_dc",
        type: "charge.dispute.created",
        data: {
          object: {
            id: "dp_1",
            payment_intent: "pi_1",
            reason: "fraudulent",
            status: "under_review",
          },
        },
      }),
      "stripe_sig_abc"
    );

    expect(result.status).toBe("processing");
    expect(__mocks.__orderFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: orderId, "metadata.disputes.disputeId": { $ne: "dp_1" } },
      {
        $push: {
          "metadata.disputes": {
            disputeId: "dp_1",
            chargeId: "dp_1",
            reason: "fraudulent",
            status: "under_review",
            createdAt: expect.any(String),
          },
        },
      }
    );
    expect(__mocks.__orderFindByIdAndUpdate).not.toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({
        $set: expect.objectContaining({ "metadata.disputes": expect.anything() }),
      })
    );
  });

  test("rejects invalid signature", async () => {
    __mocks.__verifyWebhookSignature.mockRejectedValue(
      new __mocks.__MockStripeError("WEBHOOK_INVALID", "Signature verification failed")
    );

    await expect(stripeAdapter.handleWebhook("{}", "bad_sig")).rejects.toThrow(
      "STRIPE_WEBHOOK_SIGNATURE_INVALID"
    );
  });

  test("throws when signature is missing", async () => {
    await expect(stripeAdapter.handleWebhook("{}", null)).rejects.toThrow(
      "STRIPE_WEBHOOK_SIGNATURE_MISSING"
    );
  });
});

describe("stripe testCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns success when API key is valid", async () => {
    __mocks.__retrievePaymentIntent.mockRejectedValue(
      new __mocks.__MockStripeError("INVALID_REQUEST", "No such payment intent")
    );

    const result = await stripeAdapter.testCredentials("sandbox");

    expect(result.success).toBe(true);
  });

  test("returns failure on auth error", async () => {
    __mocks.__retrievePaymentIntent.mockRejectedValue(
      new __mocks.__MockStripeError("AUTH_FAILED", "Invalid API key")
    );

    const result = await stripeAdapter.testCredentials("live");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid API key");
  });
});

describe("stripe voidSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.__cancelPaymentIntent.mockResolvedValue({ id: "pi_123", status: "canceled" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("cancels uncaptured intent with client secret", async () => {
    const result = await stripeAdapter.voidSession("pi_123_secret_testkey");
    expect(result.success).toBe(true);
    expect(__mocks.__cancelPaymentIntent).toHaveBeenCalledWith("pi_123");
  });

  test("cancels uncaptured intent with PI ID", async () => {
    const result = await stripeAdapter.voidSession("pi_123");
    expect(result.success).toBe(true);
    expect(__mocks.__cancelPaymentIntent).toHaveBeenCalledWith("pi_123");
  });

  test("returns error on failure", async () => {
    __mocks.__cancelPaymentIntent.mockRejectedValue(new Error("Intent already canceled"));
    const result = await stripeAdapter.voidSession("pi_123");
    expect(result.success).toBe(false);
  });
});

describe("stripe captureSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.__orderFindByIdAndUpdate.mockResolvedValue({});
    __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns the terminal status for completed orders", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__orderFindOne.mockResolvedValue({
      _id: orderId,
      userId: new Types.ObjectId(),
      status: "completed",
    });

    const result = await stripeAdapter.captureSession("cs_123_secret_x");
    expect(result.status).toBe("completed");
    expect(__mocks.__retrievePaymentIntent).not.toHaveBeenCalled();
  });

  test("finalizes from the remote intent when the DB order is pending and the intent succeeded", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.__orderFindOne.mockResolvedValue({
      _id: orderId,
      userId,
      status: "pending",
      providerSessionId: "cs_123_secret_x",
      metadata: {},
    });
    __mocks.__retrievePaymentIntent.mockResolvedValue({
      id: "pi_remote",
      clientSecret: null,
      status: "succeeded",
      amount: 1000,
      currency: "gbp",
      metadata: {},
    });

    const result = await stripeAdapter.captureSession("cs_123_secret_x");

    expect(result.status).toBe("completed");
    expect(__mocks.__retrievePaymentIntent).toHaveBeenCalledWith("cs_123");
    expect(__mocks.__finalizeSuccessfulOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: orderId.toString(),
        userId: userId.toString(),
        captureId: "cs_123",
        source: "capture",
      })
    );
  });

  test("prefers metadata.stripePaymentIntentId over the client-secret session id", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__orderFindOne.mockResolvedValue({
      _id: orderId,
      userId: new Types.ObjectId(),
      status: "pending",
      providerSessionId: "cs_123_secret_x",
      metadata: { stripePaymentIntentId: "pi_meta" },
    });
    __mocks.__retrievePaymentIntent.mockResolvedValue({
      id: "pi_meta",
      status: "requires_payment_method",
    });

    const result = await stripeAdapter.captureSession("cs_123_secret_x");

    expect(result.status).toBe("pending");
    expect(__mocks.__retrievePaymentIntent).toHaveBeenCalledWith("pi_meta");
    expect(__mocks.__finalizeSuccessfulOrder).not.toHaveBeenCalled();
  });

  test("returns pending as-is when the remote intent is not yet succeeded", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__orderFindOne.mockResolvedValue({
      _id: orderId,
      userId: new Types.ObjectId(),
      status: "pending",
      providerSessionId: "pi_123",
      metadata: {},
    });
    __mocks.__retrievePaymentIntent.mockResolvedValue({
      id: "pi_123",
      status: "requires_payment_method",
    });

    const result = await stripeAdapter.captureSession("pi_123");
    expect(result.status).toBe("pending");
    expect(__mocks.__finalizeSuccessfulOrder).not.toHaveBeenCalled();
  });

  test("tolerates remote intent failures and returns pending", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__orderFindOne.mockResolvedValue({
      _id: orderId,
      userId: new Types.ObjectId(),
      status: "pending",
      providerSessionId: "pi_123",
      metadata: {},
    });
    __mocks.__retrievePaymentIntent.mockRejectedValue(new Error("stripe down"));

    const result = await stripeAdapter.captureSession("pi_123");
    expect(result.status).toBe("pending");
    expect(__mocks.__finalizeSuccessfulOrder).not.toHaveBeenCalled();
  });

  test("throws when no order matches", async () => {
    __mocks.__orderFindOne.mockResolvedValue(null);
    await expect(stripeAdapter.captureSession("cs_unknown")).rejects.toThrow("Order not found");
  });
});

describe("stripe getSessionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns completed for completed order", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__orderFindOne.mockReturnValue(
      __mocks.__queryResult({ _id: orderId, status: "completed" })
    );

    const result = await stripeAdapter.getSessionStatus("cs_123_client_secret");

    expect(result.status).toBe("completed");
    expect(result.orderId).toBe(orderId.toString());
    expect(__mocks.__orderFindOne).toHaveBeenCalledWith({
      $or: [
        { providerSessionId: "cs_123_client_secret" },
        { "metadata.stripePaymentIntentId": "cs_123_client_secret" },
      ],
    });
  });

  test("returns failed when order not found", async () => {
    __mocks.__orderFindOne.mockReturnValue(__mocks.__queryResult(null));

    const result = await stripeAdapter.getSessionStatus("cs_unknown");
    expect(result.status).toBe("failed");
    expect(result.orderId).toBeUndefined();
  });

  test("resolves a guest's order via checkout email inheritance", async () => {
    const orderId = new Types.ObjectId();
    const orderUserId = new Types.ObjectId();
    __mocks.__profileFindById.mockResolvedValue({
      _id: new Types.ObjectId(),
      email: "Person@Example.com",
    });
    __mocks.__profileFind.mockResolvedValue([
      { _id: orderUserId },
    ]);
    __mocks.__orderFindOne.mockReturnValue(
      __mocks.__queryResult({ _id: orderId, status: "completed" })
    );

    const sessionUserId = new Types.ObjectId().toString();
    const result = await stripeAdapter.getSessionStatus("cs_123_client_secret", sessionUserId);

    expect(result.status).toBe("completed");
    expect(result.orderId).toBe(orderId.toString());

    const query = __mocks.__orderFindOne.mock.calls[0]![0] as Record<string, unknown>;
    const serialized = JSON.stringify(query);
    expect(serialized).toContain("orderEmail");
    expect(serialized).toContain(sessionUserId);
    expect(serialized).toContain(orderUserId.toString());
    expect(serialized).toContain("person@example.com");
    expect(Types.ObjectId.isValid(sessionUserId)).toBe(true);
  });

  test("falls back to client-secret possession when the order is not visible to the session user", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__profileFindById.mockResolvedValue({
      _id: new Types.ObjectId(),
      email: "guest-abc123@guest.onlinecompetitions.local",
    });
    __mocks.__profileFind.mockResolvedValue([]);
    __mocks.__orderFindOne
      .mockReturnValueOnce(__mocks.__queryResult(null))
      .mockReturnValueOnce(
        __mocks.__queryResult({ _id: orderId, status: "completed" })
      );
    __mocks.__retrievePaymentIntent.mockResolvedValue({
      id: "pi_123",
      amount: 1000,
      currency: "gbp",
      status: "succeeded",
      metadata: {},
    });

    const sessionUserId = new Types.ObjectId().toString();
    const result = await stripeAdapter.getSessionStatus("pi_123_secret_abc", sessionUserId);

    expect(result.status).toBe("completed");
    expect(result.orderId).toBe(orderId.toString());
    expect(__mocks.__retrievePaymentIntent).toHaveBeenCalledWith("pi_123");
  });

  test("does not expose an unowned order when the remote intent did not succeed", async () => {
    __mocks.__profileFindById.mockResolvedValue({
      _id: new Types.ObjectId(),
      email: "guest-abc123@guest.onlinecompetitions.local",
    });
    __mocks.__profileFind.mockResolvedValue([]);
    __mocks.__orderFindOne
      .mockReturnValueOnce(__mocks.__queryResult(null))
      .mockReturnValueOnce(
        __mocks.__queryResult({ _id: new Types.ObjectId(), status: "completed" })
      );
    __mocks.__retrievePaymentIntent.mockResolvedValue({
      id: "pi_123",
      amount: 1000,
      currency: "gbp",
      status: "requires_payment_method",
      metadata: {},
    });

    const sessionUserId = new Types.ObjectId().toString();
    const result = await stripeAdapter.getSessionStatus("pi_123_secret_abc", sessionUserId);

    expect(result.status).toBe("failed");
    expect(result.orderId).toBeUndefined();
  });
});

describe("retryStuckStripeFulfillment", () => {
  beforeEach(() => {
    __mocks.__orderFindById.mockReturnValue({ lean: async () => null });
    __mocks.__orderFindByIdAndUpdate.mockReset();
    __mocks.__finalizeSuccessfulOrder.mockReset();
    __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns 'skipped' if order not found", async () => {
    __mocks.__orderFindById.mockReturnValue({ lean: async () => null });

    const result = await retryStuckStripeFulfillment(
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString()
    );
    expect(result).toBe("skipped");
  });

  test("returns 'skipped' if order.status is not 'processing'", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__orderFindById.mockReturnValue({
      lean: async () => ({
        _id: orderId,
        status: "completed",
        providerSessionId: "pi_123",
      }),
    });

    const result = await retryStuckStripeFulfillment(orderId.toString(), orderId.toString());
    expect(result).toBe("skipped");
  });

  test("returns 'in-progress' if fulfillment lock has not expired", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const lockExpiresAt = new Date(Date.now() + 60_000);
    __mocks.__orderFindById.mockReturnValue({
      lean: async () => ({
        _id: orderId,
        userId,
        status: "processing",
        providerSessionId: "pi_locked",
        metadata: { fulfillmentLock: { expiresAt: lockExpiresAt } },
      }),
    });

    const result = await retryStuckStripeFulfillment(orderId.toString(), userId.toString());
    expect(result).toBe("in-progress");
  });

  test("returns 'fulfilled' when resolveCaptureId reads from metadata.stripePaymentIntentId", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
    __mocks.__orderFindById.mockReturnValue({
      lean: async () => ({
        _id: orderId,
        userId,
        status: "processing",
        providerSessionId: "pi_flow_ready",
        metadata: { stripePaymentIntentId: "pi_123" },
      }),
    });

    const result = await retryStuckStripeFulfillment(orderId.toString(), userId.toString());
    expect(result).toBe("fulfilled");
    expect(__mocks.__finalizeSuccessfulOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: orderId.toString(),
        captureId: "pi_123",
        source: "capture",
      })
    );
  });
});
