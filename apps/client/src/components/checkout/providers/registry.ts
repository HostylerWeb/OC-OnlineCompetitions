import type { PaymentProviderId } from "@oc/types";
import type { ComponentType } from "react";
import { LocalCheckout } from "@/components/checkout/local/LocalCheckout";
import { PaytriotCheckout } from "@/components/checkout/paytriot/PaytriotCheckout";
import { StripeCheckout } from "@/components/checkout/stripe/StripeCheckout";

type CheckoutComponent = ComponentType<any>;

export const checkoutComponents: Record<PaymentProviderId, CheckoutComponent> = {
  local: LocalCheckout as CheckoutComponent,
  paytriot: PaytriotCheckout as CheckoutComponent,
  stripe: StripeCheckout as CheckoutComponent,
};
