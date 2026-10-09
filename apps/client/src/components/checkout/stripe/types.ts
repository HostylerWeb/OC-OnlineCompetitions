"use client";

import type { ApiResponse, PaymentConfigResponse, PaymentProviderInfo } from "@oc/types";
import type { CheckoutProviderPanelProps } from "../providers/types";

export interface StripeCheckoutCart {
  total: number;
  cartId?: string | null;
  contact?: { email: string; phone?: string };
  shipping?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    country?: string;
  };
}

export interface StripeCheckoutProps extends CheckoutProviderPanelProps {
  cart: StripeCheckoutCart;
  isFormValid: boolean;
  onBeforePayment?: () => Promise<void>;
  onPaymentError?: (error: { message: string; code?: string }) => void;
  configResponse?: ApiResponse<PaymentConfigResponse>;
  providersResponse?: ApiResponse<PaymentProviderInfo[]>;
  configError?: Error | null;
  compliance?: { dob?: string };
}
