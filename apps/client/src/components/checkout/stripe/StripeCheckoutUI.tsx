"use client";

import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripePaymentElementOptions } from "@stripe/stripe-js";
import { useCallback, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, useTranslation } from "@/lib/i18n";

interface StripeCheckoutUIProps {
  environment: "test" | "live";
  sessionId: string;
  orderId: string;
  total: number;
  onSuccess: () => void;
  onProcessingChange?: (processing: boolean) => void;
  onResetSession?: () => void;
}

export function StripeCheckoutUI({
  environment,
  sessionId,
  orderId,
  total,
  onSuccess,
  onProcessingChange,
  onResetSession,
}: StripeCheckoutUIProps) {
  const { t, locale } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [isElementReady, setIsElementReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processingRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (!stripe || !elements || processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);
    onProcessingChange?.(true);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setIsProcessing(false);
      processingRef.current = false;
      onProcessingChange?.(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?provider=stripe&session_id=${sessionId}&order_id=${orderId}`,
      },
      redirect: "if_required",
    });

    if (error) {
      setIsProcessing(false);
      processingRef.current = false;
      onProcessingChange?.(false);
      setErrorMessage(error.message ?? t("checkout.paymentError"));
      return;
    }

    onProcessingChange?.(false);
    onSuccess();
  }, [stripe, elements, sessionId, orderId, onSuccess, onProcessingChange, t]);

  // Fires for any Payment Element load failure  -  a canceled or already-paid
  // intent, a key/environment mismatch, a network fault. Reporting all of them
  // as "expired" hid the real cause, so surface Stripe's own message and log
  // the underlying error.
  const handleLoadError = useCallback(
    (event?: { error?: { message?: string; code?: string; type?: string } }) => {
      const stripeError = event?.error;
      setIsSessionExpired(true);
      setErrorMessage(stripeError?.message ?? t("checkout.stripeSessionLoadError"));
    },
    [t]
  );

  const paymentElementOptions: StripePaymentElementOptions = {
    layout: "tabs",
    wallets: {
      applePay: "auto",
      googlePay: "auto",
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{environment === "live" ? "Live" : "Test"} mode</Badge>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-2">
            <span>{errorMessage}</span>
            {isSessionExpired && onResetSession ? (
              <button
                type="button"
                onClick={onResetSession}
                className="w-fit text-sm font-medium text-gold underline underline-offset-2 hover:text-gold-light cursor-pointer"
              >
                {t("checkout.stripeStartOver")}
              </button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <PaymentElement
        options={paymentElementOptions}
        onReady={() => setIsElementReady(true)}
        onLoadError={handleLoadError}
      />

      <Button
        onClick={handleSubmit}
        disabled={!stripe || !elements || !isElementReady || isProcessing}
        className="w-full"
        size="lg"
        data-testid="stripe-pay-button"
        data-umami-event="checkout:stripe-pay"
        data-umami-event-amount={total.toFixed(2)}
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <Spinner size="sm" />
            {t("checkout.processingPayment")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {t("checkout.payWithCard", { amount: formatCurrency(total, locale) })}
          </span>
        )}
      </Button>
    </div>
  );
}
