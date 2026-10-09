import { PaymentMethod } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import { getEnv } from "@oc/env/server";

export function hasStripeEnvCredentials(): boolean {
  const testKey = getEnv("STRIPE_TEST_SECRET_KEY")?.trim();
  const liveKey = getEnv("STRIPE_LIVE_SECRET_KEY")?.trim();
  const fallbackKey = getEnv("STRIPE_SECRET_KEY")?.trim();
  return Boolean(testKey || liveKey || fallbackKey);
}

export function getStripeEnvironmentFromEnv(): "sandbox" | "live" {
  const env = getEnv("STRIPE_ENVIRONMENT") ?? "sandbox";
  const resolved = env === "live" ? "live" : "sandbox";
  return resolved;
}

export async function ensureStripePaymentMethod(): Promise<void> {
  const hasCreds = hasStripeEnvCredentials();
  const environment = getStripeEnvironmentFromEnv();

  const existing = await PaymentMethod.findOne({ provider: "stripe" }).lean();

  if (!existing) {
    await PaymentMethod.findOneAndUpdate(
      { provider: "stripe" },
      {
        $set: {
          provider: "stripe",
          name: "Stripe",
          enabled: hasCreds,
          isDefault: hasCreds,
          environment,
          sandboxCredentials: {},
          liveCredentials: {},
        },
      },
      { upsert: true }
    );
    void invalidateByChannelSafe(CH.paymentConfig, CH.paymentProviders).catch(() => {});
    return;
  }

  if (existing.environment !== environment) {
    await PaymentMethod.findOneAndUpdate(
      { provider: "stripe" },
      {
        $set: { environment },
      }
    );
    void invalidateByChannelSafe(CH.paymentConfig, CH.paymentProviders).catch(() => {});
  }
}
