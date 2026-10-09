import type { PaytriotPublicConfig, StripePublicConfig } from "@oc/types";
import { mapInternalCapabilitiesToPublic } from "./capabilities";
import type { PaymentProcessor } from "./providers/payments-processors";

export interface PaymentMethodRecord {
  provider: string;
  enabled: boolean;
  environment?: "sandbox" | "live";
  sandboxCredentials?: Record<string, unknown>;
  liveCredentials?: Record<string, unknown>;
}

export function buildPublicPaymentConfig(params: {
  methods: PaymentMethodRecord[];
  paytriotProcessor?: PaymentProcessor;
  stripeProcessor?: PaymentProcessor;
  stripePublishableKeyEnv?: string;
  stripeEnvironmentEnv?: "test" | "live";
}): Record<string, PaytriotPublicConfig | StripePublicConfig | Record<string, unknown>> {
  const config: Record<
    string,
    PaytriotPublicConfig | StripePublicConfig | Record<string, unknown>
  > = {};
  const {
    methods,
    paytriotProcessor,
    stripeProcessor,
    stripePublishableKeyEnv = "",
    stripeEnvironmentEnv,
  } = params;

  for (const method of methods) {
    if (!method.enabled) continue;

    if (method.provider === "paytriot") {
      const env = method.environment ?? "sandbox";
      const internalCaps = paytriotProcessor?.capabilities ?? {
        checkout: true,
        webhooks: true,
        refunds: false,
        subscriptions: false,
      };

      config.paytriot = {
        environment: env,
        statementNarrative1: process.env.PAYTRIOT_STATEMENT_NARRATIVE_1 ?? "Paytrio*Ukcomp",
        statementNarrative2: process.env.PAYTRIOT_STATEMENT_NARRATIVE_2 ?? "02038841611",
        capabilities: mapInternalCapabilitiesToPublic(internalCaps),
      } satisfies PaytriotPublicConfig;
    }

    if (method.provider === "stripe") {
      const dbEnv = method.environment ?? "sandbox";
      const env = stripeEnvironmentEnv || (dbEnv === "live" ? "live" : "test");
      const dbCreds = env === "live" ? method.liveCredentials : method.sandboxCredentials;
      const dbPublishableKey =
        typeof dbCreds?.publishableKey === "string" ? dbCreds.publishableKey : "";
      const resolvedPublishableKey = stripePublishableKeyEnv || dbPublishableKey || "";
      const internalCaps = stripeProcessor?.capabilities ?? {
        checkout: true,
        webhooks: true,
        refunds: true,
        subscriptions: false,
      };

      config.stripe = {
        publishableKey: resolvedPublishableKey,
        environment: env,
        capabilities: mapInternalCapabilitiesToPublic(internalCaps),
      } satisfies StripePublicConfig;
    }
  }

  const siteCreditMethod = methods.find((m) => m.provider === "site_credit");
  if (siteCreditMethod?.enabled) {
    config.siteCreditWallet = { enabled: true };
  }

  return config;
}
