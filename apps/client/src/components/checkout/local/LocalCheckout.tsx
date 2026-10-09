"use client";

import { Sparkles } from "@oc/icons";
import type { CheckoutProviderPanelProps } from "@/components/checkout/providers/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, useTranslation } from "@/lib/i18n";

export interface LocalCheckoutProps extends CheckoutProviderPanelProps {
  cart: { total: number };
  isFormValid: boolean;
  onLocalBypass?: () => void;
  localBypassPending?: boolean;
}

export function LocalCheckout({
  cart,
  isFormValid,
  isActive = true,
  onLocalBypass,
  localBypassPending,
}: LocalCheckoutProps) {
  const { t, locale } = useTranslation();

  if (isActive === false) {
    return null;
  }
  const disabled = !isFormValid || localBypassPending === true;
  const amount = cart.total;

  return (
    <div className="flex flex-col gap-4" data-testid="local-checkout">
      {!isFormValid ? (
        <Alert>
          <AlertDescription>{t("checkout.localBypass.formInvalidAlert")}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        variant="gold"
        onClick={onLocalBypass}
        disabled={disabled}
        className="h-14 w-full rounded-xl text-base"
        data-testid="local-bypass-button"
        data-umami-event="checkout:local-complete"
        data-umami-event-amount={amount.toFixed(2)}
      >
        {localBypassPending ? (
          <>
            <Spinner size="sm" className="text-black" aria-hidden />
            {t("checkout.localBypass.processing")}
          </>
        ) : (
          <>
            <Sparkles className="size-4 text-black" aria-hidden />
            {t("checkout.localBypass.completeOrder", { amount: formatCurrency(amount, locale) })}
          </>
        )}
      </Button>
    </div>
  );
}
