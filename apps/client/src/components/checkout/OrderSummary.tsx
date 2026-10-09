"use client";

import {
  useApplyCartDiscount,
  useAuth,
  useCartDiscount,
  useCartItems,
  useCartTotals,
  useCartWallet,
  useMyProfile,
  useRemoveCartDiscount,
} from "@oc/api-client";
import { Lock, ShieldCheck } from "@oc/icons";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { showContextualErrorToast } from "@/lib/contextual-error-toast";
import { useTranslation } from "@/lib/i18n";
import { PricingBreakdown } from "./PricingBreakdown";
import { WalletTicketsPanel } from "./WalletTicketsPanel";

export type OrderSummaryProps = {
  applySiteCredit?: boolean;
  siteCreditApplied?: number;
  gatewayDue?: number;
  siteCreditCurrency?: string;
};

export const OrderSummary = memo(function OrderSummary({
  applySiteCredit = false,
  siteCreditApplied = 0,
  gatewayDue,
  siteCreditCurrency = "GBP",
}: OrderSummaryProps = {}) {
  const { t } = useTranslation();
  const { user, isAnonymous } = useAuth();
  const isGuest = user?.isAnonymous ?? isAnonymous;
  const { data: profileResponse } = useMyProfile({ enabled: !!user && !isAnonymous });
  const profile = profileResponse?.data;
  const profileReferralCode = profile?.referredByCode ?? null;
  const isFirstOrder = (profile?.completedOrderCount ?? 0) === 0;

  const { data: items = [], isPending: cartPending } = useCartItems({ enabled: !!user });
  const showCartPlaceholder = cartPending && items.length === 0;
  const { data: totals = { subtotal: 0, monetarySubtotal: 0, total: 0, walletTicketsTotal: 0 } } =
    useCartTotals({ enabled: !!user });
  const {
    data: discount = {
      promoCode: null,
      pendingReferralCode: null,
      referralDiscountAmount: null,
      referralDiscountPercent: null,
      referralLocked: false,
      discountType: null,
      discountAmount: 0,
      discountRequiresAuth: false,
    },
  } = useCartDiscount({ enabled: !!user });
  const {
    data: wallet = { allocations: [], balance: 0, ticketsTotal: 0, discountAmount: 0, savings: 0 },
  } = useCartWallet({ enabled: !!user });

  const { subtotal, total } = totals;
  const {
    promoCode,
    discountAmount: promoDiscountAmount,
    discountType,
    promoDiscountPercent,
  } = discount;
  const {
    pendingReferralCode,
    referralDiscountPercent: pendingReferralDiscountPercent,
    referralLocked,
  } = discount;
  const { ticketsTotal: walletTicketsTotal, discountAmount: walletDiscountAmount } = wallet;

  const showLockedReferral =
    isFirstOrder &&
    Boolean(profileReferralCode) &&
    (referralLocked || pendingReferralCode === profileReferralCode);
  const referralApplying =
    isFirstOrder && Boolean(profileReferralCode) && !pendingReferralCode && !promoCode;
  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const applyDiscount = useApplyCartDiscount();
  const removeDiscount = useRemoveCartDiscount();
  const appliedCode = pendingReferralCode ?? promoCode;

  function handleApplyDiscount() {
    if (!discountInput.trim()) return;
    setDiscountError(null);
    applyDiscount.mutate(
      { code: discountInput },
      {
        onSuccess: (res) => {
          if (res?.data?.valid && res.data.code) {
            setDiscountInput("");
          } else {
            setDiscountError(res?.data?.error ?? t("cart.toasts.invalidCode"));
          }
        },
        onError: (err) => showContextualErrorToast(err, t("cart.toasts.failedToApply")),
      }
    );
  }

  if (showCartPlaceholder) {
    return (
      <Card className="border-gold/20 sticky top-8">
        <CardHeader>
          <div className="h-5 w-36 bg-gold/10 rounded-lg" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="h-4 w-full bg-gold/10 rounded-lg" />
            <div className="h-4 w-3/4 bg-gold/10 rounded-lg" />
            <div className="h-4 w-1/2 bg-gold/10 rounded-lg" />
          </div>
          <div className="h-px bg-border/60" />
          <div className="h-5 w-1/3 bg-gold/10 rounded-lg" />
          <div className="h-px bg-border/60" />
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
            <div className="size-5 rounded-full bg-gold/10" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-24 bg-gold/10 rounded-lg" />
              <div className="h-2.5 w-48 bg-gold/10 rounded-lg" />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
            <div className="size-5 rounded-full bg-gold/10" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-28 bg-gold/10 rounded-lg" />
              <div className="h-2.5 w-40 bg-gold/10 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const discountRequiresAuthValue = discount.discountRequiresAuth ?? false;
  const displayTotal = discountRequiresAuthValue && isGuest ? subtotal : total;

  return (
    <Card className="border-gold/20 sticky top-8">
      <CardHeader>
        <CardTitle className="text-balance">{t("checkout.orderSummary")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <WalletTicketsPanel />
        <PricingBreakdown
          items={items}
          subtotal={subtotal}
          total={displayTotal}
          promoCode={promoCode}
          promoDiscountAmount={promoDiscountAmount}
          discountType={discountType}
          promoDiscountPercent={promoDiscountPercent}
          referralCode={pendingReferralCode}
          referralDiscountPercent={pendingReferralDiscountPercent}
          walletTicketsTotal={walletTicketsTotal}
          walletDiscountAmount={walletDiscountAmount}
          siteCreditApplied={applySiteCredit ? siteCreditApplied : 0}
          gatewayDue={applySiteCredit ? gatewayDue : undefined}
          siteCreditCurrency={siteCreditCurrency}
          discountRequiresAuth={discountRequiresAuthValue && isGuest ? true : undefined}
        />

        {appliedCode && !showLockedReferral ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-gold/20 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {pendingReferralCode ? t("cart.referralApplied") : t("cart.promoApplied")}
              </p>
              <p className="truncate text-sm font-semibold uppercase">{appliedCode}</p>
            </div>
            {!referralLocked ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  removeDiscount.mutate(undefined, {
                    onError: (err) =>
                      showContextualErrorToast(err, t("cart.toasts.failedToRemove")),
                  })
                }
                disabled={removeDiscount.isPending}
              >
                {t("cart.remove")}
              </Button>
            ) : null}
          </div>
        ) : !showLockedReferral && !referralApplying ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder={t("cart.discountCode")}
                value={discountInput}
                disabled={applyDiscount.isPending}
                onChange={(e) => {
                  setDiscountInput(e.target.value.toUpperCase());
                  setDiscountError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyDiscount();
                }}
                className="h-9 font-medium uppercase tracking-wide"
                aria-invalid={Boolean(discountError)}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={applyDiscount.isPending || !discountInput.trim()}
                onClick={handleApplyDiscount}
              >
                {applyDiscount.isPending ? t("cart.applying") : t("cart.apply")}
              </Button>
            </div>
            {discountError ? <p className="text-xs font-medium text-red-500">{discountError}</p> : null}
          </div>
        ) : null}

        {showLockedReferral ? (
          <div className="space-y-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("cart.referralDiscountApplied")}</p>
            <Input
              value={profileReferralCode ?? ""}
              disabled
              className="h-8 font-semibold text-green-400 uppercase"
            />
            <p className="text-xs text-muted-foreground">
              {t("cart.referralDiscountDesc", { percent: pendingReferralDiscountPercent ?? 0 })}
            </p>
          </div>
        ) : referralApplying ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <Spinner size="xs" className="text-muted-foreground" aria-hidden />
            {t("cart.applying")}
          </p>
        ) : null}

        <Separator />

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
            <ShieldCheck className="size-5 text-gold flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-foreground">{t("checkout.securePayment")}</p>
              <p className="text-xs text-muted-foreground">{t("checkout.securePaymentDesc")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
            <Lock className="size-5 text-gold flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-foreground">
                {t("checkout.encryptedProtected")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("checkout.encryptedProtectedDesc")}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
