export type PaymentProviderId = "local" | "stripe" | "paytriot";

export interface Balance {
  _id: string;
  userId: string;
  available: number;
  pending: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceTransaction {
  _id: string;
  userId: string;
  type:
    | "top_up"
    | "withdraw"
    | "withdraw_reversed"
    | "purchase"
    | "purchase_refund"
    | "admin_credit"
    | "admin_debit"
    | "prize_credit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: "pending" | "completed" | "failed" | "reversed";
  orderId?: string;
  paymentProviderTransactionId?: string;
  withdrawReference?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceTopUpSession {
  sessionId: string;
  redirectUrl: string;
  transactionId: string;
}

export interface BalanceWithdrawResponse {
  transactionId: string;
  amount: number;
  status: "pending";
  message: string;
}

export interface PaymentProviderInternalCapabilities {
  checkout: boolean;
  webhooks: boolean;
  refunds: boolean;
  subscriptions: boolean;
}

export interface PaymentProviderCapabilities {
  canCapture: boolean;
  canUseButtons: boolean;
  canUseCardFields: boolean;
  canRefund: boolean;
  canUseWebhooks: boolean;
  canUseSubscriptions: boolean;
}

export interface PaytriotPublicConfig {
  environment: "sandbox" | "live";
  statementNarrative1?: string;
  statementNarrative2?: string;
  capabilities: PaymentProviderCapabilities;
}

export interface StripePublicConfig {
  publishableKey: string;
  environment: "test" | "live";
  capabilities: PaymentProviderCapabilities;
}

export interface PaymentConfigResponse {
  config: Record<string, PaytriotPublicConfig | StripePublicConfig | Record<string, unknown>>;
}

export interface PaymentProviderInfo {
  id: string;
  name: string;
  enabled: boolean;
  isDefault?: boolean;
  environment?: "sandbox" | "live";
  checkoutMode?: "hosted" | "popup";
  capabilities?: PaymentProviderCapabilities;
}

export interface CreatePaymentSessionItem {
  competitionId: string;
  quantity: number;
  answerIndex: number;
}

export interface CreatePaymentSessionContact {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
}

export interface CreatePaymentSessionShipping {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country?: string;
}

export interface CreatePaymentSessionRequest {
  provider?: string;
  items?: CreatePaymentSessionItem[];
  subtotal?: number;
  promoCode?: string | null;
  referralCode?: string | null;
  cartId?: string;
  expectedCartVersion?: number;
  idempotencyKey?: string;
  contact?: CreatePaymentSessionContact;
  shipping?: CreatePaymentSessionShipping;
  applySiteCredit?: boolean;
}

import type { CheckoutComplianceHints } from "./compliance";

export interface CreatePaymentSessionResponse {
  provider: string;
  sessionId: string;
  orderId: string;
  redirectUrl?: string;
  approvalUrl?: string;
  formHtml?: string;
  fields?: Record<string, string>;
  gatewayUrl?: string;
  instantWinInCart?: boolean;
  compliance?: CheckoutComplianceHints;
  siteCreditApplied?: number;
  gatewayTotal?: number;
  cartTotal?: number;
}

export type PaymentSessionStatusValue = "pending" | "processing" | "completed" | "failed";

export interface PaymentSessionStatusResponse {
  status: PaymentSessionStatusValue;
  orderId?: string;
  errorCode?: string;
  errorMessage?: string;
  errorTitle?: string;
  recommendedAction?: string;
  wasCharged?: boolean;
  fulfillmentFailed?: boolean;
}

export interface CapturePaymentSessionResponse {
  status: "completed" | "processing" | "failed";
  orderId?: string;
}

export interface PaymentWebhookResult {
  eventType: string;
  sessionId: string;
  status: PaymentSessionStatusValue;
  orderId?: string;
}

export interface AdminPaymentMethodCredentialDiagnostics {
  hasTerminalId?: boolean;
  hasClientId?: boolean;
  hasSecret?: boolean;
}

export interface AdminPaymentMethodEnabledMethods {
  hostedFields: boolean;
  googlePay: boolean;
  applePay: boolean;
}

export interface AdminPaymentMethodRecord {
  provider: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  environment: "sandbox" | "live";
  checkoutMode: "hosted" | "popup";
  hasCredentials: boolean;
  credentialsSource?: "environment" | "database";
  capabilities?: PaymentProviderCapabilities;
  enabledMethods?: AdminPaymentMethodEnabledMethods;
  credentialDiagnostics?: AdminPaymentMethodCredentialDiagnostics;
  priceIds?: Record<string, string>;
  updatedAt: string;
}

/**
 * Per-provider credential shape. Each variant narrows the 7-field generic Mixed
 * schema on `PaymentMethod` to the fields the provider actually uses. Mongoose
 * storage remains `Mixed`; this union is a TS-side surface only.
 */
export type PaymentMethodCredentials = PaytriotCredentials | LocalCredentials | StripeCredentials;

export interface LocalCredentials {
  provider: "local";
  /** Local bypass is always available; no credentials required. */
  enabled: boolean;
}

export interface PaytriotCredentials {
  provider: "paytriot";
  merchantId?: string;
  merchantSecret?: string;
  statementNarrative1?: string;
  statementNarrative2?: string;
}

export interface StripeCredentials {
  provider: "stripe";
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

/**
 * Subset of Paytriot order metadata that the customer-facing checkout
 * success page reads (via `/api/me/orders/:id`). Other fields may exist
 * on the order document but are not surfaced to the success UI.
 *
 * Used for `MeOrderDetailDto.metadata` typing and for the E2 defense-in-depth
 * check `metadata.fulfillmentFailedAfterCapture` on the success page.
 */
export interface PaytriotOrderMetadata {
  /** Card was charged but our internal fulfillment failed after capture. */
  fulfillmentFailedAfterCapture?: boolean;
  fulfillmentError?: {
    message?: string;
    stack?: string;
    capturedAt?: string;
  };
  paytriotErrorCategory?: string;
  paytriotErrorTitle?: string;
  paytriotErrorUserMessage?: string;
  paytriotErrorRecommendedAction?: string;
  paytriotErrorWasCharged?: boolean;
  paytriotReferralPhone?: string;
  paytriotState?: string;
  paytriotResponseCode?: number;
  paytriotResponseMessage?: string;
  paytriotTransactionId?: string;
  paytriotXref?: string;
  paytriotAuthCode?: string;
  paytriotAmountReceived?: number;
  paytriotCard?: {
    type?: string;
    typeCode?: string;
    scheme?: string;
    masked?: string;
    issuer?: string;
    issuerCountry?: string;
  };
  paytriotAvs?: {
    enabled?: boolean;
    code?: string;
    message?: string;
    cv2Check?: string;
    addressCheck?: string;
    postcodeCheck?: string;
  };
  paytriotThreeDS?: {
    enabled?: boolean;
    enrolled?: string;
    authenticated?: string;
    xid?: string;
    cavv?: string;
    eci?: string;
  };
  paytriotSigAcceptedWithWarning?: boolean;
  paytriotSigError?: string;
}
