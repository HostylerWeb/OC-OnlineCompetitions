"use client";

import { Wallet } from "@oc/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, useTranslation } from "@/lib/i18n";

interface SiteCreditFullCheckoutProps {
  isFormValid: boolean;
  pending?: boolean;
  siteCreditApplied: number;
  currency?: string;
  onPay: () => void;
}

export function SiteCreditFullCheckout({
  isFormValid,
  pending,
  siteCreditApplied,
  currency = "GBP",
  onPay,
}: SiteCreditFullCheckoutProps) {
  const { t, locale } = useTranslation();
  const disabled = !isFormValid || pending === true;

  return (
    <div className="flex flex-col gap-4" data-testid="site-credit-full-checkout">
      <p className="text-sm text-muted-foreground">{t("checkout.siteCredit.fullPayDescription")}</p>
      <Button
        type="button"
        variant="gold"
        onClick={onPay}
        disabled={disabled}
        className="h-14 w-full rounded-xl text-base"
        data-umami-event="checkout:site-credit-full-pay"
      >
        {pending ? (
          <>
            <Spinner size="sm" className="text-black" aria-hidden />
            {t("checkout.siteCredit.processing")}
          </>
        ) : (
          <>
            <Wallet className="size-4 text-black" aria-hidden />
            {t("checkout.siteCredit.payWithCredit", {
              amount: formatCurrency(siteCreditApplied, locale, currency),
            })}
          </>
        )}
      </Button>
    </div>
  );
}
