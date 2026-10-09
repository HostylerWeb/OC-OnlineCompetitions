"use client";

import {
  useAuth,
  useCartDiscount,
  useCartItems,
  useCartTotals,
  useCartWallet,
  useMyProfile,
} from "@oc/api-client";
import { AlertTriangle, Lock, ShieldCheck } from "@oc/icons";
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";
import { PricingBreakdown } from "./PricingBreakdown";
import { WalletTicketsPanel } from "./WalletTicketsPanel";

export const OrderSummary = memo(function OrderSummary() {
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
          discountRequiresAuth={discountRequiresAuthValue && isGuest ? true : undefined}
        />

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

        <Separator />

        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/20">
          <AlertTriangle className="size-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-xs text-foreground">{t("checkout.skillBased")}</p>
            <p className="text-xs text-muted-foreground">
              {t("checkout.age18plus")}{" "}
              <a
                href="tel:08088020133"
                className="text-gold hover:underline"
                data-umami-event="checkout:gamcare-phone"
              >
                {t("checkout.gamCarePhone")}
              </a>{" "}
              {t("checkout.orVisit")}{" "}
              <a
                href="https://www.begambleaware.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
                data-umami-event="checkout:begambleaware-link"
              >
                {t("checkout.beGambleAware")}
              </a>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
