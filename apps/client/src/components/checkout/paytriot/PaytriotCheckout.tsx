"use client";

import {
  ApiResponseError,
  getPaymentContextualError,
  useComplianceFeatures,
  useCreateCheckoutSession,
} from "@oc/api-client";
import { CreditCard, ShieldCheck } from "@oc/icons";
import type {
  ApiResponse,
  PaymentConfigResponse,
  PaymentProviderCapabilities,
  PaymentProviderInfo,
} from "@oc/types";
import { useState } from "react";
import { CheckoutErrorBanner } from "@/components/checkout/CheckoutErrorBanner";
import type { CheckoutProviderPanelProps } from "@/components/checkout/providers/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useExternalScripts } from "@/hooks/useExternalScripts";
import { formatCurrency, useTranslation } from "@/lib/i18n";

declare global {
  interface Window {
    PaytriotCheckout: {
      initPopup: () => void;
      open: (config: {
        fields: Record<string, string>;
        gatewayUrl: string;
        logoUrl?: string;
        onClose?: () => void;
      }) => void;
      close: (isCancel?: boolean) => void;
    };
  }
}

interface PaytriotCheckoutCart {
  items: Array<{ competitionId: string; quantity: number; answerIndex: number }>;
  subtotal: number;
  total: number;
  discount: number;
  promoCode?: string | null;
  referralCode?: string | null;
  cartId?: string | null;
  contact: { firstName: string; lastName: string; email: string; phone?: string };
  shipping: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    country?: string;
  };
  accountId: string;
  firstName?: string;
  lastName?: string;
}

interface PaytriotCheckoutConfig {
  environment: "sandbox" | "live";
  capabilities: PaymentProviderCapabilities;
}

interface PaytriotCheckoutProps extends CheckoutProviderPanelProps {
  cart: PaytriotCheckoutCart;
  isFormValid: boolean;
  onBeforePayment?: () => Promise<void>;
  onPaymentError?: (error: { message: string; code?: string }) => void;
  configResponse?: ApiResponse<PaymentConfigResponse>;
  providersResponse?: ApiResponse<PaymentProviderInfo[]>;
  configError: Error | null;
  compliance?: { dob?: string };
}

function parsePaytriotConfig(
  config: PaymentConfigResponse["config"] | undefined
): PaytriotCheckoutConfig | null {
  if (!config) {
    return null;
  }
  const raw = (config as Record<string, unknown>).paytriot;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const cfg = raw as {
    environment?: "sandbox" | "live";
    capabilities?: PaymentProviderCapabilities;
  };
  if (cfg.environment !== "sandbox" && cfg.environment !== "live") {
    return null;
  }
  const capabilities: PaymentProviderCapabilities = {
    canCapture: cfg.capabilities?.canCapture ?? false,
    canUseButtons: cfg.capabilities?.canUseButtons ?? false,
    canUseCardFields: cfg.capabilities?.canUseCardFields ?? false,
    canRefund: cfg.capabilities?.canRefund ?? true,
    canUseWebhooks: cfg.capabilities?.canUseWebhooks ?? true,
    canUseSubscriptions: cfg.capabilities?.canUseSubscriptions ?? false,
  };
  return { environment: cfg.environment, capabilities };
}

function PaytriotCheckoutLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gold/20 bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <div className="flex flex-col gap-2">
            <p>{t("checkout.cardPaymentInfo")}</p>
            <p className="text-xs">{t("checkout.ticketConfirmNote")}</p>
          </div>
        </div>
      </div>

      <Button
        type="button"
        disabled
        className="h-14 w-full rounded-xl text-sm"
        data-testid="paytriot-pay-button"
      >
        <span className="flex items-center gap-2">
          <Spinner size="sm" />
          {t("checkout.loadingPayment")}
        </span>
      </Button>

      <Alert className="border-gold/20 bg-transparent text-xs text-muted-foreground">
        <AlertDescription>{t("checkout.redirectAlert")}</AlertDescription>
      </Alert>
    </div>
  );
}

export function PaytriotCheckout({
  cart,
  isLoading,
  isActive = true,
  isFormValid,
  onBeforePayment,
  configResponse,
  providersResponse,
  configError,
  compliance,
}: PaytriotCheckoutProps) {
  const { t, locale } = useTranslation();
  const features = useComplianceFeatures();
  const createSession = useCreateCheckoutSession();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState<string | null>(null);

  const paytriotProvider = providersResponse?.data?.find((p) => p.id === "paytriot");
  const checkoutMode = paytriotProvider?.checkoutMode ?? "hosted";

  const scriptsStatus = useExternalScripts(
    isActive && checkoutMode === "popup"
      ? [
          { url: "/paytriot/paytriot-popup.css", type: "style" as const },
          { url: "/paytriot/paytriot-popup.js", type: "script" as const },
        ]
      : []
  );

  if (isActive === false) {
    return null;
  }

  if (isLoading) {
    return <PaytriotCheckoutLoading />;
  }

  const config = parsePaytriotConfig(configResponse?.data?.config);
  const isPaytriotEnabled = paytriotProvider?.enabled === true;

  const unavailableReasons: string[] = [];
  if (!isPaytriotEnabled) unavailableReasons.push("Paytriot is disabled in payment settings");
  if (!config) unavailableReasons.push("Paytriot environment is not configured");

  if (configError) {
    return (
      <CheckoutErrorBanner
        error={{
          message: t("checkout.configLoadError"),
        }}
      />
    );
  }

  if (unavailableReasons.length > 0) {
    return (
      <CheckoutErrorBanner
        error={{
          code: "PROVIDER_UNAVAILABLE",
          message: t("checkout.cardUnavailable"),
        }}
      />
    );
  }

  const handleHostedRedirect = async () => {
    if (isRedirecting) return;
    setSubmitError(null);
    try {
      if (onBeforePayment) await onBeforePayment();
      setIsRedirecting(true);
      const res = await createSession.mutateAsync({
        provider: "paytriot",
        contact: cart.contact,
        shipping: cart.shipping,
        cartId: cart.cartId ?? undefined,
        ...(cart.applySiteCredit ? { applySiteCredit: true } : {}),
        ...(compliance?.dob ? { compliance: { dob: compliance.dob } } : {}),
      });
      const formHtml = res.data?.formHtml;
      if (formHtml) {
        const container = document.createElement("div");
        container.style.display = "none";
        document.body.appendChild(container);
        container.innerHTML = formHtml;
        const form = container.querySelector("form");
        if (form) {
          form.submit();
        } else {
          throw new Error(t("checkout.cardPaymentStartError"));
        }
      } else {
        throw new Error(t("checkout.cardPaymentFormMissing"));
      }
    } catch (err: unknown) {
      setIsRedirecting(false);
      if (err instanceof Error && err.name === ApiResponseError.name) {
        setSubmitError(
          getPaymentContextualError(
            err as ApiResponseError,
            t("checkout.cardPaymentStartError"),
            features
          ).message
        );
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError(t("checkout.cardPaymentStartError"));
      }
    }
  };

  const handlePopupRedirect = async () => {
    if (isRedirecting) return;
    setSubmitError(null);
    setShowCancelled(null);
    try {
      if (onBeforePayment) await onBeforePayment();
      setIsRedirecting(true);
      const res = await createSession.mutateAsync({
        provider: "paytriot",
        contact: cart.contact,
        shipping: cart.shipping,
        cartId: cart.cartId ?? undefined,
        ...(cart.applySiteCredit ? { applySiteCredit: true } : {}),
        ...(compliance?.dob ? { compliance: { dob: compliance.dob } } : {}),
      });
      const fields = res.data?.fields;
      const gatewayUrl = res.data?.gatewayUrl;
      if (fields && gatewayUrl) {
        setIsRedirecting(false);
        if (window.PaytriotCheckout?.open) {
          window.PaytriotCheckout.open({
            fields,
            gatewayUrl,
            logoUrl: "/paytriot/paytriotlogo.svg",
            onClose: () => {
              setShowCancelled(t("checkout.paymentCancelled"));
            },
          });
        } else {
          throw new Error(t("checkout.cardPaymentSystemNotReady"));
        }
      } else {
        throw new Error(t("checkout.cardPaymentFieldsMissing"));
      }
    } catch (err: unknown) {
      setIsRedirecting(false);
      window.PaytriotCheckout?.close(true);
      if (err instanceof Error && err.name === ApiResponseError.name) {
        setSubmitError(
          getPaymentContextualError(
            err as ApiResponseError,
            t("checkout.cardPaymentStartError"),
            features
          ).message
        );
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError(t("checkout.cardPaymentStartError"));
      }
    }
  };

  const handlePayClick = () => {
    if (checkoutMode === "popup") {
      if (!window.PaytriotCheckout?.initPopup) {
        setSubmitError(t("checkout.cardPaymentPopupNotOpened"));
        return;
      }
      window.PaytriotCheckout.initPopup();
      void handlePopupRedirect();
    } else {
      void handleHostedRedirect();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gold/20 bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <div className="flex flex-col gap-2">
            <p>{t("checkout.cardPaymentInfo")}</p>
            <p className="text-xs">{t("checkout.ticketConfirmNote")}</p>
          </div>
        </div>
      </div>

      {submitError ? <CheckoutErrorBanner error={{ message: submitError }} /> : null}
      {showCancelled ? <CheckoutErrorBanner error={{ message: showCancelled }} /> : null}

      {scriptsStatus === "error" ? (
        <CheckoutErrorBanner
          error={{
            message: t("checkout.cardPaymentSystemNotReady"),
          }}
        />
      ) : null}

      <Button
        type="button"
        onClick={handlePayClick}
        disabled={
          !isFormValid || isRedirecting || createSession.isPending || scriptsStatus === "loading"
        }
        className="h-14 w-full rounded-xl text-sm"
        data-testid="paytriot-pay-button"
        data-umami-event="checkout:paytriot-pay"
        data-umami-event-amount={cart.total.toFixed(2)}
        data-umami-event-mode={checkoutMode}
      >
        {isRedirecting || createSession.isPending ? (
          <span className="flex items-center gap-2">
            <Spinner size="sm" />
            {checkoutMode === "popup"
              ? t("checkout.openingPopup")
              : t("checkout.redirectingSecure")}
          </span>
        ) : scriptsStatus === "loading" && checkoutMode === "popup" ? (
          <span className="flex items-center gap-2">
            <Spinner size="sm" />
            {t("checkout.loadingPayment")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CreditCard className="size-4" aria-hidden />
            {t("checkout.payWithCard", { amount: formatCurrency(cart.total, locale) })}
          </span>
        )}
      </Button>

      {checkoutMode === "popup" ? (
        <Alert className="border-gold/20 bg-transparent text-xs text-muted-foreground">
          <AlertDescription>{t("checkout.popupAlert")}</AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-gold/20 bg-transparent text-xs text-muted-foreground">
          <AlertDescription>{t("checkout.redirectAlert")}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
