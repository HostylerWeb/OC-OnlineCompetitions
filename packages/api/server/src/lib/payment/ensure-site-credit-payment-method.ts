import { PaymentMethod } from "@oc/api-db/models";

export const SITE_CREDIT_PROVIDER = "site_credit";

export async function ensureSiteCreditPaymentMethod(): Promise<void> {
  await PaymentMethod.findOneAndUpdate(
    { provider: SITE_CREDIT_PROVIDER },
    {
      $setOnInsert: {
        provider: SITE_CREDIT_PROVIDER,
        name: "Site Credit Wallet",
        enabled: false,
        isDefault: false,
        environment: "sandbox",
        checkoutMode: "hosted",
        sandboxCredentials: {},
        liveCredentials: {},
      },
    },
    { upsert: true }
  );
}

export async function isSiteCreditWalletEnabled(): Promise<boolean> {
  const doc = await PaymentMethod.findOne({ provider: SITE_CREDIT_PROVIDER }).select("enabled").lean();
  return Boolean(doc?.enabled);
}
