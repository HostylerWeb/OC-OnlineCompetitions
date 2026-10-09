"use client";

import { Ticket } from "@oc/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";

interface FreeCheckoutProps {
  isFormValid: boolean;
  onLocalBypass?: () => void;
  localBypassPending?: boolean;
}

export function FreeCheckout({
  isFormValid,
  onLocalBypass,
  localBypassPending,
}: FreeCheckoutProps) {
  const { t } = useTranslation();
  const disabled = !isFormValid || localBypassPending === true;

  return (
    <div className="flex flex-col gap-4" data-testid="free-checkout">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-gold/40 bg-gold/10 text-gold uppercase tracking-wide text-[10px] font-semibold"
        >
          {t("checkout.freeEntry.badge")}
        </Badge>
        {!isFormValid ? (
          <Badge variant="secondary">{t("checkout.freeEntry.fillFieldsFirst")}</Badge>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{t("checkout.freeEntry.description")}</p>

      <Button
        type="button"
        variant="gold"
        onClick={onLocalBypass}
        disabled={disabled}
        className="h-14 w-full rounded-xl text-base"
        data-testid="free-entry-button"
        data-umami-event="checkout:free-entry-complete"
      >
        {localBypassPending ? (
          <>
            <Spinner size="sm" className="text-black" aria-hidden />
            {t("checkout.freeEntry.processing")}
          </>
        ) : (
          <>
            <Ticket className="size-4 text-black" aria-hidden />
            {t("checkout.freeEntry.complete")}
          </>
        )}
      </Button>
    </div>
  );
}
