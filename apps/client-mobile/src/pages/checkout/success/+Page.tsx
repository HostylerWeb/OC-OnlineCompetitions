"use client";

import {
  invalidateCheckoutSuccessQueries,
  useAuth,
  useCartDiscount,
  useCheckout,
  useClearCart,
  useMyOrderDetail,
} from "@oc/api-client";
import { Clock, PartyPopper, Ticket } from "@oc/icons";
import type { MeOrderDetailDto } from "@oc/types";
import { getGrantedTicketIds } from "@oc/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GoldOutlineButton } from "@/components/buttons";
import { type InstantWinData, InstantWinModal } from "@/components/checkout/InstantWinModal";
import { Link } from "@/components/Link";
import { TicketNumberPill } from "@/components/shared/TicketNumberPill";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";

function buildInstantWinsFromOrder(order: MeOrderDetailDto): InstantWinData[] {
  const wins: InstantWinData[] = [];
  const competitionInfoById: Record<string, { title: string; image?: string; slug?: string }> = {};

  for (const item of order.items || []) {
    const id = typeof item.competitionId === "object" ? item.competitionId._id : item.competitionId;
    const ref = typeof item.competitionId === "object" ? item.competitionId : null;
    if (id && ref?.title) {
      competitionInfoById[id] = { title: ref.title, image: ref.prizeImageUrl, slug: ref.slug };
    }
  }

  for (const entry of order.entries || []) {
    for (const win of entry.instantPrizeWins || []) {
      const prize = win.competitionInstantPrizeId;
      const grantedTicketIds = getGrantedTicketIds(win);
      const linkedId = prize?.linkedCompetitionId;
      const linkedInfo = linkedId ? competitionInfoById[linkedId] : undefined;
      wins.push({
        prizeTitle: prize?.title || "Instant Prize",
        prizeDescription: prize?.description,
        prizeImage: prize?.images?.[0],
        prizeValue: prize?.value,
        ticketNumber: win.ticketNumber,
        winId: win._id,
        claimed: win.claimed,
        claimedAt: win.claimedAt,
        prizeType: prize?.type ?? "prize",
        linkedCompetitionId: linkedId,
        linkedCompetitionTitle:
          prize?.type === "competition_ticket" ? linkedInfo?.title : undefined,
        linkedCompetitionImage: linkedInfo?.image,
        linkedCompetitionSlug: prize?.linkedCompetitionSlug ?? linkedInfo?.slug,
        grantedTicketIds,
        grantedEntryIds: grantedTicketIds,
      });
    }
  }

  return wins;
}

function PaymentFailureView() {
  const { t } = useTranslation();
  return (
    <>
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500/20 to-red-500/5 flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">&#9888;&#65039;</span>
      </div>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-balance">
        {t("checkout.success.paymentError")}
      </h1>
      <p className="text-muted-foreground text-lg mb-8">{t("checkout.success.errorDesc")}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <GoldOutlineButton asChild>
          <Link href="/cart" data-umami-event="checkout:success-try-again">
            {t("checkout.success.tryAgain")}
          </Link>
        </GoldOutlineButton>
        <GoldOutlineButton asChild>
          <Link href="/contact" data-umami-event="checkout:contact-support">
            {t("checkout.success.contactSupport")}
          </Link>
        </GoldOutlineButton>
      </div>
    </>
  );
}

function PaymentTimedOutView() {
  const { t } = useTranslation();
  return (
    <>
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center mx-auto mb-6">
        <Clock className="w-12 h-12 text-gold" />
      </div>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-balance">
        {t("checkout.success.timedOutTitle")}
      </h1>
      <p className="text-muted-foreground text-lg mb-4">{t("checkout.success.timedOutDesc")}</p>
      <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-left max-w-md mx-auto">
        <p className="font-medium text-sm mb-1 text-amber-200">
          {t("checkout.success.doNotRetry")}
        </p>
        <p className="text-xs text-muted-foreground">{t("checkout.success.timedOutNote")}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <GoldOutlineButton asChild>
          <Link href="/dashboard/orders" data-umami-event="checkout:view-orders">
            {t("checkout.success.viewMyOrders")}
          </Link>
        </GoldOutlineButton>
        <GoldOutlineButton asChild>
          <Link href="/contact" data-umami-event="checkout:contact-support">
            {t("checkout.success.contactSupport")}
          </Link>
        </GoldOutlineButton>
      </div>
    </>
  );
}

function PaymentCancelledView() {
  const { t } = useTranslation();
  return (
    <>
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">&#9888;&#65039;</span>
      </div>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-balance">
        {t("checkout.success.cancelled")}
      </h1>
      <p className="text-muted-foreground text-lg mb-8">{t("checkout.success.cancelledDesc")}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <GoldOutlineButton asChild>
          <Link href="/cart" data-umami-event="checkout:back-to-cart">
            {t("checkout.success.backToCart")}
          </Link>
        </GoldOutlineButton>
        <GoldOutlineButton asChild>
          <Link href="/dashboard/orders" data-umami-event="checkout:view-orders">
            {t("checkout.success.viewMyOrders")}
          </Link>
        </GoldOutlineButton>
      </div>
    </>
  );
}

function CapturedNotFulfilledView({
  title,
  message,
  category,
  wasCharged,
}: {
  title: string | null;
  message: string | null;
  category: string | null;
  wasCharged: string | null;
}) {
  const { t } = useTranslation();
  const contradictoryCategory = category === "SUCCESS";
  const displayTitle = title && !contradictoryCategory ? title : t("checkout.success.weHitASnag");
  const wasChargedBool = wasCharged === "true";
  const displayMessage =
    message && !contradictoryCategory && wasChargedBool
      ? message
      : wasChargedBool
        ? t("checkout.success.wasChargedMessage")
        : t("checkout.success.notChargedMessage");

  return (
    <>
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">&#9888;&#65039;</span>
      </div>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-balance">
        {displayTitle}
      </h1>
      <p className="text-muted-foreground text-lg mb-4">{displayMessage}</p>
      {wasChargedBool ? (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-left max-w-md mx-auto">
          <p className="font-medium text-sm mb-1 text-amber-200">
            {t("checkout.success.doNotRetry")}
          </p>
          <p className="text-xs text-muted-foreground">{t("checkout.success.doNotRetryDesc")}</p>
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <GoldOutlineButton asChild>
          <Link href="/dashboard/orders" data-umami-event="checkout:view-orders">
            {t("checkout.success.viewMyOrders")}
          </Link>
        </GoldOutlineButton>
        <GoldOutlineButton asChild>
          <Link href="/contact" data-umami-event="checkout:contact-support">
            {t("checkout.success.contactSupport")}
          </Link>
        </GoldOutlineButton>
      </div>
    </>
  );
}

function fireConfetti() {
  import("canvas-confetti").then((confetti) => {
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti.default({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#FFD700", "#FFA500", "#FFC107", "#FFF176"],
        startVelocity: 30,
        ticks: 100,
      });
      confetti.default({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#FFD700", "#FFA500", "#FFC107", "#FFF176"],
        startVelocity: 30,
        ticks: 100,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  });
}

function CheckoutSuccessPageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const provider = searchParams.get("provider");
  const sessionId = searchParams.get("session_id") ?? searchParams.get("token");
  const urlOrderId = searchParams.get("order_id");
  const paymentParam = searchParams.get("payment");
  const errorCode = searchParams.get("code");
  const errorTitle = searchParams.get("title");
  const errorMsg = searchParams.get("msg");
  const wasChargedParam = searchParams.get("wasCharged");
  const redirectStatus = searchParams.get("redirect_status");

  const {
    status,
    timedOut,
    orderId: storeOrderId,
    setPolling,
    pollStatus,
    stopPolling,
  } = useCheckout();
  const { user: authUser } = useAuth();
  const user = authUser;
  const clearCart = useClearCart();
  useCartDiscount({ enabled: !!user });

  const stopRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const postSuccessRanRef = useRef(false);
  const modalScheduledRef = useRef(false);
  const confettiFiredRef = useRef(false);
  const persistedClearedRef = useRef(false);

  const [instantWins, setInstantWins] = useState<InstantWinData[]>([]);
  const [modalTotalTickets, setModalTotalTickets] = useState(0);
  const [showInstantWinModal, setShowInstantWinModal] = useState(false);
  const [cartClearWarning, setCartClearWarning] = useState<string | null>(null);

  const orderId = storeOrderId ?? urlOrderId;

  const {
    data: orderResponse,
    isLoading: orderLoading,
    isError: orderFetchError,
  } = useMyOrderDetail(orderId, { enabled: !!orderId, retry: 0 });

  const orderData = orderResponse?.data ?? null;
  const _orderLoading = orderLoading;

  const invalidateSuccessQueries = useCallback(async () => {
    await invalidateCheckoutSuccessQueries(queryClient);
  }, [queryClient]);

  const displayStatus = useMemo(() => {
    const hasPaymentContext = !!provider && !!sessionId;
    const hasOrderId = !!urlOrderId;

    const fulfillmentFailed =
      (orderData?.metadata as { fulfillmentFailedAfterCapture?: boolean } | undefined)
        ?.fulfillmentFailedAfterCapture === true;

    if (redirectStatus === "canceled") return "cancelled" as const;

    // Local provider is synchronous — detect from URL params directly so
    // SSR and first client render agree on "completed" (no hydration mismatch).
    if (provider === "local" && hasPaymentContext) return "completed" as const;

    if (provider === "paytriot") {
      // E2 defense-in-depth: even if URL says payment=success, check order
      // metadata for fulfillmentFailedAfterCapture. If present, the customer
      // was charged but order fulfillment failed — show the bespoke
      // "captured-not-fulfilled" UI (not the generic "failed" UI).
      if (fulfillmentFailed) {
        return "captured-not-fulfilled" as const;
      }
      // If the URL explicitly says captured-but-not-fulfilled, route to the
      // bespoke UI even before the order detail loads.
      if (paymentParam === "captured-but-not-fulfilled") {
        return "captured-not-fulfilled" as const;
      }
      if (paymentParam === "failed" || paymentParam === "unknown" || paymentParam === "duplicate") {
        return "failed" as const;
      }
    }

    if (!hasPaymentContext && !hasOrderId) return "invalid" as const;

    if (hasPaymentContext) {
      if (status === "success") {
        // Local provider: fulfillment is synchronous — seedSuccess is the
        // authoritative success signal, no need to verify via order detail
        if (provider === "local") return "completed" as const;

        // Defense in depth: even when poll reports success, if orderData
        // shows fulfillment failed, escalate to the bespoke UI.
        if (fulfillmentFailed) {
          return "captured-not-fulfilled" as const;
        }
        if (orderData?.status === "failed" || orderData?.status === "refunded") {
          return "failed" as const;
        }
        if (orderData?.status === "completed") return "completed" as const;
        if (orderFetchError) return "completed" as const;
        if (orderData?.status === "pending" || orderData?.status === "processing")
          return "processing" as const;
        return "processing" as const;
      }

      // The poll budget was exhausted while the session was still showing
      // processing (not failed). The payment may still complete — surface a
      // "still processing" view rather than a failed one, unless the order
      // detail resolves the state for us.
      if (status === "error" && timedOut) {
        if (provider === "paytriot" && fulfillmentFailed) {
          return "captured-not-fulfilled" as const;
        }
        if (orderData?.status === "completed") return "completed" as const;
        if (orderData?.status === "failed" || orderData?.status === "refunded")
          return "failed" as const;
        return "timed-out" as const;
      }

      if (status === "error") return "failed" as const;
      if (status === "polling" || status === "idle") {
        if (provider === "paytriot") {
          if (fulfillmentFailed) {
            return "captured-not-fulfilled" as const;
          }
          if (paymentParam === "captured-but-not-fulfilled") {
            return "captured-not-fulfilled" as const;
          }
          if (
            paymentParam === "failed" ||
            paymentParam === "unknown" ||
            paymentParam === "duplicate"
          ) {
            return "failed" as const;
          }
        }
        return "processing" as const;
      }
      return "loading" as const;
    }

    if (_orderLoading) return "loading" as const;
    if (orderFetchError || !orderData) return "invalid" as const;
    if (orderData.status === "completed" || orderData.status === "processing")
      return "completed" as const;
    if (orderData.status === "failed" || orderData.status === "refunded") return "failed" as const;
    return "loading" as const;
  }, [
    provider,
    sessionId,
    status,
    timedOut,
    orderData,
    urlOrderId,
    _orderLoading,
    orderFetchError,
    paymentParam,
    redirectStatus,
  ]);

  const showOrderSkeleton = displayStatus === "completed" && !!orderId && _orderLoading;

  useEffect(() => {
    if (!provider || !sessionId) return;

    isMountedRef.current = true;

    if (redirectStatus === "canceled") {
      stopPolling();
      return;
    }

    if (provider === "local") {
      useCheckout.getState().seedSuccess(provider, sessionId, urlOrderId ?? sessionId);
      return;
    }

    if (paymentParam === "success" && urlOrderId) {
      useCheckout.getState().seedSuccess(provider, sessionId, urlOrderId);
      return;
    }

    setPolling(provider, sessionId);
    pollStatus().then((stop) => {
      if (isMountedRef.current) {
        stopRef.current = stop ?? null;
      }
    });

    return () => {
      isMountedRef.current = false;
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      } else {
        stopPolling();
      }
    };
  }, [provider, sessionId, urlOrderId, setPolling, pollStatus, stopPolling, redirectStatus]);

  useEffect(() => {
    if (status !== "success" || postSuccessRanRef.current) return;
    postSuccessRanRef.current = true;

    void invalidateSuccessQueries();

    void clearCart
      .mutateAsync()
      .then(() => {})
      .catch(() => {
        setCartClearWarning(t("checkout.success.cartClearWarning"));
      });
  }, [status, clearCart, invalidateSuccessQueries]);

  useEffect(() => {
    const terminalStatuses = [
      "completed",
      "failed",
      "timed-out",
      "captured-not-fulfilled",
      "cancelled",
    ] as const;
    if (!terminalStatuses.some((s) => displayStatus === s)) return;
    if (persistedClearedRef.current) return;
    persistedClearedRef.current = true;
    useCheckout.getState().clearPersistedState();
  }, [displayStatus]);

  useEffect(() => {
    if (displayStatus !== "completed" || !orderData || modalScheduledRef.current) return;

    const wins = buildInstantWinsFromOrder(orderData);
    if (wins.length === 0) return;

    const totalTickets = orderData.items.reduce((sum, item) => sum + item.quantity, 0);

    modalScheduledRef.current = true;
    setInstantWins(wins);
    setModalTotalTickets(totalTickets);
    setShowInstantWinModal(true);
  }, [displayStatus, orderData]);

  useEffect(() => {
    if (displayStatus !== "completed" || confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    fireConfetti();
  }, [displayStatus]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <InstantWinModal
        open={showInstantWinModal}
        onClose={() => setShowInstantWinModal(false)}
        wins={instantWins}
        totalTickets={modalTotalTickets}
      />

      <main className="pt-14 flex-1 flex items-center justify-center oc-container-auth pb-8">
        <div className="py-8 lg:py-16 text-center max-w-lg">
          {displayStatus === "invalid" ? (
            <>
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500/20 to-red-500/5 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">&#9888;&#65039;</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-balance">
                {t("checkout.success.invalidLink")}
              </h1>
              <p className="text-muted-foreground text-lg mb-8">
                {t("checkout.success.invalidLinkDesc")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <GoldOutlineButton asChild>
                  <Link href="/dashboard/orders" data-umami-event="checkout:view-orders">
                    {t("checkout.success.viewMyOrders")}
                  </Link>
                </GoldOutlineButton>
                <GoldOutlineButton asChild>
                  <Link href="/cart" data-umami-event="checkout:back-to-cart">
                    {t("checkout.success.backToCart")}
                  </Link>
                </GoldOutlineButton>
              </div>
            </>
          ) : displayStatus === "completed" ? (
            <>
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center mx-auto mb-6 animate-in">
                <PartyPopper className="w-12 h-12 text-gold" />
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-balance">
                {t("checkout.success.purchaseComplete")}
              </h1>
              <p className="text-muted-foreground text-lg mb-2">
                {t("checkout.success.completedDesc")}
              </p>
              {orderId ? (
                <p className="text-sm text-muted-foreground mb-8">
                  {t("checkout.success.orderConfirmed")}
                </p>
              ) : null}

              {showOrderSkeleton ? (
                <div className="mb-8 space-y-2" role="status" aria-busy="true">
                  <span className="sr-only">{t("common.loading")}</span>
                  <Skeleton className="mx-auto h-4 w-48" />
                  <Skeleton className="mx-auto h-4 w-64" />
                </div>
              ) : null}

              {cartClearWarning ? (
                <p className="text-sm text-amber-400 mb-8">{cartClearWarning}</p>
              ) : null}

              {orderFetchError ? (
                <p className="text-sm text-amber-400 mb-8">
                  {t("checkout.success.orderFetchError")}
                </p>
              ) : null}

              {showOrderSkeleton ? (
                <Card className="border-gold/20 mb-8 text-left">
                  <CardContent className="p-6 space-y-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ) : orderData?.items && orderData.items.length > 0 ? (
                <Card className="border-gold/20 mb-8 text-left bg-card/70 backdrop-blur-sm">
                  <CardContent className="p-6 space-y-4">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-gold" />
                      {t("checkout.success.yourTickets")}
                    </h2>
                    {orderData.items.map((item) => (
                      <div key={item._id} className="space-y-1.5">
                        <p className="font-medium text-sm">
                          {typeof item.competitionId === "object"
                            ? (item.competitionId.title ?? t("checkout.success.competition"))
                            : t("checkout.success.competition")}
                        </p>
                        <p className="text-sm font-bold text-gold">
                          {t("checkout.success.ticketsPurchased", {
                            count: item.quantity,
                          })}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-2 justify-center">
                          {(item.ticketNumbers ?? []).map((num) => (
                            <TicketNumberPill key={num} value={num} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <Card className="border-gold/20 mb-8 text-left bg-card/70 backdrop-blur-sm">
                <CardContent className="p-6 space-y-3">
                  <h2 className="font-semibold">{t("checkout.success.whatsNext")}</h2>
                  <div className="space-y-4">
                    {[
                      {
                        icon: Ticket,
                        titleKey: "checkout.success.whatsNextSteps.step1Title" as const,
                        descKey: "checkout.success.whatsNextSteps.step1Desc" as const,
                      },
                      {
                        icon: Clock,
                        titleKey: "checkout.success.whatsNextSteps.step2Title" as const,
                        descKey: "checkout.success.whatsNextSteps.step2Desc" as const,
                      },
                      {
                        icon: PartyPopper,
                        titleKey: "checkout.success.whatsNextSteps.step3Title" as const,
                        descKey: "checkout.success.whatsNextSteps.step3Desc" as const,
                      },
                    ].map((step) => (
                      <div
                        key={step.titleKey}
                        className="flex gap-3 pl-3 border-l-2 border-gold/30"
                      >
                        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                          <step.icon className="w-5 h-5 text-gold" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{t(step.titleKey)}</p>
                          <p className="text-xs text-muted-foreground">{t(step.descKey)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {user?.isAnonymous ? (
                <Card className="border-gold/20 mb-8 text-left bg-gold/10 backdrop-blur-sm">
                  <CardContent className="p-6 space-y-3">
                    <h2 className="font-semibold">{t("checkout.success.claimYourAccount")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t("checkout.success.claimAccountDesc")}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <GoldOutlineButton asChild>
                        <Link
                          href="/auth/sign-up?returnTo=/dashboard"
                          data-umami-event="checkout:post-purchase-create-account"
                        >
                          {t("checkout.success.createAccount")}
                        </Link>
                      </GoldOutlineButton>
                      <GoldOutlineButton asChild>
                        <Link
                          href="/auth/login?returnTo=/dashboard"
                          data-umami-event="checkout:post-purchase-sign-in"
                        >
                          {t("checkout.success.signIn")}
                        </Link>
                      </GoldOutlineButton>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {instantWins.length > 0 ? (
                <Card className="border-gold/40 mb-8 bg-gold/5 text-left">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/20">
                        <PartyPopper className="size-4 text-gold" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {t("checkout.success.youWonInstant", {
                            count: instantWins.length,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("checkout.success.viewInDashboard")}
                        </p>
                      </div>
                    </div>
                    <GoldOutlineButton
                      onClick={() => setShowInstantWinModal(true)}
                      data-umami-event="checkout:review-instant-wins"
                    >
                      {t("checkout.success.reviewWins")}
                    </GoldOutlineButton>
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <GoldOutlineButton asChild>
                  <Link href="/dashboard/tickets" data-umami-event="checkout:view-tickets">
                    {t("checkout.success.viewMyTickets")}
                  </Link>
                </GoldOutlineButton>
                <GoldOutlineButton asChild>
                  <Link href="/competitions" data-umami-event="checkout:browse-more">
                    {t("checkout.success.browseMoreCompetitions")}
                  </Link>
                </GoldOutlineButton>
              </div>
            </>
          ) : displayStatus === "processing" || displayStatus === "loading" ? (
            <>
              <div
                className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 to-gold/5"
                role="status"
                aria-busy="true"
                aria-label={t("checkout.success.confirmingOrder")}
              >
                <Spinner size="xl" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-balance">
                {displayStatus === "loading"
                  ? t("checkout.success.confirmingOrder")
                  : t("checkout.success.processingOrder")}
              </h1>
              <p className="text-muted-foreground text-lg mb-4">
                {t("checkout.success.processingDesc")}
              </p>
              {displayStatus === "processing" ? (
                <p className="text-sm text-muted-foreground/70 mb-8">
                  {t("checkout.success.processingDetail")}
                </p>
              ) : null}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <GoldOutlineButton asChild>
                  <Link href="/dashboard/orders" data-umami-event="checkout:view-orders">
                    {t("checkout.success.viewMyOrders")}
                  </Link>
                </GoldOutlineButton>
                <GoldOutlineButton asChild>
                  <Link href="/competitions" data-umami-event="checkout:browse-competitions">
                    {t("checkout.success.browseCompetitions")}
                  </Link>
                </GoldOutlineButton>
              </div>
            </>
          ) : displayStatus === "captured-not-fulfilled" ? (
            <CapturedNotFulfilledView
              title={errorTitle}
              message={errorMsg}
              category={errorCode}
              wasCharged={wasChargedParam}
            />
          ) : displayStatus === "timed-out" ? (
            <PaymentTimedOutView />
          ) : displayStatus === "cancelled" ? (
            <PaymentCancelledView />
          ) : (
            <PaymentFailureView />
          )}
        </div>
      </main>
    </div>
  );
}

export default CheckoutSuccessPageContent;
