import { runtimeConfig } from "@oc/api-infra/runtime-config";

/** Real-money bypass via `local` provider (top-up, shop paid inline) — never in production unless explicitly enabled. */
export function isLocalPaymentAllowed(): boolean {
  return runtimeConfig.enableLocalPaymentMethod;
}

export function isCardPaymentProvider(provider: string): boolean {
  return provider === "paytriot" || provider === "stripe";
}

type PaymentMethodRow = { provider: string; enabled?: boolean; isDefault?: boolean };

/** Strip `local` when env disallows real-money bypass (production default). */
export function filterEnabledPaymentMethods<T extends PaymentMethodRow>(methods: T[]): T[] {
  if (isLocalPaymentAllowed()) return methods.filter((m) => m.enabled !== false);
  return methods.filter((m) => m.enabled !== false && m.provider !== "local");
}

export function isPaymentProviderPubliclyEnabled(provider: string, dbEnabled: boolean): boolean {
  if (provider === "local") return isLocalPaymentAllowed() && dbEnabled;
  return dbEnabled;
}
