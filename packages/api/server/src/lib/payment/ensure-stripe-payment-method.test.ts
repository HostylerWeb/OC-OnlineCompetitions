import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ensureStripePaymentMethod,
  getStripeEnvironmentFromEnv,
  hasStripeEnvCredentials,
} from "./ensure-stripe-payment-method";
import { hasProviderEnvCredentials } from "./payment-method-credentials";

const __mocks = vi.hoisted(() => ({
  __paymentMethodFindOne: vi.fn(),
  __paymentMethodFindOneAndUpdate: vi.fn(),
  __invalidateByChannelSafe: vi.fn(async () => {}),
  __getEnv: vi.fn((key: string) => {
    const env: Record<string, string> = {
      STRIPE_TEST_SECRET_KEY: "sk_test_xxx",
      STRIPE_ENVIRONMENT: "sandbox",
    };
    return env[key];
  }),
}));

vi.mock("@oc/api-db/models", () => ({
  PaymentMethod: {
    findOne: __mocks.__paymentMethodFindOne,
    findOneAndUpdate: __mocks.__paymentMethodFindOneAndUpdate,
  },
}));

vi.mock("@oc/api-infra/cache", () => ({
  CH: {
    paymentConfig: "payment-config",
    paymentProviders: "payment-providers",
  },
  invalidateByChannelSafe: __mocks.__invalidateByChannelSafe,
}));

vi.mock("@oc/env/server", () => ({
  getEnv: __mocks.__getEnv,
}));

vi.mock("./ensure-paytriot-payment-method", () => ({
  hasPaytriotEnvCredentials: vi.fn(() => false),
}));

describe("hasStripeEnvCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns false when no stripe env keys are set", () => {
    __mocks.__getEnv.mockReturnValue("");

    expect(hasStripeEnvCredentials()).toBe(false);
  });

  test("returns true when a test secret key is set", () => {
    __mocks.__getEnv.mockImplementation((key: string) =>
      key === "STRIPE_TEST_SECRET_KEY" ? "sk_test_xxx" : ""
    );

    expect(hasStripeEnvCredentials()).toBe(true);
  });

  test("returns true when a fallback STRIPE_SECRET_KEY is set", () => {
    __mocks.__getEnv.mockImplementation((key: string) =>
      key === "STRIPE_SECRET_KEY" ? "sk_live_xxx" : ""
    );

    expect(hasStripeEnvCredentials()).toBe(true);
  });
});

describe("getStripeEnvironmentFromEnv", () => {
  test("defaults to sandbox when STRIPE_ENVIRONMENT is not set", () => {
    __mocks.__getEnv.mockReturnValue(undefined);

    expect(getStripeEnvironmentFromEnv()).toBe("sandbox");
  });

  test("resolves to live when STRIPE_ENVIRONMENT is live", () => {
    __mocks.__getEnv.mockImplementation((key: string) =>
      key === "STRIPE_ENVIRONMENT" ? "live" : ""
    );

    expect(getStripeEnvironmentFromEnv()).toBe("live");
  });
});

describe("ensureStripePaymentMethod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.__paymentMethodFindOne.mockReturnValue({ lean: async () => null });
    __mocks.__paymentMethodFindOneAndUpdate.mockResolvedValue({ _id: "pm_stripe" });
    __mocks.__invalidateByChannelSafe.mockResolvedValue(undefined);
    __mocks.__getEnv.mockImplementation((key: string) => {
      const env: Record<string, string> = {
        STRIPE_TEST_SECRET_KEY: "sk_test_xxx",
        STRIPE_ENVIRONMENT: "sandbox",
      };
      return env[key];
    });
  });

  test("upserts the PaymentMethod doc and invalidates cache channels when missing", async () => {
    await ensureStripePaymentMethod();

    expect(__mocks.__paymentMethodFindOne).toHaveBeenCalledWith({ provider: "stripe" });
    expect(__mocks.__paymentMethodFindOneAndUpdate).toHaveBeenCalledWith(
      { provider: "stripe" },
      {
        $set: expect.objectContaining({
          provider: "stripe",
          name: "Stripe",
          enabled: true,
          isDefault: true,
          environment: "sandbox",
        }),
      },
      { upsert: true }
    );
    expect(__mocks.__invalidateByChannelSafe).toHaveBeenCalledWith(
      "payment-config",
      "payment-providers"
    );
  });

  test("does nothing when the PaymentMethod doc already matches env state", async () => {
    __mocks.__paymentMethodFindOne.mockReturnValue({
      lean: async () => ({
        _id: "pm_stripe",
        provider: "stripe",
        enabled: true,
        isDefault: true,
        environment: "sandbox",
      }),
    });

    await ensureStripePaymentMethod();

    expect(__mocks.__paymentMethodFindOneAndUpdate).not.toHaveBeenCalled();
    expect(__mocks.__invalidateByChannelSafe).not.toHaveBeenCalled();
  });

  test("keeps an admin-disabled method disabled when credentials exist", async () => {
    __mocks.__paymentMethodFindOne.mockReturnValue({
      lean: async () => ({
        _id: "pm_stripe",
        provider: "stripe",
        enabled: false,
        isDefault: false,
        environment: "sandbox",
      }),
    });

    await ensureStripePaymentMethod();

    expect(__mocks.__paymentMethodFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test("updates environment without changing the admin enabled flag", async () => {
    __mocks.__getEnv.mockImplementation((key: string) => {
      const env: Record<string, string> = {
        STRIPE_TEST_SECRET_KEY: "sk_test_xxx",
        STRIPE_ENVIRONMENT: "live",
      };
      return env[key];
    });
    __mocks.__paymentMethodFindOne.mockReturnValue({
      lean: async () => ({
        _id: "pm_stripe",
        provider: "stripe",
        enabled: false,
        isDefault: false,
        environment: "sandbox",
      }),
    });

    await ensureStripePaymentMethod();

    expect(__mocks.__paymentMethodFindOneAndUpdate).toHaveBeenCalledWith(
      { provider: "stripe" },
      {
        $set: { environment: "live" },
      }
    );
  });
});

describe("hasProviderEnvCredentials", () => {
  test("routes stripe to the stripe env credentials gate", () => {
    __mocks.__getEnv.mockImplementation((key: string) =>
      key === "STRIPE_TEST_SECRET_KEY" ? "sk_test_xxx" : ""
    );

    expect(hasProviderEnvCredentials("stripe")).toBe(true);

    __mocks.__getEnv.mockReturnValue("");
    expect(hasProviderEnvCredentials("stripe")).toBe(false);
  });
});
