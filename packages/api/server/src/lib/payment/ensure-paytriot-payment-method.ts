import { PaymentMethod } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import type { PaytriotCredentials } from "@oc/api-payment-paytriot";
import { getEnv } from "@oc/env/server";

export function hasPaytriotEnvCredentials(): boolean {
  const merchantId = getEnv("PAYTRIOT_MERCHANT_ID")?.trim();
  const merchantSecret = getEnv("PAYTRIOT_MERCHANT_SECRET")?.trim();
  const result = Boolean(merchantId && merchantSecret);
  return result;
}

export function getPaytriotEnvironmentFromEnv(): "sandbox" | "live" {
  const env = getEnv("PAYTRIOT_ENVIRONMENT") ?? "sandbox";
  const resolved = env === "live" ? "live" : "sandbox";
  return resolved;
}

export function getPaytriotCredentials(): PaytriotCredentials {
  const merchantId = getEnv("PAYTRIOT_MERCHANT_ID") ?? "";
  const environment = getPaytriotEnvironmentFromEnv();
  return {
    merchantId,
    merchantSecret: getEnv("PAYTRIOT_MERCHANT_SECRET") ?? "",
    environment,
    statementNarrative1: getEnv("PAYTRIOT_STATEMENT_NARRATIVE_1") || undefined,
    statementNarrative2: getEnv("PAYTRIOT_STATEMENT_NARRATIVE_2") || undefined,
  };
}

export async function ensurePaytriotPaymentMethod(): Promise<void> {
  const hasCreds = hasPaytriotEnvCredentials();
  const environment = getPaytriotEnvironmentFromEnv();

  const existing = await PaymentMethod.findOne({ provider: "paytriot" }).lean();

  if (!existing) {
    await PaymentMethod.findOneAndUpdate(
      { provider: "paytriot" },
      {
        $set: {
          provider: "paytriot",
          name: "Paytriot",
          enabled: hasCreds,
          isDefault: false,
          environment,
          sandboxCredentials: {},
          liveCredentials: {},
        },
      },
      { upsert: true }
    );
    void invalidateByChannelSafe(CH.paymentConfig, CH.paymentProviders).catch(() => {});
  }
}
