import { LOCAL_CURRENCY } from "@oc/api-payment-local";
import { PAYTRIOT_CURRENCY } from "@oc/api-payment-paytriot";
import { getEnv } from "@oc/env/server";
import type { PaymentProviderId } from "../types";

const DEFAULTS: Record<PaymentProviderId, string> = {
  paytriot: PAYTRIOT_CURRENCY,
  stripe: "GBP",
  local: LOCAL_CURRENCY,
};

export function getProviderCurrency(providerId: PaymentProviderId): string {
  const fromEnv = (() => {
    switch (providerId) {
      case "paytriot":
        return getEnv("PAYTRIOT_CURRENCY");
      case "stripe":
        return getEnv("STRIPE_CURRENCY");
      case "local":
        return getEnv("LOCAL_CURRENCY");
    }
  })();
  return fromEnv || DEFAULTS[providerId];
}
