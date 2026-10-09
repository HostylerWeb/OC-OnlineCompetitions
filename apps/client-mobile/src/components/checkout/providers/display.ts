import type { CardBrand } from "@oc/icons";
import { CARD_BRAND_COMPONENT, CreditCard, type LucideIcon, Sparkles } from "@oc/icons";
import type { PaymentProviderId } from "@oc/types";
import { translate } from "@/lib/i18n";

export interface ProviderDisplay {
  title: string;
  description: string;
  badge?: string;
  icon: LucideIcon;
  cardBrands?: CardBrand[];
}

export const providerDisplay: Record<PaymentProviderId, ProviderDisplay> = {
  local: {
    title: translate("checkout.cardBrands.testMode"),
    description: translate("checkout.cardBrands.testModeDesc"),
    badge: translate("checkout.cardBrands.devOnly"),
    icon: Sparkles,
  },
  paytriot: {
    title: translate("checkout.cardBrands.cardPayment"),
    description: translate("checkout.cardBrands.cardPaymentDesc"),
    badge: translate("checkout.cardBrands.fastSecure"),
    icon: CreditCard,
    cardBrands: ["visa", "mastercard", "apple-pay", "google-pay"],
  },
  stripe: {
    title: translate("checkout.cardBrands.stripeCard"),
    description: translate("checkout.cardBrands.stripeCardDesc"),
    badge: translate("checkout.cardBrands.fastSecure"),
    icon: CreditCard,
    cardBrands: ["visa", "mastercard", "apple-pay", "google-pay"],
  },
};

export { CARD_BRAND_COMPONENT };
