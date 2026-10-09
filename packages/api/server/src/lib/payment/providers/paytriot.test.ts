import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { paytriotAdapter, retryStuckPaytriotFulfillment } from "./paytriot";

const __paytriotMocks = vi.hoisted(() => ({
  Gateway: vi.fn(function MockGateway() {
    return {
      hostedRequest: vi.fn(
        () =>
          '<form method="post" action="https://gateway.paytriot.co.uk/paymentform/"><input type="hidden" name="merchantID" value="123456" /><input type="submit" value="Pay Now" /></form>'
      ),
    };
  }),
  sign: vi.fn(
    () =>
      "test_sig_128_chars_0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
  ),
  verifyResponse: vi.fn(() => true),
  httpParseQuery: vi.fn((str: string) => {
    const params = new URLSearchParams(str);
    const obj: Record<string, unknown> = {};
    for (const [k, v] of params) {
      obj[k] = v;
    }
    return obj;
  }),
  classifyPaytriotError: vi.fn((code: number, msg?: string) => {
    if (code === 0) return { code: "SUCCESS", userMessage: "Success" };
    return { code: "CARD_DECLINED", userMessage: msg ?? "Card was declined" };
  }),
  getPaytriotErrorInfo: vi.fn((input: { responseCode: number; responseMessage?: string }) => {
    const code = input.responseCode;
    const cat =
      (
        {
          0: "SUCCESS",
          2: "CARD_REFERRED",
          4: "CARD_DECLINED_KEEP",
          65539: "INVALID_CREDENTIALS",
        } as Record<number, string>
      )[code] ?? "CARD_DECLINED";
    const title =
      cat === "SUCCESS"
        ? "Payment successful"
        : cat === "CARD_REFERRED"
          ? "Card referred"
          : cat === "CARD_DECLINED_KEEP"
            ? "Card declined — keep card"
            : "Card declined";
    const msg =
      cat === "SUCCESS"
        ? "Your payment was successful."
        : (input.responseMessage ?? "Card was declined");
    return {
      category: cat,
      responseCode: code,
      responseMessage: input.responseMessage,
      title,
      description: msg,
      recommendedAction: cat === "SUCCESS" ? "retry" : "contact_bank",
      wasCharged: false,
      severity: code === 0 ? "info" : "error",
      isConfigError: code === 65539 || code === 66343 || code === 65566,
    };
  }),
  PAYTRIOT_CURRENCY: "GBP",
  PAYTRIOT_HOSTED_URL: "https://gateway.paytriot.co.uk/paymentform/",
  PAYTRIOT_NUMERIC_CURRENCIES: { GBP: 826 },
}));

const __envMocks = vi.hoisted(() => ({
  getEnv: vi.fn((key: string) => {
    const env: Record<string, string> = {
      PAYTRIOT_MERCHANT_ID: "123456",
      PAYTRIOT_MERCHANT_SECRET: "test_secret",
      PAYTRIOT_ENVIRONMENT: "sandbox",
      PAYTRIOT_STATEMENT_NARRATIVE_1: "Online Competitions*Test",
      PAYTRIOT_STATEMENT_NARRATIVE_2: "02000000000",
      PAYTRIOT_CURRENCY: "GBP",
    };
    return env[key] ?? "";
  }),
}));

const __mocks = vi.hoisted(() => ({
  __finalizeSuccessfulOrder: vi.fn(async () => "already-finalized" as const),
  __computeCheckoutTotal: vi.fn((subtotal: number, discount: number) => subtotal - discount),
  __createPendingCheckoutOrder: vi.fn(),
  __reserveCheckoutPromoCode: vi.fn(async (_code: string, _userId: string) => true),
  __findOne: vi.fn(() => ({
    select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
    lean: vi.fn().mockResolvedValue(null),
  })),
  __findById: vi.fn().mockResolvedValue(null),
  __findByIdAndUpdate: vi.fn(),
  __findOneAndUpdate: vi.fn(),
  __orderDeleteOne: vi.fn(() => Promise.resolve({ deletedCount: 1 })),
  __markOrderFailed: vi.fn(),
  __storePendingWebhook: vi.fn(),
  __releasePromoCodeUsage: vi.fn(async () => null),
  __PaymentAttempt: vi.fn(function MockPaymentAttempt(
    this: Record<string, unknown>,
    data: Record<string, unknown>
  ) {
    this._id = new Types.ObjectId();
    Object.assign(this, data);
    this.save = vi.fn().mockResolvedValue(undefined);
    this.updateOne = vi.fn().mockResolvedValue(undefined);
  }),
  __paymentAttemptCount: vi.fn().mockResolvedValue(0),
  __paymentAttemptFindOne: vi.fn(() => ({
    sort: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(null),
    })),
  })),
}));

vi.mock("../finalize-successful-order", () => ({
  finalizeSuccessfulOrder: __mocks.__finalizeSuccessfulOrder,
}));

vi.mock("../build-fulfillment-deps", () => ({
  reserveCheckoutPromoCode: __mocks.__reserveCheckoutPromoCode,
}));

vi.mock("@oc/api-tickets/create-session", () => ({
  computeCheckoutTotal: __mocks.__computeCheckoutTotal,
  createPendingCheckoutOrder: __mocks.__createPendingCheckoutOrder,
}));

vi.mock("@oc/api-tickets/promo-codes", () => ({
  releasePromoCodeUsage: __mocks.__releasePromoCodeUsage,
}));

vi.mock("@oc/api-db/models", () => ({
  Competition: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue([
          {
            _id: "000000000000000000000001",
            status: "active",
            ticketsSold: 0,
            maxTickets: 1000,
            title: "Test Competition",
          } as const,
          {
            _id: "000000000000000000000002",
            status: "active",
            ticketsSold: 0,
            maxTickets: 1000,
            title: "Test Competition 2",
          } as const,
        ]),
      })),
    })),
  },
  Order: {
    findOne: __mocks.__findOne,
    findById: __mocks.__findById,
    findByIdAndUpdate: __mocks.__findByIdAndUpdate,
    findOneAndUpdate: __mocks.__findOneAndUpdate,
    deleteOne: __mocks.__orderDeleteOne,
  },
  PaymentAttempt: Object.assign(__mocks.__PaymentAttempt, {
    countDocuments: __mocks.__paymentAttemptCount,
    findOne: __mocks.__paymentAttemptFindOne,
  }),
  PromoCode: {
    findOne: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(null),
    })),
  },
}));

vi.mock("@oc/api-payment-paytriot", () => ({
  Gateway: __paytriotMocks.Gateway,
  sign: __paytriotMocks.sign,
  verifyResponse: __paytriotMocks.verifyResponse,
  httpParseQuery: __paytriotMocks.httpParseQuery,
  classifyPaytriotError: __paytriotMocks.classifyPaytriotError,
  getPaytriotErrorInfo: __paytriotMocks.getPaytriotErrorInfo,
  sanitizeUserMessage: vi.fn((msg) => msg),
  PAYTRIOT_CURRENCY: __paytriotMocks.PAYTRIOT_CURRENCY,
  PAYTRIOT_HOSTED_URL: __paytriotMocks.PAYTRIOT_HOSTED_URL,
  PAYTRIOT_NUMERIC_CURRENCIES: __paytriotMocks.PAYTRIOT_NUMERIC_CURRENCIES,
}));

vi.mock("@oc/env/server", () => ({
  getEnv: __envMocks.getEnv,
  getBool: (key: string, defaultVal?: boolean) => {
    if (key === "PAYTRIOT_LENIENT_RESPONSE_SIGNATURE") return false;
    return defaultVal ?? false;
  },
}));

vi.mock("@oc/api-logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    error: () => {},
  }),
}));

vi.mock("./_shared/order-helpers", () => ({
  markOrderFailed: __mocks.__markOrderFailed,
}));

vi.mock("./_shared/pending-webhooks", () => ({
  storePendingWebhook: __mocks.__storePendingWebhook,
}));

describe("paytriotAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.__finalizeSuccessfulOrder.mockReset();
    __mocks.__finalizeSuccessfulOrder.mockResolvedValue("already-finalized" as const);
    __mocks.__computeCheckoutTotal.mockReset();
    __mocks.__computeCheckoutTotal.mockImplementation(
      (subtotal: number, discount: number) => subtotal - discount
    );
    __mocks.__createPendingCheckoutOrder.mockReset();
    __mocks.__findOne.mockReset();
    __mocks.__findOne.mockImplementation(() => ({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
      lean: vi.fn().mockResolvedValue(null),
    }));
    __mocks.__findById.mockReset();
    __mocks.__findById.mockResolvedValue(null);
    __mocks.__findByIdAndUpdate.mockReset();
    __mocks.__findOneAndUpdate.mockReset();
    __mocks.__findOneAndUpdate.mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    }));
    __mocks.__releasePromoCodeUsage.mockReset();
    __mocks.__releasePromoCodeUsage.mockResolvedValue(null);
    __mocks.__orderDeleteOne.mockReset();
    __mocks.__markOrderFailed.mockReset();
    __mocks.__storePendingWebhook.mockReset();
    __envMocks.getEnv.mockImplementation((key: string) => {
      const env: Record<string, string> = {
        PAYTRIOT_MERCHANT_ID: "123456",
        PAYTRIOT_MERCHANT_SECRET: "test_secret",
        PAYTRIOT_ENVIRONMENT: "sandbox",
        PAYTRIOT_STATEMENT_NARRATIVE_1: "Online Competitions*Test",
        PAYTRIOT_STATEMENT_NARRATIVE_2: "02000000000",
        PAYTRIOT_CURRENCY: "GBP",
      };
      return env[key] ?? "";
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    const baseParams = {
      userId: new Types.ObjectId().toString(),
      userEmail: "test@example.com",
      items: [{ competitionId: "comp1", quantity: 1, answerIndex: 0 }],
      subtotal: 1000,
      discount: 0,
      frontendUrl: "https://example.com",
    };

    test("builds correct payload with statement narratives", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__createPendingCheckoutOrder.mockResolvedValue({
        _id: orderId,
        orderNumber: "INV-001",
        toString: () => orderId.toString(),
      });

      const result = await paytriotAdapter.createSession(baseParams);

      expect(__paytriotMocks.Gateway).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantID: "123456",
          merchantSecret: "test_secret",
        })
      );

      expect(result.sessionId).toContain("paytriot_");
      expect(result.orderId).toBe(orderId.toString());
      expect(result.formHtml).toBeDefined();
      expect(result.formHtml).toContain("gateway.paytriot.co.uk");
    });

    test("returns formHtml (not success URL)", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__createPendingCheckoutOrder.mockResolvedValue({
        _id: orderId,
        orderNumber: "INV-REDIRECT",
        toString: () => orderId.toString(),
      });

      const result = await paytriotAdapter.createSession(baseParams);

      expect(result.formHtml).toBeDefined();
      expect(result.formHtml).toContain("gateway.paytriot.co.uk");
      expect(result.formHtml).not.toContain("/checkout/success");
    });

    test("returns the stored formHtml when an existing order has a usable payload", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: orderId,
          providerSessionId: "paytriot_existing",
          status: "failed",
          total: 1000,
          orderNumber: "INV-EXISTING",
          metadata: { paytriotFormHtml: "<form>existing</form>" },
        }),
      }));

      const result = await paytriotAdapter.createSession({
        ...baseParams,
        idempotencyKey: "dup-key",
      });

      expect(result.sessionId).toBe("paytriot_existing");
      expect(result.orderId).toBe(orderId.toString());
      expect(result.formHtml).toBe("<form>existing</form>");
      expect(__mocks.__createPendingCheckoutOrder).not.toHaveBeenCalled();
    });

    test("regenerates the session when the existing order has no stored payload", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: orderId,
          providerSessionId: "paytriot_stale",
          status: "failed",
          orderNumber: "INV-STALE",
          metadata: {},
        }),
      }));

      const result = await paytriotAdapter.createSession({
        ...baseParams,
        idempotencyKey: "dup-key",
      });

      expect(result.sessionId).toContain(orderId.toString());
      expect(result.sessionId).not.toBe("paytriot_stale");
      expect(result.formHtml).toBeDefined();
      expect(__mocks.__createPendingCheckoutOrder).not.toHaveBeenCalled();
    });

    test("reuses a recently claimed session with matching financials (double-charge guard)", async () => {
      const orderId = new Types.ObjectId();
      const claimedSession = `${orderId.toString()}-abcdef12`;
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: orderId,
          providerSessionId: claimedSession,
          status: "pending",
          orderNumber: "INV-CLAIM",
          subtotal: 1000,
          total: 1000,
          metadata: {
            paytriotFormHtml: "<form>claimed</form>",
            paytriotSessionClaim: claimedSession,
            paytriotSessionClaimAt: new Date(Date.now() - 60_000),
          },
        }),
      }));

      const result = await paytriotAdapter.createSession({
        ...baseParams,
        idempotencyKey: "dup-key",
      });

      // Same sessionId/transactionUnique reused → webhook body-hash dedup
      // protects against a double charge for concurrent tabs.
      expect(result.sessionId).toBe(claimedSession);
      expect(result.formHtml).toBe("<form>claimed</form>");
      expect(__mocks.__findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("regenerates with a fresh session after the claim window expires", async () => {
      const orderId = new Types.ObjectId();
      const staleSession = `${orderId.toString()}-stale1234`;
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: orderId,
          providerSessionId: staleSession,
          status: "pending",
          orderNumber: "INV-STALECLAIM",
          subtotal: 1000,
          total: 1000,
          metadata: {
            paytriotFormHtml: "<form>old</form>",
            paytriotSessionClaim: staleSession,
            paytriotSessionClaimAt: new Date(Date.now() - 20 * 60 * 1000),
          },
        }),
      }));

      const result = await paytriotAdapter.createSession({
        ...baseParams,
        idempotencyKey: "dup-key",
      });

      expect(result.sessionId).not.toBe(staleSession);
      expect(result.sessionId).toContain(orderId.toString());
      expect(__mocks.__findOneAndUpdate).toHaveBeenCalled();
    });

    test("releases the old promo reservation when the promo changes on regeneration", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: orderId,
          providerSessionId: "paytriot_stale",
          status: "failed",
          orderNumber: "INV-PROMO",
          metadata: { promoCode: "OLD" },
        }),
      }));

      const result = await paytriotAdapter.createSession({
        ...baseParams,
        idempotencyKey: "dup-key",
        promoCode: "NEW",
      });

      expect(__mocks.__releasePromoCodeUsage).toHaveBeenCalledWith("OLD", baseParams.userId);
      expect(__mocks.__reserveCheckoutPromoCode).toHaveBeenCalledWith("NEW", baseParams.userId);
      expect(result.sessionId).toContain(orderId.toString());
    });

    test("re-runs promo reservation when regenerating an order that never reached the gateway", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: orderId,
          providerSessionId: "paytriot_stale",
          status: "failed",
          orderNumber: "INV-RESERVE",
          metadata: { promoCode: "OLD" },
        }),
      }));
      __mocks.__reserveCheckoutPromoCode.mockResolvedValue(false);

      await expect(
        paytriotAdapter.createSession({
          ...baseParams,
          idempotencyKey: "dup-key",
          promoCode: "NEW",
        })
      ).rejects.toThrow("Promo code could not be reserved");
      expect(__mocks.__findByIdAndUpdate).toHaveBeenCalledWith(orderId, {
        $set: { status: "failed" },
      });
    });

    test("includes customer details when shipping address is provided", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__createPendingCheckoutOrder.mockResolvedValue({
        _id: orderId,
        orderNumber: "INV-002",
        toString: () => orderId.toString(),
      });

      await paytriotAdapter.createSession({
        ...baseParams,
        firstName: "John",
        lastName: "Doe",
        shippingAddress: {
          addressLine1: "123 Main St",
          postcode: "SW1A 1AA",
          city: "London",
        },
      });

      const gatewayInstance = __paytriotMocks.Gateway.mock.results[0]?.value;
      const hostedRequestCall = gatewayInstance.hostedRequest.mock.calls[0]?.[0];
      expect(hostedRequestCall.customerName).toBe("John Doe");
      expect(hostedRequestCall.customerAddress).toBe("123 Main St");
      expect(hostedRequestCall.customerPostCode).toBe("SW1A 1AA");
      expect(hostedRequestCall.customerTown).toBe("London");
      expect(hostedRequestCall.customerCountryCode).toBe("826");
    });

    test("converts pounds to pence with * 100 for amount", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__computeCheckoutTotal.mockReturnValue(1500);
      __mocks.__createPendingCheckoutOrder.mockResolvedValue({
        _id: orderId,
        orderNumber: "INV-003",
        toString: () => orderId.toString(),
      });

      await paytriotAdapter.createSession(baseParams);

      const gatewayInstance = __paytriotMocks.Gateway.mock.results[0]?.value;
      const hostedRequestCall = gatewayInstance.hostedRequest.mock.calls[0]?.[0];
      expect(hostedRequestCall.amount).toBe(150000);
      expect(hostedRequestCall.currencyCode).toBe(826);
    });

    test("promo code failure deletes the just-created order and surfaces the error", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__createPendingCheckoutOrder.mockResolvedValue({
        _id: orderId,
        orderNumber: "INV-004",
        toString: () => orderId.toString(),
      });
      __mocks.__reserveCheckoutPromoCode.mockResolvedValue(false);

      await expect(
        paytriotAdapter.createSession({
          ...baseParams,
          promoCode: "INVALID",
        })
      ).rejects.toThrow("Promo code could not be reserved");
      expect(__mocks.__orderDeleteOne).toHaveBeenCalledWith({ _id: orderId });
    });

    test("converts pounds to pence (* 100) for Paytriot amount", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__computeCheckoutTotal.mockReturnValue(1203);
      __mocks.__createPendingCheckoutOrder.mockResolvedValue({
        _id: orderId,
        orderNumber: "INV-005",
        toString: () => orderId.toString(),
      });

      await paytriotAdapter.createSession(baseParams);

      const gatewayInstance = __paytriotMocks.Gateway.mock.results[0]?.value;
      const hostedRequestCall = gatewayInstance.hostedRequest.mock.calls[0]?.[0];
      expect(hostedRequestCall.amount).toBe(120300);
    });

    test("includes customerPostCode (capital C) in request fields", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__createPendingCheckoutOrder.mockResolvedValue({
        _id: orderId,
        orderNumber: "INV-006",
        toString: () => orderId.toString(),
      });

      await paytriotAdapter.createSession({
        ...baseParams,
        firstName: "Jane",
        lastName: "Smith",
        shippingAddress: {
          addressLine1: "456 High St",
          postcode: "EC1A 1BB",
          city: "London",
        },
      });

      const gatewayInstance = __paytriotMocks.Gateway.mock.results[0]?.value;
      const hostedRequestCall = gatewayInstance.hostedRequest.mock.calls[0]?.[0];
      expect(hostedRequestCall.customerPostCode).toBe("EC1A 1BB");
    });
  });

  describe("handleWebhook", () => {
    test("verifies signature", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_1",
      });

      const body =
        "responseCode=0&transactionUnique=" +
        orderId.toString() +
        "-abc12345&transactionID=txn_123&signature=abc";

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "0",
        amountReceived: 1000,
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_123",
        signature: "abc",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      const result = await paytriotAdapter.handleWebhook(body, null);

      expect(result.status).toBe("completed");
      expect(result.eventType).toBe("PAYTRIOT.PAYMENT.SUCCESS");
    });

    test("succeeds with responseCode 0", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
      __mocks.__findById.mockImplementation(async (id: string) => {
        if (id === orderId.toString()) {
          return {
            _id: orderId,
            userId,
            total: 10,
            status: "pending",
            providerSessionId: "paytriot_sess_2",
          };
        }
        return null;
      });

      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "0",
        amountReceived: 1000,
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_456",
        signature: "abc",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      const result = await paytriotAdapter.handleWebhook(
        "responseCode=0&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_456&signature=abc",
        null
      );

      expect(result.status).toBe("completed");
      expect(result.orderId).toBe(orderId.toString());
      expect(__mocks.__finalizeSuccessfulOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: orderId.toString(),
          captureId: "txn_456",
          logPrefix: "Paytriot",
        })
      );
    });

    test("fails with bad responseCode", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__findById.mockImplementation(async (id: string) => {
        if (id === orderId.toString()) {
          return {
            _id: orderId,
            userId,
            total: 10,
            status: "pending",
            providerSessionId: "paytriot_sess_3",
            metadata: { promoCode: "test_code" },
          };
        }
        return null;
      });

      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "5",
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_789",
        signature: "abc",
      });

      const result = await paytriotAdapter.handleWebhook(
        "responseCode=5&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_789&signature=abc",
        null
      );

      expect(result.status).toBe("failed");
      expect(result.eventType).toBe("PAYTRIOT.PAYMENT.FAILED");
    });

    test("persists metadata.paytriotTransactionId on success", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_txnid",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "0",
        amountReceived: 1000,
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_123",
        signature: "abc",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      await paytriotAdapter.handleWebhook(
        "responseCode=0&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_123&signature=abc",
        null
      );

      const updateCall = __mocks.__findByIdAndUpdate.mock.calls.find(
        ([id, opts]) =>
          id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[1].$set["metadata.paytriotTransactionId"]).toBe("txn_123");
    });

    test("persists metadata.paytriotError on failure", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_fail",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "5",
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_789",
        signature: "abc",
      });
      __paytriotMocks.classifyPaytriotError.mockReturnValue({
        code: "CARD_DECLINED",
        userMessage: "Card was declined",
      });

      await paytriotAdapter.handleWebhook(
        "responseCode=5&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_789&signature=abc",
        null
      );

      expect(__mocks.__markOrderFailed).toHaveBeenCalled();

      const updateCall = __mocks.__findByIdAndUpdate.mock.calls.find(
        ([id, opts]) =>
          id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
      );
      expect(updateCall[1].$set["metadata.paytriotErrorCategory"]).toBe("CARD_DECLINED");
      expect(updateCall[1].$set["metadata.paytriotErrorTitle"]).toBe("Card declined");
      expect(updateCall[1].$set["metadata.paytriotErrorUserMessage"]).toBe("Card was declined");
      expect(updateCall[1].$set["metadata.paytriotErrorWasCharged"]).toBe(false);
    });

    test("persists AVS fields when present in response", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_avs",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "0",
        amountReceived: 1000,
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_avs",
        signature: "abc",
        avscv2Enabled: "true",
        avscv2ResponseCode: "ALL_MATCH",
        avscv2ResponseMessage: "All checks passed",
        cv2Check: "PASSED",
        addressCheck: "PASSED",
        postcodeCheck: "PASSED",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      await paytriotAdapter.handleWebhook(
        "responseCode=0&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_avs&signature=abc",
        null
      );

      const updateCall = __mocks.__findByIdAndUpdate.mock.calls.find(
        ([id, opts]) =>
          id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
      );
      expect(updateCall[1].$set["metadata.paytriotAvs"]).toEqual({
        enabled: "true",
        code: "ALL_MATCH",
        message: "All checks passed",
        cv2Check: "PASSED",
        addressCheck: "PASSED",
        postcodeCheck: "PASSED",
      });
    });

    test("persists 3DS fields when present", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_3ds",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "0",
        amountReceived: 1000,
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_3ds",
        signature: "abc",
        threeDSEnabled: "true",
        threeDSEnrolled: "Y",
        threeDSAuthenticated: "Y",
        threeDSECI: "05",
        threeDSCAVV: "AAABBBCCC",
        threeDSXID: "XID_123",
        threeDSCAVVAlgorithm: "3",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      await paytriotAdapter.handleWebhook(
        "responseCode=0&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_3ds&signature=abc",
        null
      );

      const updateCall = __mocks.__findByIdAndUpdate.mock.calls.find(
        ([id, opts]) =>
          id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
      );
      expect(updateCall[1].$set["metadata.paytriotThreeDS"]).toEqual({
        enabled: "true",
        enrolled: "Y",
        authenticated: "Y",
        xid: "XID_123",
        cavv: "AAABBBCCC",
        eci: "05",
        cavvAlgorithm: "3",
      });
    });

    test("persists card fields when present", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_card",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "0",
        amountReceived: 1000,
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_card",
        signature: "abc",
        cardNumberMask: "************1111",
        cardType: "VISA CREDIT",
        cardTypeCode: "V",
        cardScheme: "Visa",
        cardSchemeCode: "V",
        cardIssuer: "Test Bank",
        cardIssuerCountry: "GBR",
        cardIssuerCountryCode: 826,
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      await paytriotAdapter.handleWebhook(
        "responseCode=0&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_card&signature=abc",
        null
      );

      const updateCall = __mocks.__findByIdAndUpdate.mock.calls.find(
        ([id, opts]) =>
          id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
      );
      expect(updateCall[1].$set["metadata.paytriotCard"]).toEqual({
        type: "VISA CREDIT",
        typeCode: "V",
        scheme: "Visa",
        schemeCode: "V",
        masked: "************1111",
        issuer: "Test Bank",
        issuerCountry: "GBR",
        issuerCountryCode: 826,
      });
    });

    test("persists paytriotXref when xref returned", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_xref",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "0",
        amountReceived: 1000,
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_xref",
        xref: "XREF_ABC_123",
        signature: "abc",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      await paytriotAdapter.handleWebhook(
        "responseCode=0&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_xref&signature=abc",
        null
      );

      const updateCall = __mocks.__findByIdAndUpdate.mock.calls.find(
        ([id, opts]) =>
          id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
      );
      expect(updateCall[1].$set["metadata.paytriotXref"]).toBe("XREF_ABC_123");
    });

    test("calls markOrderFailed on responseCode 2 (referred)", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_referred",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "2",
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_ref",
        signature: "abc",
      });
      __paytriotMocks.classifyPaytriotError.mockReturnValue({
        code: "CARD_REFERRED",
        userMessage: "Card was referred",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      await paytriotAdapter.handleWebhook(
        "responseCode=2&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_ref&signature=abc",
        null
      );

      expect(__mocks.__markOrderFailed).toHaveBeenCalled();

      const updateCall = __mocks.__findByIdAndUpdate.mock.calls.find(
        ([id, opts]) =>
          id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
      );
      expect(updateCall[1].$set["metadata.paytriotErrorCategory"]).toBe("CARD_REFERRED");
    });

    test("calls markOrderFailed on responseCode 4 (declined keep card)", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_declkeep",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "4",
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_declkeep",
        signature: "abc",
      });
      __paytriotMocks.classifyPaytriotError.mockReturnValue({
        code: "CARD_DECLINED_KEEP",
        userMessage: "Card declined, keep card",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      await paytriotAdapter.handleWebhook(
        "responseCode=4&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_declkeep&signature=abc",
        null
      );

      expect(__mocks.__markOrderFailed).toHaveBeenCalled();
      expect(
        __mocks.__findByIdAndUpdate.mock.calls.find(
          ([id, opts]) =>
            id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
        )[1].$set["metadata.paytriotErrorCategory"]
      ).toBe("CARD_DECLINED_KEEP");
    });

    test("persists error for responseCode 65539 (invalid creds)", async () => {
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      __mocks.__findById.mockResolvedValue({
        _id: orderId,
        userId,
        total: 10,
        status: "pending",
        providerSessionId: "paytriot_sess_invcreds",
        metadata: {},
      });

      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "65539",
        transactionUnique: `${orderId.toString()}-abc12345`,
        transactionID: "txn_invcreds",
        signature: "abc",
      });
      __paytriotMocks.classifyPaytriotError.mockReturnValue({
        code: "INVALID_CREDENTIALS",
        userMessage: "Invalid credentials",
      });

      __mocks.__findByIdAndUpdate.mockResolvedValue(undefined);

      await paytriotAdapter.handleWebhook(
        "responseCode=65539&transactionUnique=" +
          orderId.toString() +
          "-abc12345&transactionID=txn_invcreds&signature=abc",
        null
      );

      const updateCall = __mocks.__findByIdAndUpdate.mock.calls.find(
        ([id, opts]) =>
          id.toString() === orderId.toString() && opts.$set?.["metadata.paytriotReceivedAt"]
      );
      expect(updateCall[1].$set["metadata.paytriotErrorCategory"]).toBe("INVALID_CREDENTIALS");
    });

    test("stores PendingWebhook when orderId not parseable", async () => {
      __paytriotMocks.verifyResponse.mockReturnValue(true);
      __paytriotMocks.httpParseQuery.mockReturnValue({
        responseCode: "0",
        amountReceived: 1000,
        transactionUnique: "",
        transactionID: "txn_stray",
        signature: "abc",
      });

      const result = await paytriotAdapter.handleWebhook(
        "responseCode=0&transactionUnique=&transactionID=txn_stray&signature=abc",
        null
      );

      expect(result.status).toBe("failed");
      expect(result.eventType).toBe("PAYTRIOT.ORDER_NOT_FOUND");
      expect(__mocks.__storePendingWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "paytriot",
          orderId: null,
          eventId: "txn_stray",
        })
      );
    });
  });

  describe("getSessionStatus", () => {
    test("looks up by _id when input is a 24-char hex string", async () => {
      const orderId = new Types.ObjectId();
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: orderId,
          status: "completed",
          providerSessionId: `paytriot_${orderId.toString()}`,
        }),
      }));

      const result = await paytriotAdapter.getSessionStatus(orderId.toString());

      const query = __mocks.__findOne.mock.calls[0]?.[0];
      expect(query.$or).toHaveLength(3);
      expect(query.$or[0]).toEqual({ providerSessionId: orderId.toString() });
      expect(query.$or[1]).toEqual({ transactionUnique: orderId.toString() });
      expect(query.$or[2]._id).toBeDefined();
      expect(result.status).toBe("completed");
      expect(result.orderId).toBe(orderId.toString());
    });

    test("looks up by providerSessionId when input is not a 24-char hex", async () => {
      const sessionId = "paytriot_abc123";
      const orderId = new Types.ObjectId();
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: orderId,
          status: "pending",
          providerSessionId: sessionId,
        }),
      }));

      const result = await paytriotAdapter.getSessionStatus(sessionId);

      const query = __mocks.__findOne.mock.calls[0]?.[0];
      expect(query.$or).toHaveLength(2);
      expect(query.$or[0]).toEqual({ providerSessionId: sessionId });
      expect(query.$or[1]).toEqual({ transactionUnique: sessionId });
      expect(result.status).toBe("pending");
    });

    test("returns status: failed when no order matches", async () => {
      __mocks.__findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue(null),
      }));

      const result = await paytriotAdapter.getSessionStatus("nonexistent_session");

      expect(result.status).toBe("failed");
      expect(result.orderId).toBeUndefined();
    });
  });

  describe("testCredentials", () => {
    test("validates merchant ID format (6 digits)", async () => {
      __envMocks.getEnv.mockImplementation((key: string) => {
        if (key === "PAYTRIOT_MERCHANT_ID") return "abc";
        if (key === "PAYTRIOT_MERCHANT_SECRET") return "secret";
        return "";
      });

      const result = await paytriotAdapter.testCredentials("sandbox");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Paytriot merchant ID must be 6 digits");
    });

    test("succeeds with valid merchant ID", async () => {
      const result = await paytriotAdapter.testCredentials("sandbox");
      expect(result.success).toBe(true);
    });

    test("accepts override merchant ID and secret", async () => {
      const result = await paytriotAdapter.testCredentials("live", "654321", "override_secret");
      expect(result.success).toBe(true);
      expect(__paytriotMocks.sign).toHaveBeenCalledWith(
        expect.objectContaining({ merchantID: "654321" }),
        "override_secret"
      );
    });

    test("fails when merchant secret is missing", async () => {
      __envMocks.getEnv.mockImplementation((key: string) => {
        if (key === "PAYTRIOT_MERCHANT_ID") return "123456";
        if (key === "PAYTRIOT_MERCHANT_SECRET") return "";
        return "";
      });

      const result = await paytriotAdapter.testCredentials("sandbox");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Paytriot merchant secret is required");
    });
  });
});

describe("retryStuckPaytriotFulfillment", () => {
  beforeEach(() => {
    __mocks.__findById.mockReturnValue({ lean: async () => null });
    __mocks.__findByIdAndUpdate.mockReset();
    __mocks.__finalizeSuccessfulOrder.mockReset();
    __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns 'skipped' if order not found", async () => {
    __mocks.__findById.mockReturnValue({ lean: async () => null });

    const result = await retryStuckPaytriotFulfillment(
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString()
    );
    expect(result).toBe("skipped");
  });

  test("returns 'skipped' if order.status is not 'processing'", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__findById.mockReturnValue({
      lean: async () => ({
        _id: orderId,
        status: "completed",
        providerSessionId: "paytriot_sess_1",
      }),
    });

    const result = await retryStuckPaytriotFulfillment(orderId.toString(), orderId.toString());
    expect(result).toBe("skipped");
  });

  test("returns 'skipped' if providerSessionId does not start with 'paytriot_'", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__findById.mockReturnValue({
      lean: async () => ({
        _id: orderId,
        status: "processing",
        providerSessionId: "pp_sess_other",
      }),
    });

    const result = await retryStuckPaytriotFulfillment(orderId.toString(), orderId.toString());
    expect(result).toBe("skipped");
  });

  test("returns 'in-progress' if fulfillment lock has not expired", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const lockExpiresAt = new Date(Date.now() + 60_000);
    __mocks.__findById.mockReturnValue({
      lean: async () => ({
        _id: orderId,
        userId,
        status: "processing",
        providerSessionId: "paytriot_flow_locked",
        metadata: { fulfillmentLock: { expiresAt: lockExpiresAt } },
      }),
    });

    const result = await retryStuckPaytriotFulfillment(orderId.toString(), userId.toString());
    expect(result).toBe("in-progress");
  });

  test("returns 'fulfilled' when resolveCaptureId reads from metadata.paytriotTransactionId", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.__finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
    __mocks.__findById.mockReturnValue({
      lean: async () => ({
        _id: orderId,
        userId,
        status: "processing",
        providerSessionId: "paytriot_flow_ready",
        metadata: { paytriotTransactionId: "paytriot_txn_123" },
      }),
    });

    const result = await retryStuckPaytriotFulfillment(orderId.toString(), userId.toString());
    expect(result).toBe("fulfilled");
    expect(__mocks.__finalizeSuccessfulOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: orderId.toString(),
        captureId: "paytriot_txn_123",
        source: "capture",
      })
    );
  });
});
