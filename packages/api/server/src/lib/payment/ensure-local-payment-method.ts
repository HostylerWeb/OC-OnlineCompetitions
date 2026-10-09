import { PaymentMethod } from "@oc/api-db/models";
import { runtimeConfig } from "@oc/api-infra/runtime-config";

export function isLocalPaymentMethodEnabled(): boolean {
  return runtimeConfig.enableLocalPaymentMethod;
}

export async function ensureLocalPaymentMethod(): Promise<void> {
  const isDev = isLocalPaymentMethodEnabled();
  const existing = await PaymentMethod.findOne({ provider: "local" }).lean();

  if (!existing) {
    await PaymentMethod.findOneAndUpdate(
      { provider: "local" },
      {
        $set: {
          provider: "local",
          name: "Local (Dev Bypass)",
          enabled: isDev,
          isDefault: isDev,
          environment: "sandbox",
          sandboxCredentials: {},
          liveCredentials: {},
        },
      },
      { upsert: true }
    );
    return;
  }

  if (!isDev && existing.enabled) {
    await PaymentMethod.updateOne(
      { provider: "local" },
      { $set: { enabled: false, isDefault: false, updatedAt: new Date() } }
    );
  }
}
