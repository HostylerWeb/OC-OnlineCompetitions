import { beforeEach, describe, expect, test, vi } from "vitest";
import paymentMethodsApp from "./payment-methods";

const __mock = vi.hoisted(() => {
  const paymentMethodFind = vi.fn();
  const paymentMethodFindOne = vi.fn();
  const paymentMethodFindOneAndUpdate = vi.fn();
  const paymentMethodUpdateMany = vi.fn();
  const paymentMethodDeleteMany = vi.fn(() => ({ deletedCount: 0 }));
  const setDefaultPaymentMethod = vi.fn();

  const adapters: Record<string, { testCredentials: ReturnType<typeof vi.fn> }> = {
    local: { testCredentials: vi.fn() },
    paytriot: { testCredentials: vi.fn() },
    stripe: { testCredentials: vi.fn() },
  };

  const methodDoc = (overrides: Record<string, unknown> = {}) => ({
    provider: "local",
    name: "Local",
    enabled: true,
    isDefault: false,
    environment: "sandbox",
    checkoutMode: "hosted",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

  return {
    paymentMethodFind,
    paymentMethodFindOne,
    paymentMethodFindOneAndUpdate,
    paymentMethodUpdateMany,
    paymentMethodDeleteMany,
    setDefaultPaymentMethod,
    adapters,
    getAdapter: vi.fn((id: string) => adapters[id]),
    ensureLocalPaymentMethod: vi.fn(async () => {}),
    ensurePaytriotPaymentMethod: vi.fn(async () => {}),
    ensureStripePaymentMethod: vi.fn(async () => {}),
    hasProviderEnvCredentials: vi.fn(
      (provider: string) => provider === "local" || provider === "stripe"
    ),
    mapInternalCapabilitiesToPublic: vi.fn((caps: unknown) => caps),
    methodDoc,
  };
});

vi.mock("@oc/api-infra/db", () => ({ default: vi.fn(async () => {}) }));

vi.mock("@oc/api-server/middleware/auth", () => ({
  isPublicRoute: () => false,
  resolveSession: vi.fn(async () => ({})),
  sessionMiddleware: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireSession: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireVerifiedUser: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  getRequiredUserId: () => "test-user-id",
  auth: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireManager: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock("@oc/api-db/models", () => ({
  PaymentMethod: {
    find: (...args: unknown[]) => __mock.paymentMethodFind(...args),
    findOne: (...args: unknown[]) => __mock.paymentMethodFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => __mock.paymentMethodFindOneAndUpdate(...args),
    updateMany: (...args: unknown[]) => __mock.paymentMethodUpdateMany(...args),
    deleteMany: (...args: unknown[]) => __mock.paymentMethodDeleteMany(...args),
  },
  setDefaultPaymentMethod: (...args: unknown[]) => __mock.setDefaultPaymentMethod(...args),
}));

vi.mock("@oc/api-server/lib/payment/ensure-local-payment-method", () => ({
  ensureLocalPaymentMethod: (...args: unknown[]) => __mock.ensureLocalPaymentMethod(...args),
}));

vi.mock("@oc/api-server/lib/payment/ensure-paytriot-payment-method", () => ({
  ensurePaytriotPaymentMethod: (...args: unknown[]) => __mock.ensurePaytriotPaymentMethod(...args),
}));

vi.mock("@oc/api-server/lib/payment/ensure-stripe-payment-method", () => ({
  ensureStripePaymentMethod: (...args: unknown[]) => __mock.ensureStripePaymentMethod(...args),
}));

vi.mock("@oc/api-server/lib/payment/payment-method-credentials", () => ({
  hasProviderEnvCredentials: (...args: unknown[]) => __mock.hasProviderEnvCredentials(...args),
}));

vi.mock("@oc/api-server/lib/payment/capabilities", () => ({
  mapInternalCapabilitiesToPublic: (...args: unknown[]) =>
    __mock.mapInternalCapabilitiesToPublic(...args),
}));

vi.mock("@oc/api-server/lib/payment/providers", () => ({
  paymentProcessors: [
    {
      id: "local",
      capabilities: { checkout: true, webhooks: false, refunds: false, subscriptions: false },
    },
    {
      id: "paytriot",
      capabilities: { checkout: true, webhooks: true, refunds: false, subscriptions: false },
    },
    {
      id: "stripe",
      capabilities: { checkout: true, webhooks: true, refunds: true, subscriptions: false },
    },
  ],
  getAdapter: (...args: unknown[]) => __mock.getAdapter(...args),
}));

describe("admin payment methods routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mock.paymentMethodFind.mockReturnValue({
      lean: async () => [
        __mock.methodDoc({ provider: "local", name: "Local", enabled: true }),
        __mock.methodDoc({ provider: "paytriot", name: "Paytriot", enabled: false }),
        __mock.methodDoc({ provider: "stripe", name: "Stripe", enabled: true }),
      ],
    });
  });

  test("GET / bootstraps providers and the sweep keeps stripe in ACTIVE_PROVIDERS", async () => {
    const res = await paymentMethodsApp.request("http://localhost/");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(__mock.ensureLocalPaymentMethod).toHaveBeenCalledTimes(1);
    expect(__mock.ensurePaytriotPaymentMethod).toHaveBeenCalledTimes(1);
    expect(__mock.ensureStripePaymentMethod).toHaveBeenCalledTimes(1);

    const sweepFilter = __mock.paymentMethodDeleteMany.mock.calls[0]?.[0] as
      | { provider: { $nin: string[] } }
      | undefined;
    expect(sweepFilter?.provider?.$nin).toEqual(["local", "stripe", "paytriot"]);

    const providers = (body.data as Array<{ provider: string }>).map((m) => m.provider);
    expect(providers).toEqual(["local", "paytriot", "stripe"]);

    const stripeMethod = (body.data as Array<{ provider: string; hasCredentials: boolean }>).find(
      (m) => m.provider === "stripe"
    );
    expect(stripeMethod?.hasCredentials).toBe(true);
  });

  test("GET /:provider stripe returns the method with environment credentials source", async () => {
    __mock.paymentMethodFindOne.mockReturnValue({
      lean: async () => __mock.methodDoc({ provider: "stripe", name: "Stripe", enabled: false }),
    });

    const res = await paymentMethodsApp.request("http://localhost/stripe");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      provider: "stripe",
      name: "Stripe",
      credentialsSource: "environment",
      hasCredentials: true,
    });
  });

  test("POST /stripe/test delegates to the stripe adapter with overrides", async () => {
    __mock.adapters.stripe.testCredentials.mockResolvedValue({ success: true });

    const res = await paymentMethodsApp.request("http://localhost/stripe/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        environment: "sandbox",
        sandboxCredentials: { clientId: "pk_test_123", secret: "sk_test_123" },
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(__mock.getAdapter).toHaveBeenCalledWith("stripe");
    expect(__mock.adapters.stripe.testCredentials).toHaveBeenCalledWith(
      "sandbox",
      "pk_test_123",
      "sk_test_123"
    );
    expect(body.data).toEqual({ success: true });
  });

  test("POST /stripe/test surfaces adapter failure as success:false", async () => {
    __mock.adapters.stripe.testCredentials.mockResolvedValue({
      success: false,
      error: "Invalid secret key",
    });

    const res = await paymentMethodsApp.request("http://localhost/stripe/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        environment: "live",
        liveCredentials: { clientId: "pk_live_123", secret: "sk_live_123" },
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(__mock.adapters.stripe.testCredentials).toHaveBeenCalledWith(
      "live",
      "pk_live_123",
      "sk_live_123"
    );
    expect(body.data).toEqual({ success: false, error: "Invalid secret key" });
  });

  test("POST /local/test returns success without touching an adapter", async () => {
    const res = await paymentMethodsApp.request("http://localhost/local/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment: "sandbox" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ success: true });
    expect(__mock.getAdapter).not.toHaveBeenCalled();
  });

  test("POST /unknown/test returns INVALID_PROVIDER", async () => {
    const res = await paymentMethodsApp.request("http://localhost/unknown/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment: "sandbox" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("INVALID_PROVIDER");
  });
});
