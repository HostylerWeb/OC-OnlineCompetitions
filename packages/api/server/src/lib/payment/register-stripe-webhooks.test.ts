import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  registerStripeWebhooks,
  STRIPE_SHOP_WEBHOOK_EVENTS,
  STRIPE_UNIFIED_WEBHOOK_EVENTS,
  STRIPE_WEBHOOK_EVENTS,
} from "./register-stripe-webhooks";

const __mocks = vi.hoisted(() => ({
  __getEnv: vi.fn((key: string) => {
    const env: Record<string, string> = {
      STRIPE_TEST_SECRET_KEY: "sk_test_xxx",
      APP_URL: "https://api.onlinecompetitions.co.uk",
    };
    return env[key];
  }),
  __hasStripeEnvCredentials: vi.fn(() => true),
  __getStripeEnvironmentFromEnv: vi.fn(() => "sandbox" as const),
  __setCachedWebhookSecret: vi.fn(),
  __paymentMethodFindOne: vi.fn(),
  __paymentMethodFindOneAndUpdate: vi.fn(async () => ({ _id: "pm_stripe" })),
  __listWebhookEndpoints: vi.fn(async () => ({ data: [] })),
  __createWebhookEndpoint: vi.fn(async (params: { url: string }) => ({
    id: "we_new",
    url: params.url,
    secret: "whsec_auto_123",
  })),
  __updateWebhookEndpoint: vi.fn(async (params: { id: string }) => ({
    id: params.id,
    url: "https://api.onlinecompetitions.co.uk/api/payments/webhook/stripe",
    secret: "whsec_auto_123",
  })),
}));

vi.mock("@oc/api-db/models", () => ({
  PaymentMethod: {
    findOne: __mocks.__paymentMethodFindOne,
    findOneAndUpdate: __mocks.__paymentMethodFindOneAndUpdate,
  },
}));

vi.mock("@oc/env/server", () => ({
  getEnv: __mocks.__getEnv,
}));

vi.mock("@oc/api-payment-stripe", () => ({
  createStripeClient: () => ({
    listWebhookEndpoints: __mocks.__listWebhookEndpoints,
    createWebhookEndpoint: __mocks.__createWebhookEndpoint,
    updateWebhookEndpoint: __mocks.__updateWebhookEndpoint,
  }),
}));

vi.mock("./ensure-stripe-payment-method", () => ({
  hasStripeEnvCredentials: __mocks.__hasStripeEnvCredentials,
  getStripeEnvironmentFromEnv: __mocks.__getStripeEnvironmentFromEnv,
}));

vi.mock("./providers/stripe", () => ({
  setCachedWebhookSecret: __mocks.__setCachedWebhookSecret,
}));

const UNIFIED_URL = "https://api.onlinecompetitions.co.uk/api/payments/webhook/stripe";
const SHOP_URL = "https://api.onlinecompetitions.co.uk/api/shop/checkout/webhook/stripe";

describe("registerStripeWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.__getEnv.mockImplementation((key: string) => {
      const env: Record<string, string> = {
        STRIPE_TEST_SECRET_KEY: "sk_test_xxx",
        APP_URL: "https://api.onlinecompetitions.co.uk",
      };
      return env[key];
    });
    __mocks.__hasStripeEnvCredentials.mockReturnValue(true);
    __mocks.__getStripeEnvironmentFromEnv.mockReturnValue("sandbox");
    __mocks.__listWebhookEndpoints.mockResolvedValue({ data: [] });
    __mocks.__createWebhookEndpoint.mockImplementation(async (params: { url: string }) => ({
      id: "we_new",
      url: params.url,
      secret: "whsec_auto_123",
    }));
    __mocks.__updateWebhookEndpoint.mockImplementation(async (params: { id: string }) => ({
      id: params.id,
      url: UNIFIED_URL,
      secret: "whsec_auto_123",
    }));
  });

  test("skips registration when STRIPE_WEBHOOK_SECRET env is set (manual mode)", async () => {
    __mocks.__getEnv.mockImplementation((key: string) =>
      key === "STRIPE_WEBHOOK_SECRET" ? "whsec_manual" : ""
    );

    await registerStripeWebhooks();

    expect(__mocks.__listWebhookEndpoints).not.toHaveBeenCalled();
  });

  test("skips registration when no stripe env credentials are set", async () => {
    __mocks.__hasStripeEnvCredentials.mockReturnValue(false);

    await registerStripeWebhooks();

    expect(__mocks.__listWebhookEndpoints).not.toHaveBeenCalled();
  });

  test("skips registration when the public URL is a local dev host", async () => {
    __mocks.__getEnv.mockImplementation((key: string) =>
      key === "APP_URL" ? "http://localhost:3000" : ""
    );

    await registerStripeWebhooks();

    expect(__mocks.__listWebhookEndpoints).not.toHaveBeenCalled();
  });

  test("creates the single unified endpoint with orders + shop events and persists via dotted path", async () => {
    await registerStripeWebhooks();

    expect(__mocks.__listWebhookEndpoints).toHaveBeenCalledTimes(1);
    expect(__mocks.__createWebhookEndpoint).toHaveBeenCalledTimes(1);
    expect(__mocks.__createWebhookEndpoint).toHaveBeenCalledWith({
      url: UNIFIED_URL,
      enabledEvents: STRIPE_UNIFIED_WEBHOOK_EVENTS,
    });
    expect(__mocks.__createWebhookEndpoint).not.toHaveBeenCalledWith({
      url: SHOP_URL,
      enabledEvents: expect.anything(),
    });
    expect(__mocks.__createWebhookEndpoint).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: SHOP_URL })
    );
    expect(__mocks.__setCachedWebhookSecret).toHaveBeenCalledWith("whsec_auto_123");
    expect(__mocks.__paymentMethodFindOneAndUpdate).toHaveBeenCalledWith(
      { provider: "stripe" },
      { $set: { "sandboxCredentials.webhookSecret": "whsec_auto_123" } }
    );
  });

  test("combined events keep STRIPE_WEBHOOK_EVENTS and add checkout.session.completed", () => {
    expect(STRIPE_UNIFIED_WEBHOOK_EVENTS).toEqual([
      ...STRIPE_WEBHOOK_EVENTS,
      "checkout.session.completed",
    ]);
    expect(STRIPE_SHOP_WEBHOOK_EVENTS).toContain("checkout.session.completed");
  });

  test("persists the webhook secret to liveCredentials.webhookSecret when the live environment is active", async () => {
    __mocks.__getStripeEnvironmentFromEnv.mockReturnValue("live");

    await registerStripeWebhooks();

    expect(__mocks.__paymentMethodFindOneAndUpdate).toHaveBeenCalledWith(
      { provider: "stripe" },
      { $set: { "liveCredentials.webhookSecret": "whsec_auto_123" } }
    );
    expect(__mocks.__paymentMethodFindOneAndUpdate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ sandboxCredentials: expect.anything() }),
      })
    );
  });

  test("does not create an endpoint that already exists by URL with matching events", async () => {
    __mocks.__listWebhookEndpoints.mockResolvedValue({
      data: [{ id: "we_1", url: UNIFIED_URL, enabled_events: STRIPE_UNIFIED_WEBHOOK_EVENTS }],
    });

    await registerStripeWebhooks();

    expect(__mocks.__createWebhookEndpoint).not.toHaveBeenCalled();
    expect(__mocks.__updateWebhookEndpoint).not.toHaveBeenCalled();
    expect(__mocks.__paymentMethodFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test("reconciles event drift when an endpoint exists with the wrong enabled_events", async () => {
    __mocks.__listWebhookEndpoints.mockResolvedValue({
      data: [
        {
          id: "we_1",
          url: UNIFIED_URL,
          enabled_events: ["payment_intent.succeeded"],
        },
      ],
    });

    await registerStripeWebhooks();

    expect(__mocks.__createWebhookEndpoint).not.toHaveBeenCalled();
    expect(__mocks.__updateWebhookEndpoint).toHaveBeenCalledTimes(1);
    expect(__mocks.__updateWebhookEndpoint).toHaveBeenCalledWith({
      id: "we_1",
      enabledEvents: STRIPE_UNIFIED_WEBHOOK_EVENTS,
    });
  });

  test("fails open when the Stripe API errors", async () => {
    __mocks.__listWebhookEndpoints.mockRejectedValue(new Error("stripe api down"));

    await expect(registerStripeWebhooks()).resolves.toBeUndefined();
  });
});
