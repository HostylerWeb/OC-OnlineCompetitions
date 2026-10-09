"use client";

import {
  ApiResponseError,
  getPaymentContextualError,
  goToCheckoutSuccess,
  parseStripeConfig,
  useComplianceFeatures,
  useCreateCheckoutSession,
} from "@oc/api-client";
import { CreditCard, ShieldCheck } from "@oc/icons";
import type {
  ApiResponse,
  PaymentConfigResponse,
  PaymentProviderInfo,
  StripePublicConfig,
} from "@oc/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { CheckoutErrorBanner } from "@/components/checkout/CheckoutErrorBanner";
import type { CheckoutProviderPanelProps } from "@/components/checkout/providers/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, type TranslationKey, useTranslation } from "@/lib/i18n";
import { StripeCheckoutUI, StripeProvider } from "./index";
import type { StripeCheckoutCart } from "./types";

const STRIPE_SESSION_ERROR_KEYS: Record<string, TranslationKey> = {
  AUTH_FAILED: "checkout.stripeSessionAuthFailed",
  RATE_LIMITED: "checkout.stripeSessionRateLimited",
  INVALID_REQUEST: "checkout.stripeSessionInvalidRequest",
  INVALID_INTENT: "checkout.stripeSessionInvalidIntent",
  TIMEOUT: "checkout.stripeSessionTimeout",
  NETWORK: "checkout.stripeSessionNetwork",
};

interface StripeCheckoutProps extends CheckoutProviderPanelProps {
  cart: StripeCheckoutCart;
  isFormValid: boolean;
  onBeforePayment?: () => Promise<void>;
  onPaymentError?: (error: { message: string; code?: string }) => void;
  onProcessingChange?: (processing: boolean) => void;
  configResponse?: ApiResponse<PaymentConfigResponse>;
  providersResponse?: ApiResponse<PaymentProviderInfo[]>;
  configError?: Error | null;
  compliance?: { dob?: string };
}

function StripeCheckoutLoading() {
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

      <Button type="button" disabled className="h-14 w-full rounded-xl text-sm">
        <span className="flex items-center gap-2">
          <Spinner size="sm" />
          {t("checkout.loadingPayment")}
        </span>
      </Button>
    </div>
  );
}

export function StripeCheckout({
  cart,
  isLoading,
  isFormValid,
  isActive = true,
  onBeforePayment,
  onPaymentError,
  onProcessingChange,
  configResponse,
  providersResponse,
  configError,
  compliance,
}: StripeCheckoutProps) {
  const { t, locale } = useTranslation();
  const features = useComplianceFeatures();
  const createSession = useCreateCheckoutSession();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const stripeConfig = useMemo(
    () => parseStripeConfig(configResponse?.data) as StripePublicConfig | undefined,
    [configResponse?.data]
  );

  const stripeProvider = providersResponse?.data?.find((p) => p.id === "stripe");
  const isStripeEnabled = stripeProvider?.enabled === true;
  const env = stripeConfig?.environment ?? "test";
  const canRenderCheckout = Boolean(stripeConfig?.publishableKey && isStripeEnabled);

  const unavailableReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!isStripeEnabled) {
      reasons.push("Stripe is disabled in payment settings");
    }
    if (!stripeConfig?.publishableKey) {
      reasons.push("Stripe publishable key is not configured");
    }
    return reasons;
  }, [isStripeEnabled, stripeConfig?.publishableKey]);

  const handleCreateSession = useCallback(async () => {
    if (!isActive || !isFormValid || sessionId || createSession.isPending || creatingRef.current) {
      return;
    }

    creatingRef.current = true;
    setSubmitError(null);
    try {
      if (onBeforePayment) await onBeforePayment();
      if (!isActiveRef.current) {
        return;
      }
      const res = await createSession.mutateAsync({
        provider: "stripe",
        contact: cart.contact,
        shipping: cart.shipping,
        cartId: cart.cartId ?? undefined,
        ...(cart.applySiteCredit ? { applySiteCredit: true } : {}),
        ...(compliance?.dob ? { compliance: { dob: compliance.dob } } : {}),
      });
      const nextSessionId = res.data?.sessionId;
      const nextOrderId = res.data?.orderId;
      if (!nextSessionId || !nextOrderId) {
        throw new Error(t("checkout.cardPaymentStartError"));
      }
      if (!isActiveRef.current) {
        return;
      }
      setSessionId(nextSessionId);
      setOrderId(nextOrderId);
      onPaymentError?.({ message: "", code: "" });
    } catch (err: unknown) {
      let message = t("checkout.cardPaymentStartError");
      let code: string | undefined;
      if (err instanceof Error && err.name === ApiResponseError.name) {
        const apiErr = err as ApiResponseError;
        code = apiErr.code;
        const errorKey = code ? STRIPE_SESSION_ERROR_KEYS[code] : null;
        message = errorKey
          ? t(errorKey)
          : getPaymentContextualError(err, t("checkout.cardPaymentStartError"), features).message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setSubmitError(message);
    } finally {
      creatingRef.current = false;
    }
  }, [
    isActive,
    isFormValid,
    sessionId,
    createSession,
    onBeforePayment,
    onPaymentError,
    cart.cartId,
    cart.contact,
    cart.shipping,
    compliance?.dob,
    features,
    t,
  ]);

  const handleSuccess = useCallback(() => {
    if (isActiveRef.current && sessionId && orderId) {
      goToCheckoutSuccess({
        provider: "stripe",
        sessionId,
        orderId,
        navigate: (path: string) => navigate(path, { overwriteLastHistoryEntry: true }),
      });
    }
  }, [sessionId, orderId]);

  useEffect(() => {
    if (!isActive) {
      setSessionId(null);
      setOrderId(null);
      setSubmitError(null);
    }
  }, [isActive]);

  if (isActive === false) {
    return null;
  }

  if (isLoading) {
    return <StripeCheckoutLoading />;
  }

  if (configError) {
    return <CheckoutErrorBanner error={{ message: t("checkout.configLoadError") }} />;
  }

  if (!canRenderCheckout) {
    return (
      <CheckoutErrorBanner
        error={{
          code: "PROVIDER_UNAVAILABLE",
          message: t("checkout.cardUnavailable"),
        }}
      />
    );
  }

  const publishableKey = stripeConfig?.publishableKey;
  if (!publishableKey) {
    return <CheckoutErrorBanner error={{ message: t("checkout.cardUnavailable") }} />;
  }

  if (submitError) {
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
        <CheckoutErrorBanner
          error={{ message: submitError }}
          onRetry={() => {
            setSubmitError(null);
          }}
        />
      </div>
    );
  }

  if (!sessionId || !orderId) {
    const payButtonDisabled = !isFormValid || createSession.isPending;
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
          onClick={() => void handleCreateSession()}
          disabled={payButtonDisabled}
          className="h-14 w-full rounded-xl text-sm"
          data-testid="stripe-pay-button"
        >
          {createSession.isPending ? (
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

        {!isFormValid ? (
          <p className="text-xs text-muted-foreground">{t("checkout.payDetailsRequired")}</p>
        ) : null}
      </div>
    );
  }

  return (
    <StripeProvider clientId={publishableKey} clientSecret={sessionId}>
      <StripeCheckoutUI
        environment={env}
        sessionId={sessionId}
        orderId={orderId}
        total={cart.total}
        onSuccess={handleSuccess}
        onProcessingChange={onProcessingChange}
        onResetSession={() => {
          setSessionId(null);
          setOrderId(null);
        }}
      />
    </StripeProvider>
  );
}
