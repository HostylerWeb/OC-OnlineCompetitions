"use client";

import {
  getAuthRedirectPath,
  parseRefFromSearch,
  queryKeys,
  useApplyCartDiscount,
  useAuth,
  useCartAutoAdjustments,
  useCartDiscount,
  useCartItems,
  useCartOrchestrator,
  useCartTotals,
  useCartUiStore,
  useCartWallet,
  useCompetitionsBuyingPower,
  useComplianceFeatures,
  useIsApplyingCartMutation,
  useMyProfile,
  useRemoveCartDiscount,
} from "@oc/api-client";
import {
  AlertTriangle,
  ArrowRight,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Trophy,
} from "@oc/icons";
import type { ApiResponse, CartAdjustment, ICart } from "@oc/types";
import { cn, getMaxCartQuantity } from "@oc/utils";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { navigate } from "vike/client/router";
import { useData } from "vike-react/useData";
import { usePageContext } from "vike-react/usePageContext";
import { withFallback } from "vike-react-query";
import { GoldButton, GoldOutlineButton } from "@/components/buttons";
import { PricingBreakdown } from "@/components/checkout/PricingBreakdown";
import { ReferralWalletTicketControls } from "@/components/checkout/ReferralWalletTicketControls";
import { FeaturedCompetitionsSection } from "@/components/home/FeaturedCompetitionsSection";
import { PageActionButtons } from "@/components/layout/PageActionButtons";
import { useConsumeQueryParams } from "@/components/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FocusReasonBanner, useFocusFromQuery } from "@/hooks/useFocusFromQuery";
import { showContextualErrorToast } from "@/lib/contextual-error-toast";
import { formatCurrency, formatNumber, localeHref, useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";

function describeAdjustment(
  adj: CartAdjustment,
  t: ReturnType<typeof useTranslation>["t"]
): string {
  switch (adj.reason) {
    case "availability":
      return t("cart.adjustmentReasons.availability", {
        n: formatNumber(adj.adjustedQuantity),
        prev: String(adj.previousQuantity),
      });
    case "max_per_user":
      return t("cart.adjustmentReasons.maxPerUser");
    case "wallet_reclamp":
      return t("cart.adjustmentReasons.walletReclamp", {
        title: adj.competitionTitle,
        n: String(adj.adjustedQuantity),
      });
    case "competition_ended":
      return t("cart.adjustmentReasons.competitionEnded", { title: adj.competitionTitle });
    default:
      return adj.message;
  }
}

function CartChangeSummaryBanner({
  adjustments,
  onDismiss,
}: {
  adjustments: CartAdjustment[];
  onDismiss: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  if (adjustments.length === 0) return null;
  const ids = adjustments.map((a) => a.id).filter((id): id is string => Boolean(id));
  return (
    <Alert className="border-amber-500/30 bg-amber-500/10">
      <AlertTriangle className="size-4 text-amber-500 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <AlertTitle className="text-sm font-medium">
          {t("cart.itemsChangedTitle", {
            n: adjustments.length,
          })}
        </AlertTitle>
        <AlertDescription className="mt-1.5 space-y-1.5">
          {adjustments.map((adj) => (
            <p key={adj.id} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{adj.competitionTitle}</span>
              {": "}
              {describeAdjustment(adj, t)}
            </p>
          ))}
        </AlertDescription>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(ids)}
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground self-start"
        data-umami-event="cart:dismiss-adjustment"
      >
        {t("common.dismiss")}
      </button>
    </Alert>
  );
}

function AnimatedQuantity({
  value,
  snapBack,
}: {
  value: number;
  snapBack?: { from: number; to: number };
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const end = snapBack?.to ?? value;
    const start = snapBack?.from ?? prevRef.current;

    if (start === end) {
      if (prevRef.current !== value) prevRef.current = value;
      setDisplay(end);
      return;
    }

    const duration = snapBack ? 600 : 200;
    const t0 = performance.now();

    function tick(now: number) {
      const t = Math.min((now - t0) / duration, 1);
      const ease = 1 - (1 - t) ** 3;
      setDisplay(Math.round(start + (end - start) * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    prevRef.current = end;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, snapBack]);

  return <>{display.toLocaleString("en-GB")}</>;
}

function SnapBackPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold animate-fadeInScale whitespace-nowrap">
      {label}
    </span>
  );
}

function CartLoadingFallback() {
  return (
    <main className="flex-1 oc-container-content py-5 lg:py-8 animate-pulse">
      <div className="h-9 w-40 bg-gold/10 rounded-lg mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="border border-border/60 rounded-xl p-4 flex flex-col sm:flex-row gap-4"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gold/10 flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-3/5 bg-gold/10 rounded-lg" />
                <div className="h-4 w-1/4 bg-gold/10 rounded-lg" />
                <div className="flex items-center gap-2 mt-3">
                  <div className="h-8 w-8 rounded-md bg-gold/10" />
                  <div className="h-8 w-16 rounded-md bg-gold/10" />
                  <div className="h-8 w-8 rounded-md bg-gold/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="border border-border/60 rounded-xl p-5 space-y-3">
            <div className="h-5 w-2/3 bg-gold/10 rounded-lg" />
            <div className="h-4 w-1/2 bg-gold/10 rounded-lg" />
            <div className="h-4 w-3/5 bg-gold/10 rounded-lg" />
            <div className="h-px bg-border/60 my-2" />
            <div className="h-5 w-1/3 bg-gold/10 rounded-lg" />
            <div className="h-10 w-full rounded-lg bg-gold/10 mt-4" />
          </div>
        </div>
      </div>
    </main>
  );
}

function CartView() {
  const { t, locale } = useTranslation();
  const pageContext = usePageContext();
  const { user: authUser, isAnonymous } = useAuth();
  const user = authUser ?? pageContext.user;
  const isGuest = user?.isAnonymous ?? isAnonymous;
  const data = useData<Data>();
  const initialFeatured = data?.featuredCompetitions?.length
    ? { data: data.featuredCompetitions }
    : undefined;
  const initialCategories = data?.categories?.length ? { data: data.categories } : undefined;
  const { data: profileResponse } = useMyProfile({ enabled: !!user && !isAnonymous });
  const profile = profileResponse?.data;
  const isFirstOrder = (profile?.completedOrderCount ?? 0) === 0;
  const profileReferralCode = profile?.referredByCode ?? null;

  const cartInitialData = pageContext.cartInitialData ?? undefined;
  const cartOpts = { initialData: cartInitialData, enabled: !!user };

  const itemsQuery = useCartItems(cartOpts);
  const items = itemsQuery.data ?? [];

  const hasFeaturedCompetitions = (data?.featuredCompetitions?.length ?? 0) > 0;

  const totalsQuery = useCartTotals(cartOpts);
  const subtotal = totalsQuery.data?.subtotal ?? 0;
  const total = totalsQuery.data?.total ?? 0;
  const walletTicketsTotal = totalsQuery.data?.walletTicketsTotal ?? 0;

  const features = useComplianceFeatures();
  const orderValueBlocked =
    (total === 0 && !features.allowZeroSubtotalOrders) ||
    (features.minimumOrderValue > 0 && total < features.minimumOrderValue);
  const orderValueMessage =
    total === 0
      ? t("cart.zeroTotalError")
      : t("cart.minimumOrderError", {
          min: formatCurrency(features.minimumOrderValue, locale),
        });

  const walletQuery = useCartWallet(cartOpts);
  const walletDiscountAmount = walletQuery.data?.discountAmount ?? 0;

  const discountQuery = useCartDiscount(cartOpts);
  const promoCode = discountQuery.data?.promoCode ?? null;
  const promoDiscountAmount = discountQuery.data?.discountAmount ?? 0;
  const discountType = discountQuery.data?.discountType ?? null;
  const promoDiscountPercent = discountQuery.data?.promoDiscountPercent ?? null;
  const pendingReferralCode = discountQuery.data?.pendingReferralCode ?? null;
  const pendingReferralDiscountPercent = discountQuery.data?.referralDiscountPercent ?? null;
  const referralLocked = discountQuery.data?.referralLocked ?? false;
  const discountRequiresAuth = discountQuery.data?.discountRequiresAuth ?? false;

  const autoAdjustmentsQuery = useCartAutoAdjustments(cartOpts);
  const autoAdjustments = autoAdjustmentsQuery.data ?? [];

  const isApplyingMutation = useIsApplyingCartMutation();
  const isCartFetching = useIsFetching({ queryKey: queryKeys.cart() }) > 0;

  const dismissAdjustment = useCartUiStore((s) => s.dismissAdjustment);
  const isDismissed = useCartUiStore((s) => s.isDismissed);
  const clearDismissed = useCartUiStore((s) => s.clearDismissed);
  const lastDiscountError = useCartUiStore((s) => s.lastDiscountError);
  const _lastDiscountSuccess = useCartUiStore((s) => s.lastDiscountSuccess);
  const setDiscountError = useCartUiStore((s) => s.setDiscountError);
  const setDiscountSuccess = useCartUiStore((s) => s.setDiscountSuccess);

  const [discountInput, setDiscountInput] = useState("");

  const applyDiscount = useApplyCartDiscount();
  const removeDiscount = useRemoveCartDiscount();

  const qc = useQueryClient();

  const {
    snapBacks,
    updateQuantity: orchestratorUpdateQuantity,
    removeItem: orchestratorRemoveItem,
  } = useCartOrchestrator();

  const focusSections = useMemo(
    () => [{ key: "items" }, { key: "wallet", autofocusSelector: "[data-focus='wallet']" }],
    []
  );

  const { reasonBanner, dismissReasonBanner } = useFocusFromQuery({
    sections: focusSections,
    isReady: !itemsQuery.isPending,
  });

  const showLockedReferral =
    isFirstOrder &&
    Boolean(profileReferralCode) &&
    (referralLocked || pendingReferralCode === profileReferralCode);

  const referralApplying =
    isFirstOrder &&
    Boolean(profileReferralCode) &&
    !pendingReferralCode &&
    !promoCode &&
    !itemsQuery.isPending;

  const uniqueIds = [...new Set(items.map((i) => i.competitionId))];
  const { data: buyingPower, isLoading: buyingPowerLoading } =
    useCompetitionsBuyingPower(uniqueIds);

  const hasUnavailableItems = useMemo(
    () =>
      items.some((item) => {
        const bp = buyingPower?.[item.competitionId];
        if (!bp) return false;
        return (
          getMaxCartQuantity({
            liveAvailable: bp.available,
            maxPerUser: bp.maxPerUser,
            userOwned: bp.userOwned,
            currentInCart: item.quantity,
          }) <= 0
        );
      }),
    [items, buyingPower]
  );

  const hasReducedItems = useMemo(
    () =>
      items.some((item) => {
        const bp = buyingPower?.[item.competitionId];
        if (!bp) return false;
        const maxTotal = getMaxCartQuantity({
          liveAvailable: bp.available,
          maxPerUser: bp.maxPerUser,
          userOwned: bp.userOwned,
          currentInCart: item.quantity,
        });
        return maxTotal > 0 && item.quantity > maxTotal;
      }),
    [items, buyingPower]
  );

  const unavailableItemNames = useMemo(
    () =>
      items
        .filter((item) => {
          const bp = buyingPower?.[item.competitionId];
          if (!bp) return false;
          return (
            getMaxCartQuantity({
              liveAvailable: bp.available,
              maxPerUser: bp.maxPerUser,
              userOwned: bp.userOwned,
              currentInCart: item.quantity,
            }) <= 0
          );
        })
        .map((item) => item.competitionTitle),
    [items, buyingPower]
  );

  const reducedItemDetails = useMemo(
    () =>
      items
        .filter((item) => {
          const bp = buyingPower?.[item.competitionId];
          if (!bp) return false;
          const maxTotal = getMaxCartQuantity({
            liveAvailable: bp.available,
            maxPerUser: bp.maxPerUser,
            userOwned: bp.userOwned,
            currentInCart: item.quantity,
          });
          return maxTotal > 0 && item.quantity > maxTotal;
        })
        .map((item) => {
          const bp = buyingPower![item.competitionId]!;
          const maxTotal = getMaxCartQuantity({
            liveAvailable: bp.available,
            maxPerUser: bp.maxPerUser,
            userOwned: bp.userOwned,
            currentInCart: item.quantity,
          });
          return {
            title: item.competitionTitle,
            available: maxTotal,
            quantity: item.quantity,
          };
        }),
    [items, buyingPower]
  );

  const visibleAdjustments = useMemo(
    () => autoAdjustments.filter((adj) => adj.id && !isDismissed(adj.id)),
    [autoAdjustments, isDismissed]
  );

  useConsumeQueryParams(["checkoutError"]);

  const hasAutoAppliedRef = useRef(false);

  useEffect(() => {
    if (hasAutoAppliedRef.current) return;
    if (!user || isGuest || isAnonymous) return;
    if (profileReferralCode) return;

    const urlRef = parseRefFromSearch(window.location.search);
    if (!urlRef) return;
    if (urlRef === pendingReferralCode) return;

    hasAutoAppliedRef.current = true;

    applyDiscount.mutate(
      { code: urlRef, codeType: "referral" },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: queryKeys.my.profile() });
        },
      }
    );
  }, [user, isGuest, isAnonymous, profileReferralCode, pendingReferralCode, applyDiscount, qc]);

  function handleUpdateQuantity(competitionId: string, quantity: number) {
    const snapshot = qc.getQueryData<ApiResponse<ICart>>(queryKeys.cart());
    if (snapshot?.data) {
      qc.setQueryData(queryKeys.cart(), {
        ...snapshot,
        data: {
          ...snapshot.data,
          items: (snapshot.data.items ?? []).map((item) =>
            item.competitionId === competitionId ? { ...item, quantity } : item
          ),
        },
      } satisfies ApiResponse<ICart>);
    }
    orchestratorUpdateQuantity(competitionId, quantity);
  }

  function handleRemoveItem(competitionId: string) {
    orchestratorRemoveItem(competitionId);
  }

  function handleApplyDiscount() {
    if (!discountInput.trim()) return;
    setDiscountError(null);
    setDiscountSuccess(false);

    applyDiscount.mutate(
      { code: discountInput },
      {
        onSuccess: (res) => {
          if (res?.data?.valid && res.data.code) {
            setDiscountSuccess(true);
            setDiscountInput("");
            clearDismissed();
            if (res.data.codeType === "referral") {
              toast.success(
                t("cart.toasts.referralApplied", {
                  amount: formatCurrency(res.data.discountAmount ?? 0, locale),
                })
              );
            } else if (res.data.codeType === "promo") {
              toast.success(
                t("cart.toasts.promoApplied", {
                  amount: formatCurrency(res.data.discountAmount ?? 0, locale),
                })
              );
            }
          } else {
            setDiscountError(res?.data?.error ?? t("cart.toasts.invalidCode"));
          }
        },
        onError: (err) => showContextualErrorToast(err, t("cart.toasts.failedToApply")),
      }
    );
  }

  function handleRemoveDiscount() {
    removeDiscount.mutate(undefined, {
      onError: (err) => showContextualErrorToast(err, t("cart.toasts.failedToRemove")),
    });
  }

  function handleDismissAdjustments(ids: string[]) {
    for (const id of ids) dismissAdjustment(id);
  }

  async function handleCheckout() {
    if (hasUnavailableItems) {
      toast.error(t("cart.toasts.removeUnavailable"));
      return;
    }

    if (!user) {
      const urlRef = parseRefFromSearch(window.location.search);
      const refCode = urlRef ?? profileReferralCode ?? pendingReferralCode;
      navigate(localeHref(getAuthRedirectPath({ refCode, returnTo: "/checkout" }), locale));
      return;
    }

    navigate(localeHref("/checkout", locale));
  }

  function handleGuestLogin() {
    const urlRef = parseRefFromSearch(window.location.search);
    const refCode = urlRef ?? profileReferralCode ?? pendingReferralCode;
    navigate(localeHref(getAuthRedirectPath({ refCode, returnTo: "/checkout" }), locale));
  }

  const isRefreshingAvailability = buyingPowerLoading || isApplyingMutation || isCartFetching;

  if (itemsQuery.isPending) {
    return <CartLoadingFallback />;
  }

  if (items.length === 0) {
    return (
      <main className="flex-1 oc-container-content py-5 lg:py-8" suppressHydrationWarning>
        <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center sm:px-6 lg:py-16">
          <div className="mb-6 inline-flex size-20 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/20">
            <ShoppingCart className="size-10 text-gold" />
          </div>
          <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t("cart.emptyTitle")}</h2>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground">
            {t("cart.emptyDescription")}
          </p>
          <PageActionButtons
            actions={
              hasFeaturedCompetitions
                ? [
                    {
                      label: t("cart.continueShopping"),
                      href: "/",
                      variant: "outline",
                      "data-umami-event": "cart:continue-shopping",
                    },
                  ]
                : [
                    {
                      label: t("cart.continueShopping"),
                      href: "/",
                      variant: "outline",
                      "data-umami-event": "cart:continue-shopping",
                    },
                    {
                      label: t("cart.browseAllCompetitions"),
                      href: "/competitions",
                      variant: "gold",
                      icon: ArrowRight,
                      iconPosition: "end",
                    },
                  ]
            }
          />
        </div>

        {hasFeaturedCompetitions ? (
          <FeaturedCompetitionsSection
            className="pt-4"
            initialFeatured={initialFeatured}
            initialCategories={initialCategories}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="flex-1 oc-container-content py-4 lg:py-8 relative">
      <div
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-gold/40 via-gold to-gold/40 transition-opacity duration-300 ${
          isRefreshingAvailability ? "opacity-100" : "opacity-0"
        }`}
      />
      <h1 className="text-lg lg:text-3xl font-bold tracking-tight mb-4 lg:mb-8">
        {t("cart.heading")}
      </h1>

      <FocusReasonBanner message={reasonBanner} onDismiss={dismissReasonBanner} />

      {visibleAdjustments.length > 0 && (
        <div className="mb-4">
          <CartChangeSummaryBanner
            adjustments={visibleAdjustments}
            onDismiss={handleDismissAdjustments}
          />
        </div>
      )}

      {hasUnavailableItems && (
        <Alert className="mb-4 border-red-500/30 bg-red-500/10">
          <AlertTriangle className="size-4 text-red-400 shrink-0" aria-hidden="true" />
          <AlertTitle className="text-sm font-medium text-red-400">
            {unavailableItemNames.length === 1
              ? t("cart.unavailableAlert.single", { name: unavailableItemNames[0]! })
              : t("cart.unavailableAlert.multiple", { n: unavailableItemNames.length })}
          </AlertTitle>
          <AlertDescription className="mt-1 text-xs text-red-400/80">
            {t("cart.unavailableAlert.description")}{" "}
            {unavailableItemNames.length <= 2
              ? t("cart.unavailableAlert.removeSingle")
              : t("cart.unavailableAlert.removeMultiple", { n: unavailableItemNames.length })}
          </AlertDescription>
        </Alert>
      )}

      {hasReducedItems && !hasUnavailableItems && (
        <Alert className="mb-4 border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="size-4 text-amber-500 shrink-0" aria-hidden="true" />
          <AlertTitle className="text-sm font-medium text-amber-500">
            {reducedItemDetails.length === 1
              ? t("cart.reducedAlert.single", { title: reducedItemDetails[0]?.title ?? "" })
              : t("cart.reducedAlert.multiple", { n: reducedItemDetails.length })}
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-1 text-xs text-amber-500/80">
            {reducedItemDetails.map((d) => (
              <p key={d.title}>
                {t("cart.reducedAlert.itemDesc", {
                  title: d.title,
                  n: formatNumber(d.available),
                  m: formatNumber(d.quantity),
                })}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
        <div className="lg:col-span-2 space-y-3 lg:space-y-4" data-focus="items">
          {items.map((item) => {
            const bp = buyingPower?.[item.competitionId];
            const limits = bp
              ? {
                  liveAvailable: bp.available,
                  maxPerUser: bp.maxPerUser,
                  userOwned: bp.userOwned,
                  currentInCart: item.quantity,
                }
              : null;
            const maxTotal = limits ? getMaxCartQuantity(limits) : Infinity;
            const isSoldOut = maxTotal <= 0;
            const isReduced = !isSoldOut && item.quantity > maxTotal;
            const isAtMax = !isSoldOut && item.quantity >= maxTotal;
            const canIncrease = !isSoldOut && item.quantity < maxTotal;

            const cardClass = isSoldOut
              ? "border-red-500/30 bg-red-500/5 opacity-75"
              : isReduced
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border/60 shadow-none";

            return (
              <Card key={item.competitionId} className={cardClass}>
                <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <div
                    className={cn(
                      "flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 sm:flex-1 min-w-0 transition-opacity duration-300",
                      isRefreshingAvailability && "animate-subtle-refresh"
                    )}
                    aria-busy={isRefreshingAvailability}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative w-14 h-14 sm:w-24 sm:h-24 rounded-lg sm:rounded-xl bg-gradient-to-br from-gold/10 to-gold/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.competitionTitle}
                            className="object-cover"
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <Trophy className="size-6 sm:size-7 text-primary/40" aria-hidden />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-sm sm:text-lg truncate leading-snug">
                                {item.competitionTitle}
                              </h3>
                              {item.competitionSlug && (
                                <a
                                  href={`/competitions/${item.competitionSlug}`}
                                  className="shrink-0 text-[11px] sm:text-xs text-gold/60 hover:text-gold transition-colors"
                                  data-umami-event="cart:view-competition"
                                  data-umami-event-id={item.competitionId}
                                >
                                  {t("common.view")}
                                </a>
                              )}
                            </div>
                            <p className="text-gold font-bold text-xs sm:text-base">
                              {(() => {
                                const op = (item as any).originalPrice;
                                return op != null && op > item.price ? (
                                  <>
                                    <span className="line-through text-muted-foreground mr-1.5">
                                      {formatCurrency(op, locale)}
                                    </span>
                                    {t("cart.perTicket", { n: formatCurrency(item.price, locale) })}
                                  </>
                                ) : (
                                  t("cart.perTicket", { n: formatCurrency(item.price, locale) })
                                );
                              })()}
                            </p>
                          </div>
                          <div className="text-right shrink-0 sm:hidden">
                            <p className="font-bold text-sm tabular-nums">
                              {formatCurrency(item.price * item.quantity, locale)}
                            </p>
                            {isSoldOut ? (
                              <p className="text-[10px] text-red-400/70 mt-0.5">
                                {t("cart.unavailable")}
                              </p>
                            ) : isAtMax && !isReduced ? (
                              <p className="text-[10px] text-gold/60 mt-0.5">
                                {t("cart.maxReached")}
                              </p>
                            ) : isReduced && !isSoldOut ? (
                              <p className="text-[10px] text-amber-500 mt-0.5 leading-snug">
                                {t("cart.limitLabel", { n: formatNumber(maxTotal) })}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    {isSoldOut ? (
                      <div className="flex flex-col gap-1.5 pl-[4.25rem] sm:pl-0">
                        <p className="text-xs text-red-400 font-medium">{t("cart.soldOutDesc")}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-transparent hover:text-red-400 w-fit h-8 px-2"
                          onClick={() => handleRemoveItem(item.competitionId)}
                          data-umami-event="cart:remove-item"
                          data-umami-event-id={item.competitionId}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {t("cart.removeFromCart")}
                        </Button>
                      </div>
                    ) : (
                      <div className="pl-[4.25rem] sm:pl-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <GoldOutlineButton
                              size="icon"
                              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full active:scale-95 transition-all"
                              onClick={() =>
                                handleUpdateQuantity(
                                  item.competitionId,
                                  Math.max(1, item.quantity - 1)
                                )
                              }
                              disabled={item.quantity <= 1}
                              data-umami-event="cart:quantity-decrement"
                              data-umami-event-id={item.competitionId}
                            >
                              <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </GoldOutlineButton>
                            <span className="w-9 sm:w-12 text-center font-semibold tabular-nums text-sm sm:text-base transition-all duration-200">
                              <AnimatedQuantity
                                value={item.quantity}
                                snapBack={snapBacks.get(item.competitionId)}
                              />
                            </span>
                            <GoldOutlineButton
                              size="icon"
                              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full active:scale-95 transition-all"
                              onClick={() =>
                                handleUpdateQuantity(
                                  item.competitionId,
                                  Math.min(maxTotal, item.quantity + 1)
                                )
                              }
                              disabled={!canIncrease || isReduced || buyingPowerLoading}
                              title={
                                isReduced
                                  ? t("cart.onlyAvailable", { n: formatNumber(maxTotal) })
                                  : isAtMax
                                    ? t("cart.maxTicketsReached")
                                    : undefined
                              }
                              data-umami-event="cart:quantity-increment"
                              data-umami-event-id={item.competitionId}
                            >
                              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </GoldOutlineButton>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-transparent hover:text-red-400 h-8 sm:h-10 px-2 sm:px-3"
                            onClick={() => handleRemoveItem(item.competitionId)}
                            data-umami-event="cart:remove-item"
                            data-umami-event-id={item.competitionId}
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                            <span className="hidden sm:inline">{t("cart.remove")}</span>
                          </Button>
                        </div>
                        {(() => {
                          const sb = snapBacks.get(item.competitionId);
                          return sb ? (
                            <div className="mt-1.5 animate-fadeInScale">
                              <SnapBackPill
                                label={t("cart.limitLabel", { n: formatNumber(sb.to) })}
                              />
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex sm:flex-col items-end justify-start gap-0 sm:min-w-[90px]">
                    <p className="font-bold text-lg tabular-nums">
                      {formatCurrency(item.price * item.quantity, locale)}
                    </p>
                    {isSoldOut ? (
                      <p className="text-[10px] text-red-400/70 mt-0.5">{t("cart.unavailable")}</p>
                    ) : isAtMax && !isReduced ? (
                      <p className="text-[10px] text-gold/60 mt-0.5">{t("cart.maxReached")}</p>
                    ) : null}
                    {isReduced && !isSoldOut && (
                      <p className="text-[10px] text-amber-500 mt-0.5 text-right leading-snug">
                        {t("cart.limitNowLabel", { n: formatNumber(maxTotal) })}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4" data-focus="wallet">
          <ReferralWalletTicketControls
            items={items.map((item) => ({
              competitionId: item.competitionId,
              competitionTitle: item.competitionTitle,
              quantity: item.quantity,
              maxPerLine: item.quantity,
            }))}
          />

          <Card className="border-gold/20 shadow-none">
            <CardHeader className="pb-3 px-3 lg:px-6">
              <CardTitle className="text-sm lg:text-lg">{t("cart.orderSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 lg:space-y-4 pt-0 px-3 lg:px-6">
              <PricingBreakdown
                items={items}
                subtotal={subtotal}
                total={total}
                promoCode={promoCode}
                promoDiscountAmount={promoDiscountAmount}
                discountType={discountType}
                promoDiscountPercent={promoDiscountPercent}
                referralCode={pendingReferralCode}
                referralDiscountPercent={pendingReferralDiscountPercent}
                walletTicketsTotal={walletTicketsTotal}
                walletDiscountAmount={walletDiscountAmount}
                showLineItems
                showShipping={false}
              />

              {orderValueBlocked ? (
                <Alert className="border-amber-400/40 bg-amber-500/10">
                  <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                    {orderValueMessage}
                  </AlertDescription>
                </Alert>
              ) : null}

              {hasUnavailableItems ? (
                <GoldButton className="w-full" disabled title={t("cart.removeUnavailable")}>
                  {t("cart.unavailableItems")}
                </GoldButton>
              ) : user && !isGuest ? (
                <GoldButton
                  className="w-full"
                  onClick={() => navigate(localeHref("/checkout", locale))}
                  disabled={hasReducedItems || orderValueBlocked}
                  title={
                    hasReducedItems
                      ? t("cart.adjustQuantities")
                      : orderValueBlocked
                        ? orderValueMessage
                        : undefined
                  }
                  data-umami-event="cart:proceed-checkout"
                >
                  {t("cart.proceedToCheckout")}
                </GoldButton>
              ) : isGuest ? (
                <div className="flex flex-col gap-3">
                  <GoldButton
                    className="w-full"
                    onClick={() => navigate(localeHref("/checkout", locale))}
                    disabled={hasReducedItems || orderValueBlocked}
                    title={
                      hasReducedItems
                        ? t("cart.adjustQuantities")
                        : orderValueBlocked
                          ? orderValueMessage
                          : undefined
                    }
                    data-umami-event="cart:guest-checkout"
                  >
                    {t("cart.guestCheckout")}
                  </GoldButton>
                  <GoldOutlineButton
                    className="w-full"
                    onClick={handleGuestLogin}
                    data-umami-event="cart:login-checkout"
                  >
                    {t("cart.loginToCheckout")}
                  </GoldOutlineButton>
                </div>
              ) : (
                <GoldButton
                  className="w-full"
                  onClick={handleCheckout}
                  disabled={hasReducedItems || orderValueBlocked}
                  title={
                    hasReducedItems
                      ? t("cart.adjustQuantities")
                      : orderValueBlocked
                        ? orderValueMessage
                        : undefined
                  }
                  data-umami-event="cart:login-checkout"
                >
                  {t("cart.loginToCheckout")}
                </GoldButton>
              )}
            </CardContent>
          </Card>

          {showLockedReferral ? (
            <Card className="border-green-500/30 shadow-none">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm text-muted-foreground">{t("cart.referralDiscountApplied")}</p>
                <Input
                  value={profileReferralCode ?? ""}
                  disabled
                  className="font-semibold text-green-400 uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  {t("cart.referralDiscountDesc", { percent: pendingReferralDiscountPercent ?? 0 })}
                </p>
              </CardContent>
            </Card>
          ) : referralApplying ? (
            <Card className="border-border/60 shadow-none">
              <CardContent className="p-4 space-y-2">
                <Input value={profileReferralCode ?? ""} disabled className="uppercase" />
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Spinner size="xs" className="text-muted-foreground" aria-hidden />
                  {t("cart.applying")}
                </p>
              </CardContent>
            </Card>
          ) : promoCode || pendingReferralCode ? (
            <Card className="border-border/60 shadow-none">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {pendingReferralCode ? t("cart.referralApplied") : t("cart.promoApplied")}
                    </p>
                    <p className="font-semibold text-green-400">
                      {pendingReferralCode ?? promoCode}
                    </p>
                  </div>
                  {!referralLocked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveDiscount}
                      disabled={removeDiscount.isPending}
                      data-umami-event="cart:remove-discount"
                    >
                      {t("cart.remove")}
                    </Button>
                  )}
                </div>
                {isGuest && discountRequiresAuth && (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <p className="text-xs text-muted-foreground">{t("cart.signInForDiscount")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : !isFirstOrder || !profileReferralCode || !user ? (
            <Card className="border-border/60 shadow-none">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder={t("cart.discountCode")}
                      value={discountInput}
                      disabled={applyDiscount.isPending}
                      onChange={(e) => {
                        setDiscountInput(e.target.value.toUpperCase());
                        setDiscountError(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyDiscount()}
                      className={cn(
                        "pr-9 font-medium uppercase tracking-wide",
                        lastDiscountError && "border-red-500/50 bg-red-500/5"
                      )}
                      aria-invalid={Boolean(lastDiscountError)}
                    />
                    {lastDiscountError && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                        <svg
                          className="size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-label={t("common.error")}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M15 9l-6 6M9 9l6 6" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <GoldOutlineButton
                    disabled={applyDiscount.isPending || !discountInput.trim()}
                    onClick={handleApplyDiscount}
                    className="shrink-0 min-w-[100px]"
                    data-umami-event="cart:apply-discount"
                    data-umami-event-code={discountInput}
                  >
                    {applyDiscount.isPending ? (
                      <span className="flex items-center gap-2">
                        <Spinner size="xs" aria-hidden />
                        {t("cart.applying")}
                      </span>
                    ) : (
                      t("cart.apply")
                    )}
                  </GoldOutlineButton>
                </div>
                {lastDiscountError && (
                  <p className="text-red-500 text-xs mt-2.5 font-medium animate-in slide-in-from-top-1 duration-200">
                    {lastDiscountError}
                  </p>
                )}
                {isGuest && !promoCode && !pendingReferralCode && (
                  <p className="text-xs text-muted-foreground mt-2.5">
                    {t("cart.guestDiscountHint")}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
          {isGuest &&
            !promoCode &&
            !pendingReferralCode &&
            typeof window !== "undefined" &&
            parseRefFromSearch(window.location.search) && (
              <Card className="border-gold/20 shadow-none border-dashed">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("cart.youWereReferred")}</p>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </main>
  );
}

export default withFallback(CartView, CartLoadingFallback);
