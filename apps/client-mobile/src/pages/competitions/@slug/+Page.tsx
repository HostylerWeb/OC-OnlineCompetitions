"use client";

import {
  resolveContextualErrorFromUnknown,
  useAddCartItem,
  useAuth,
  useAvailability,
  useCartItems,
  useCompetitionBonusAwards,
  useCompetitionBonusAwardWins,
  useCompetitionDetail,
  useCompetitionInstantPrizes,
  useCompetitionStream,
  useCompetitions,
  useMyProfile,
  useMyReferrals,
  useUpdateCartItem,
} from "@oc/api-client";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  HelpCircle,
  Mail,
  Minus,
  Plus,
  Share2,
  Shield,
  ShoppingCart,
  Star,
  Ticket,
  Trophy,
  ZoomIn,
} from "@oc/icons";
import type { PublicBonusAwardEntry, PublicBonusAwardWinDTO } from "@oc/types";
import {
  clampCartQuantity,
  getAvailableTickets,
  getMaxCartQuantity,
  getMaxPurchasable,
  getTicketsSold,
} from "@oc/utils";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { GoldButton, GoldOutlineButton } from "@/components/buttons";
import { BonusAwardsSection } from "@/components/competitions/bonus-awards";
import CompetitionFaq from "@/components/competitions/CompetitionFaq";
import CompetitionInfo from "@/components/competitions/CompetitionInfo";
import { CountdownTimer } from "@/components/competitions/CountdownTimer";
import { InstantWinsSection } from "@/components/competitions/instant-wins";
import RelatedCompetitions from "@/components/competitions/RelatedCompetitions";
import { Link } from "@/components/Link";
import { BrandDialog } from "@/components/brand-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompetitionProgressBar } from "@/components/ui/competition-progress-bar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { isCashOnly } from "@/lib/competition-display";
import {
  formatCurrency,
  formatNumber,
  localeHref,
  type TranslationKey,
  useTranslation,
} from "@/lib/i18n";
import { mapComp } from "@/lib/map-competition";

function ticketLimitWarningToast(
  limits: { liveAvailable: number; maxPerUser: number; userOwned: number; currentInCart: number },
  maxCartQuantity: number,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  const { liveAvailable, maxPerUser, userOwned, currentInCart } = limits;
  if (liveAvailable <= 0 && maxCartQuantity <= currentInCart) {
    return t("competitions.detail.soldOutBanner");
  }
  if (maxPerUser > 0 && userOwned >= maxPerUser) {
    return t("competitions.detail.maxPerPersonReached", { max: maxPerUser });
  }
  const personalRemaining = maxPerUser > 0 ? maxPerUser - userOwned : null;
  if (personalRemaining != null && maxCartQuantity === personalRemaining) {
    return t("competitions.detail.maxPerPersonShort", { max: personalRemaining });
  }
  return t("competitions.detail.onlyXAvailable", { count: maxCartQuantity });
}

function maxTicketsReason(
  userOwned: number,
  maxPerUser: number,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  if (maxPerUser > 0 && userOwned >= maxPerUser) {
    return t("competitions.detail.maxPerPersonReached", { max: maxPerUser });
  }
  return t("competitions.detail.noMoreTickets");
}

export default function Page() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const { slug = "" } = useParams<{ slug: string }>();

  const addItem = useAddCartItem();
  const updateItem = useUpdateCartItem();
  const [quantity, setQuantity] = useState<number>(1);
  const initializedFromCart = useRef(false);
  const [answerIndex, setAnswerIndex] = useState(-1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const quantitySectionRef = useRef<HTMLDivElement>(null);
  const quizSectionRef = useRef<HTMLDivElement>(null);
  const cartLoadedRef = useRef(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showCompactLoading, setShowCompactLoading] = useState(false);
  const { user: authUser, isAnonymous: authIsAnonymous } = useAuth();
  const user = authUser ?? null;
  const isAnonymous = authIsAnonymous;

  const competitionDetailQuery = useCompetitionDetail(slug);
  const compApiData = competitionDetailQuery.data;
  const isLoading = competitionDetailQuery.isLoading;
  const competition = compApiData?.data ? mapComp(compApiData.data) : null;

  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  useEffect(() => {
    setFailedImages(new Set());
  }, [competition?._id]);
  const showPostalCta = false;

  const { data: relatedRes } = useCompetitions({
    category: competition?.category ?? "",
    exclude: competition?.id ?? "",
    limit: 4,
    enabled: !!competition,
  });
  const relatedComps = relatedRes?.data ?? [];

  useEffect(() => {
    const timer = setTimeout(() => setShowCompactLoading(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const { data: cartItems = [], isPending: cartPending } = useCartItems({
    enabled: !!user && !isAnonymous,
    refetchInterval: false,
  });
  const { data: referralRes } = useMyReferrals({ enabled: !!user && !isAnonymous });
  const { data: profileRes } = useMyProfile({ enabled: !!user && !isAnonymous });

  useEffect(() => {
    if (!cartPending) cartLoadedRef.current = true;
  }, [cartPending]);

  const competitionId = competition?._id ?? competition?.id ?? "";
  useCompetitionStream(competitionId ? [competitionId] : []);

  const {
    data: availabilityRes,
    isFetching: availabilityFetching,
    dataUpdatedAt,
  } = useAvailability(competitionId);
  const availability = availabilityRes?.data;
  const liveAvailable =
    availability?.available ?? (competition ? getAvailableTickets(competition) : 0);
  const maxPerUser = availability?.maxPerUser ?? competition?.maxTicketsPerUser ?? 10;
  const userOwned = user && !isAnonymous ? (availability?.userOwned ?? 0) : 0;

  const { data: instantPrizesRes, isLoading: instantPrizesLoading } =
    useCompetitionInstantPrizes(competitionId);
  const instantPrizes = instantPrizesRes?.data ?? [];

  const { data: rawBonusAwardsRes } = useCompetitionBonusAwards(competitionId);
  const { data: rawBonusAwardWinsRes } = useCompetitionBonusAwardWins(competitionId);
  const bonusAwards = (rawBonusAwardsRes?.data ?? []) as PublicBonusAwardEntry[];
  const bonusAwardWins = (rawBonusAwardWinsRes?.data ?? []) as PublicBonusAwardWinDTO[];

  const instantWinsCount = instantPrizes.reduce(
    (sum, prize) => (prize.isArchived ? sum : sum + prize.quantity),
    0
  );
  const bonusDrawsCount = bonusAwards.length;

  const guestReferralCode = profileRes?.data?.referredByCode ?? undefined;
  const myReferralCode =
    user && !isAnonymous ? (referralRes?.data?.referralCode ?? undefined) : guestReferralCode;

  const [countdown, setCountdown] = useState(10);
  const [_justRefetched, setJustRefetched] = useState(false);
  const prevUpdatedAtRef = useRef(dataUpdatedAt);

  useEffect(() => {
    if (prevUpdatedAtRef.current !== dataUpdatedAt && dataUpdatedAt > 0) {
      setCountdown(10);
      setJustRefetched(true);
      const timer = setTimeout(() => setJustRefetched(false), 600);
      prevUpdatedAtRef.current = dataUpdatedAt;
      return () => clearTimeout(timer);
    }
  }, [dataUpdatedAt]);

  useEffect(() => {
    if (availabilityFetching) {
      setCountdown(10);
    }
  }, [availabilityFetching]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function handleDisabledClick() {
    const headerHeight = 64 + 48;
    const scrollTo = (el: HTMLElement) => {
      const top = el.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top, behavior: "smooth" });
      setTimeout(() => el.focus(), 300);
    };

    if (quantity < 1) {
      quantitySectionRef.current && scrollTo(quantitySectionRef.current);
    } else if (competition?.question && answerIndex < 0) {
      quizSectionRef.current && scrollTo(quizSectionRef.current);
    }
  }

  function handleAddToCart() {
    if (!competition) return;
    if (quantity < 1 || quantity > maxCartQuantity) return;

    if (
      competition.question &&
      competition.questionOptions &&
      competition.questionOptions.length > 0
    ) {
      if (answerIndex < 0 || answerIndex >= competition.questionOptions.length) {
        return;
      }
    }

    setIsAdding(true);

    const hasQuiz =
      !!competition.question &&
      !!competition.questionOptions &&
      competition.questionOptions.length > 0;

    const mutateFn = currentInCart > 0 ? updateItem : addItem;
    const payload =
      currentInCart > 0
        ? {
            competitionId: competition.id,
            quantity,
            answerIndex: hasQuiz ? answerIndex : undefined,
          }
        : { competitionId: competition.id, quantity, answerIndex: hasQuiz ? answerIndex : 0 };

    mutateFn.mutate(payload as any, {
      onSuccess: () => {
        setIsAdding(false);
        toast.success(t("competitions.detail.cartUpdated"));
      },
      onError: (err) => {
        const contextual = resolveContextualErrorFromUnknown(
          err,
          t("competitions.detail.couldNotAddToCart")
        );
        toast.error(contextual.message);
        setIsAdding(false);
      },
    });
  }

  function setQuantityWithLimit(requested: number) {
    const {
      quantity: clamped,
      wasClamped,
      maxCartQuantity: max,
    } = clampCartQuantity(requested, quantityLimits);
    if (wasClamped) {
      toast.warning(ticketLimitWarningToast(quantityLimits, max, t));
    }
    setQuantity(clamped);
  }

  const maxTickets = competition?.maxTickets ?? 0;
  const soldTickets = competition ? getTicketsSold(competition) : 0;
  const ticketsRemaining = liveAvailable;
  const existingCartItem = cartItems.find((item) => item.competitionId === competition?.id);
  const currentInCart = existingCartItem?.quantity ?? 0;
  const quantityLimits = {
    liveAvailable,
    maxPerUser,
    userOwned,
    currentInCart,
  };
  const maxCartQuantity = getMaxCartQuantity(quantityLimits);
  const maxPurchasable = getMaxPurchasable(quantityLimits);
  const atPersonalLimit = maxPerUser > 0 && userOwned >= maxPerUser;
  const atQuantityLimit = maxCartQuantity > 0 && quantity >= maxCartQuantity;
  const totalPrice = quantity * (competition?.ticketPrice ?? competition?.price ?? 0);

  useEffect(() => {
    setQuantity((current) => {
      if (maxCartQuantity === 0) return 0;
      if (current > maxCartQuantity) return maxCartQuantity;
      if (current < 1) return 1;
      return current;
    });
  }, [maxCartQuantity]);

  useEffect(() => {
    if (!cartPending && currentInCart > 0 && !initializedFromCart.current) {
      setQuantity(Math.min(currentInCart, maxCartQuantity || currentInCart));
      initializedFromCart.current = true;
    }
  }, [cartPending, currentInCart, maxCartQuantity]);

  const statusConfig: Record<string, { label: string; className: string }> = {
    active: {
      label: t("competitions.detail.liveNow"),
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    ended: {
      label: t("competitions.detail.ended"),
      className: "bg-muted/20 text-muted-foreground border-border",
    },
    drawn: {
      label: t("competitions.detail.drawComplete"),
      className: "bg-gold/20 text-gold border-gold/30",
    },
    coming: {
      label: t("competitions.detail.comingSoon"),
      className: "bg-gold/20 text-gold border-gold/30",
    },
  };

  if (!slug || isLoading) {
    if (!showCompactLoading) {
      return (
        <div className="oc-container-wide py-5 lg:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Skeleton className="aspect-[4/5] rounded-[2rem]" shimmer />
            <div className="space-y-6">
              <div>
                <Skeleton className="h-6 w-40 mb-3" shimmer />
                <Skeleton className="h-10 w-full mb-2" shimmer />
                <Skeleton className="h-5 w-3/4" shimmer />
              </div>
              <Skeleton className="h-24 w-full rounded-xl" shimmer />
              <Skeleton className="h-40 w-full rounded-xl" shimmer />
              <Skeleton className="h-4 w-full" shimmer />
              <Skeleton className="h-4 w-3/4" shimmer />
              <Skeleton className="h-4 w-1/2" shimmer />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="oc-container-wide py-5 lg:py-8">
        <div className="flex items-center justify-center w-full py-20">
          <div className="text-center">
            <Spinner size="lg" className="mx-auto mb-4" />
            <p className="text-muted-foreground">{t("competitions.detail.loadingCompetition")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="flex items-center justify-center w-full oc-container-wide py-5 lg:py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">{t("competitions.detail.notFoundTitle")}</h2>
          <p className="text-muted-foreground mb-4">{t("competitions.detail.notFoundDesc")}</p>
          <GoldOutlineButton onClick={() => navigate(localeHref("/competitions", locale))}>
            {t("competitions.detail.browseCompetitions")}
          </GoldOutlineButton>
        </div>
      </div>
    );
  }

  const allImages = Array.from(
    new Set<string>([
      ...(competition.prizeImages?.filter(Boolean) ?? []),
      ...(competition.imageUrl ? [competition.imageUrl] : []),
      ...(competition.heroImageUrl ? [competition.heroImageUrl] : []),
      ...(competition.prizeImageUrl ? [competition.prizeImageUrl] : []),
    ])
  );
  const images = allImages.filter((url) => !failedImages.has(url));
  const mainImageUrl = images[currentImageIndex] ?? null;

  return (
    <>
      <div className="oc-container-wide py-4 lg:py-8 pb-20">
        <CompetitionInfo competition={competition} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
          <div className="space-y-4 lg:space-y-6">
            <div className="relative aspect-[4/3] lg:aspect-[3/2] bg-gradient-to-br from-gold/20 to-gold/5 rounded-xl lg:rounded-2xl border border-gold/20 overflow-hidden group">
              {mainImageUrl && !failedImages.has(mainImageUrl) ? (
                <img
                  src={mainImageUrl}
                  alt={competition.title}
                  className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxOpen(true)}
                  onError={() => setFailedImages((prev) => new Set(prev).add(mainImageUrl))}
                  data-umami-event="competition:image-click"
                  data-umami-event-id={slug}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Trophy className="w-24 h-24 text-gold/40" />
                </div>
              )}

              {images.length > 0 && (
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 cursor-zoom-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxOpen(true);
                  }}
                >
                  <ZoomIn className="w-10 h-10 text-white/80" />
                </div>
              )}

              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                    onClick={() =>
                      setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
                    }
                    data-umami-event="competition:image-prev"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                    onClick={() =>
                      setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
                    }
                    data-umami-event="competition:image-next"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </>
              )}

              {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                  {currentImageIndex + 1} / {images.length}
                </div>
              )}

              {ticketsRemaining === 0 ? (
                <Badge className="absolute top-4 left-4 bg-red-500/20 text-red-400 border-red-500/30">
                  {t("competitions.detail.soldOut")}
                </Badge>
              ) : (
                <Badge
                  className={`absolute top-4 left-4 ${statusConfig[competition.status]?.className ?? statusConfig.active?.className}`}
                >
                  {statusConfig[competition.status]?.label ??
                    statusConfig.active?.label ??
                    t("competitions.detail.active")}
                </Badge>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory lg:flex-wrap lg:overflow-x-visible lg:gap-3 lg:pb-2 lg:snap-none">
                {images.map((img, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      setCurrentImageIndex(idx);
                      setLightboxOpen(true);
                    }}
                    data-umami-event="competition:thumbnail-click"
                    data-umami-event-index={idx}
                    className={`h-16 w-16 lg:h-32 lg:w-32 rounded-lg lg:rounded-xl border-2 flex-shrink-0 snap-start transition-all overflow-hidden relative ${
                      idx === currentImageIndex
                        ? "border-gold ring-2 ring-gold/30"
                        : "border-border hover:border-gold/50 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={() => setFailedImages((prev) => new Set(prev).add(img))}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 lg:space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-1.5 lg:mb-2 leading-tight">
                {competition.title}
              </h1>
              {(bonusDrawsCount > 0 || instantWinsCount > 0) && (
                <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
                  {bonusDrawsCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById("bonus-draws")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-gradient-to-r from-gold-light to-gold px-3 py-1.5 text-sm font-bold uppercase tracking-wider text-black transition-[filter,transform] hover:brightness-110 active:scale-95"
                    >
                      <Star className="size-4" />
                      {t("competitions.detail.bonusDrawsPill", {
                        count: formatNumber(bonusDrawsCount, locale),
                      })}
                    </button>
                  )}
                  {instantWinsCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById("instant-wins")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-gradient-to-r from-gold-light to-gold px-3 py-1.5 text-sm font-bold uppercase tracking-wider text-black transition-[filter,transform] hover:brightness-110 active:scale-95"
                    >
                      <Gift className="size-4" />
                      {t("competitions.detail.instantWinsPill", {
                        count: formatNumber(instantWinsCount, locale),
                      })}
                    </button>
                  )}
                </div>
              )}
              {competition.shortDescription && (
                <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-3 lg:mb-4 whitespace-pre-wrap leading-relaxed">
                  {competition.shortDescription}
                </p>
              )}
              <div className="flex items-baseline gap-2 flex-wrap">
                {isCashOnly(competition) ? (
                  <span className="text-base lg:text-xl font-bold text-gold">
                    {t("competitions.detail.taxFree")}
                  </span>
                ) : competition.prizeValue && competition.prizeValue > 0 ? (
                  <>
                    <span className="text-base lg:text-xl font-bold text-gold">
                      {formatCurrency(competition.prizeValue, locale, competition.currency)}
                    </span>
                    <span className="text-base lg:text-xl font-bold text-white">
                      {t("competitions.detail.cashAlternative")}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl lg:rounded-[1.5rem]">
              <div className="p-1 lg:p-1.5 rounded-xl lg:rounded-[1.5rem] bg-white/5 ring-1 ring-white/10">
                <div className="rounded-[calc(1.25rem-0.25rem)] lg:rounded-[calc(1.5rem-0.375rem)] bg-card p-3 lg:p-6 space-y-3 lg:space-y-6">
                  {competition.requireSignIn && isAnonymous ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center">
                        {t("competitions.detail.signInRequired")}
                      </p>
                      <GoldButton
                        className="w-full"
                        onClick={() => {
                          const returnTo = localeHref(`/competitions/${competition.slug}`, locale);
                          navigate(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
                        }}
                        data-umami-event="competition:sign-in-to-enter"
                      >
                        {t("competitions.detail.signInToEnter")}
                      </GoldButton>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3" ref={quantitySectionRef}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <GoldOutlineButton
                              size="icon"
                              onClick={() => setQuantityWithLimit(quantity - 1)}
                              disabled={quantity <= 1 || maxCartQuantity === 0}
                              className="h-10 w-10 rounded-full active:scale-95 transition-all"
                              data-umami-event="competition:quantity-decrement"
                            >
                              <Minus className="size-5" />
                            </GoldOutlineButton>
                            <Input
                              type="number"
                              value={quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                setQuantityWithLimit(val);
                              }}
                              min={1}
                              max={maxCartQuantity || undefined}
                              className="w-20 text-center text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                            />
                            <GoldOutlineButton
                              size="icon"
                              onClick={() => setQuantityWithLimit(quantity + 1)}
                              disabled={atQuantityLimit || maxCartQuantity === 0}
                              className="h-10 w-10 rounded-full active:scale-95 transition-all"
                              data-umami-event="competition:quantity-increment"
                            >
                              <Plus className="size-5" />
                            </GoldOutlineButton>
                          </div>
                          {liveAvailable <= 0 ? (
                            <span className="text-base sm:text-lg lg:text-xl text-white line-through">
                              {competition.ticketPrice
                                ? `${formatCurrency(
                                    competition.originalPrice ?? competition.ticketPrice ?? 0,
                                    locale,
                                    "GBP"
                                  )} ${t("competitions.detail.perTicket")}`
                                : t("competitions.detail.free")}
                            </span>
                          ) : (competition.ticketPrice ?? 0) > 0 ? (
                            <span className="text-base sm:text-lg lg:text-xl font-bold text-gold">
                              {formatCurrency(competition.ticketPrice ?? 0, locale, "GBP")}{" "}
                              {t("competitions.detail.perTicket")}
                            </span>
                          ) : (
                            <span className="text-base sm:text-lg lg:text-xl font-bold text-gold">
                              {t("competitions.detail.free")}
                            </span>
                          )}
                        </div>
                        {maxCartQuantity > 0 && !atPersonalLimit && liveAvailable > 0 ? (
                          <p className="text-xs text-foreground">
                            {userOwned > 0 ? (
                              <>
                                {t("competitions.detail.youAlreadyOwn", {
                                  count: formatNumber(userOwned, locale),
                                })}
                                {maxPurchasable > 0
                                  ? ` · ${t("competitions.detail.upToPerPerson", { max: formatNumber(maxCartQuantity, locale) })}`
                                  : currentInCart > 0
                                    ? ` · ${t("competitions.detail.alreadyInCart", { count: formatNumber(currentInCart, locale) })} (${t("competitions.detail.inCart")})`
                                    : ` · ${t("competitions.detail.limitReached")}`}
                              </>
                            ) : maxPerUser > 0 && maxCartQuantity === maxPerUser - userOwned ? (
                              t("competitions.detail.upToPerPerson", {
                                max: formatNumber(maxCartQuantity, locale),
                              })
                            ) : (
                              t("competitions.detail.ticketsAvailable", {
                                max: formatNumber(maxCartQuantity, locale),
                              })
                            )}
                            {currentInCart > 0 &&
                            maxPurchasable > 0 &&
                            currentInCart < maxCartQuantity
                              ? ` · ${t("competitions.detail.alreadyInCart", { count: formatNumber(currentInCart, locale) })}`
                              : ""}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2.5">
                        <p className="text-base sm:text-lg text-muted-foreground">
                          {t("competitions.detail.quickAdd")}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                          {[5, 25, 50, 100].map((amount) => (
                            <GoldOutlineButton
                              key={amount}
                              type="button"
                              onClick={() => setQuantityWithLimit(quantity + amount)}
                              disabled={maxCartQuantity === 0 || atQuantityLimit}
                              className="h-11 sm:h-12 rounded-xl px-4 text-base sm:text-lg shadow-sm"
                              data-umami-event={`competition:quick-add-${amount}`}
                            >
                              +{amount}
                            </GoldOutlineButton>
                          ))}
                          <GoldOutlineButton
                            type="button"
                            onClick={() => setQuantityWithLimit(maxCartQuantity)}
                            disabled={maxCartQuantity === 0 || atQuantityLimit}
                            className="h-11 sm:h-12 rounded-xl px-4 text-base sm:text-lg font-bold shadow-sm"
                            data-umami-event="competition:quick-add-max"
                          >
                            {t("competitions.detail.max")}
                          </GoldOutlineButton>
                        </div>
                      </div>

                      {competition.question &&
                        competition.questionOptions &&
                        competition.questionOptions.length > 0 && (
                          <div className="space-y-3 pt-2" ref={quizSectionRef}>
                            <div className="relative overflow-hidden rounded-xl border border-gold/30 bg-gradient-to-r from-gold/10 via-gold/5 to-gold/10 p-4 text-center">
                              <p className="text-xs font-bold text-gold uppercase tracking-wider mb-0.5">
                                {t("competitions.detail.skillBasedCompetition")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("competitions.detail.answerCorrectly")}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-gold" />
                                <span className="text-sm font-medium text-foreground">
                                  {t("competitions.detail.skillQuestion")}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold border border-gold/30 bg-gold/10 px-2.5 py-1 rounded-full">
                                <HelpCircle className="w-3 h-3" />
                                {t("competitions.detail.required")}
                              </span>
                            </div>
                            <p className="text-base sm:text-lg font-medium text-foreground">
                              {competition.question}
                            </p>
                            <div className="grid grid-cols-1 gap-2.5">
                              {competition.questionOptions.map((option, idx) => (
                                <label
                                  key={idx}
                                  className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all text-base sm:text-lg ${
                                    answerIndex === idx
                                      ? "border-gold bg-gold/10"
                                      : "border-border hover:border-gold/30 hover:bg-gold/5"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="skill-answer"
                                    value={idx}
                                    checked={answerIndex === idx}
                                    onChange={() => setAnswerIndex(idx)}
                                    className="w-4 h-4 accent-gold"
                                  />
                                  <span
                                    className={
                                      answerIndex === idx
                                        ? "text-gold font-medium"
                                        : "text-foreground"
                                    }
                                  >
                                    {option}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                      <div className="flex items-center justify-between py-2 lg:py-4 border-t border-b border-gold/10">
                        <span className="text-sm lg:text-lg font-medium text-foreground">
                          {t("competitions.detail.total")}
                        </span>
                        <div className="text-right">
                          <span className="text-xl lg:text-3xl font-bold text-gold">
                            {formatCurrency(totalPrice, locale, "GBP")}
                          </span>
                          {quantity === 1 ? (
                            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                              {(competition.ticketPrice ?? 0) > 0 ? (
                                competition.originalPrice != null &&
                                competition.originalPrice > (competition.ticketPrice ?? 0) ? (
                                  <>
                                    <span className="line-through text-muted-foreground mr-1.5">
                                      {formatCurrency(competition.originalPrice, locale, "GBP")}
                                    </span>
                                    {formatCurrency(competition.ticketPrice ?? 0, locale, "GBP")}{" "}
                                    {t("competitions.detail.perTicket")}
                                  </>
                                ) : (
                                  <>
                                    {formatCurrency(competition.ticketPrice ?? 0, locale, "GBP")}{" "}
                                    {t("competitions.detail.perTicket")}
                                  </>
                                )
                              ) : (
                                t("competitions.detail.free")
                              )}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {atPersonalLimit ? (
                        <div className="bg-gold/10 border border-gold/20 rounded-xl px-4 py-3 flex items-center gap-3">
                          <Shield className="w-5 h-5 text-gold flex-shrink-0" />
                          <p className="text-sm text-gold">
                            {maxTicketsReason(userOwned, maxPerUser, t)}
                          </p>
                        </div>
                      ) : liveAvailable <= 0 ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                          <Ticket className="w-5 h-5 text-red-400 flex-shrink-0" />
                          <p className="text-sm text-red-400">
                            {t("competitions.detail.soldOutBanner")}
                          </p>
                        </div>
                      ) : maxPurchasable === 0 && maxCartQuantity > 0 && currentInCart > 0 ? (
                        <p className="text-sm text-muted-foreground text-center">
                          {t("competitions.detail.ticketLimitReached")}
                          {userOwned > 0
                            ? ` (${formatNumber(userOwned, locale)} owned${currentInCart > 0 ? `, ${formatNumber(currentInCart, locale)} in cart` : ""})`
                            : ""}
                        </p>
                      ) : userOwned > 0 && maxPurchasable > 0 ? (
                        <p className="text-sm text-muted-foreground text-center">
                          {t("competitions.detail.canPurchaseMore", {
                            count: userOwned,
                            owned: formatNumber(userOwned, locale),
                            more: formatNumber(maxPurchasable, locale),
                          })}
                        </p>
                      ) : null}

                      <GoldButton
                        className="w-full"
                        onClick={() => {
                          if (
                            competition.status !== "active" ||
                            isAdding ||
                            quantity < 1 ||
                            quantity > maxCartQuantity ||
                            maxCartQuantity === 0 ||
                            (!!competition.question && answerIndex < 0)
                          ) {
                            handleDisabledClick();
                          } else {
                            handleAddToCart();
                          }
                        }}
                        disabled={
                          competition.status !== "active" ||
                          isAdding ||
                          quantity < 1 ||
                          quantity > maxCartQuantity ||
                          maxCartQuantity === 0 ||
                          (!!competition.question && answerIndex < 0)
                        }
                        data-umami-event="competition:add-to-cart"
                        data-umami-event-quantity={quantity}
                        data-umami-event-total={totalPrice.toFixed(2)}
                      >
                        {isAdding ? (
                          <>
                            <Spinner size="sm" className="mr-2" aria-hidden />
                            {t("competitions.detail.saving")}
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5 mr-2" />
                            {currentInCart > 0
                              ? t("competitions.detail.updateCart")
                              : t("competitions.detail.addToCart")}
                          </>
                        )}
                      </GoldButton>

                      {!cartPending &&
                        currentInCart > 0 &&
                        !atPersonalLimit &&
                        quantity !== currentInCart && (
                          <p className="text-center text-sm text-gold">
                            {t("competitions.detail.cartUpdateInfo", {
                              count: quantity,
                              from: formatNumber(currentInCart, locale),
                              to: formatNumber(quantity, locale),
                            })}
                          </p>
                        )}

                      <div className="flex items-center justify-center gap-4 pt-4 border-t border-gold/10">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Shield className="w-4 h-4" />
                          {t("competitions.detail.securePayment")}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Ticket className="w-4 h-4" />
                          {t("competitions.detail.verifiedDraw")}
                        </div>
                      </div>

                      <div className="relative overflow-hidden rounded-xl border border-gold/20 bg-gradient-to-br from-gold/5 to-gold/10 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0">
                            <Gift className="w-5 h-5 text-gold" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {t("competitions.detail.referFriend")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("competitions.detail.referFriendDesc")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShareOpen(true)}
                            data-umami-event="competition:share-click"
                            className="flex items-center gap-1.5 bg-gold/10 hover:bg-gold/20 border border-gold/30 text-gold px-3 py-2 rounded-full text-xs font-semibold transition-all flex-shrink-0"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            {t("competitions.detail.share")}
                          </button>
                        </div>
                      </div>

                      <p className="text-center text-xs text-foreground pt-2">
                        {t("competitions.detail.ageNotice")}
                      </p>

                      {showPostalCta ? (
                        <Link
                          href="/free-postal-entry"
                          data-umami-event="competition:postal-entry-link"
                          className="flex items-center gap-3 p-3 rounded-xl border border-gold/20 bg-gradient-to-r from-gold/5 to-gold/10 hover:border-gold/40 transition-colors"
                        >
                          <Mail className="w-5 h-5 text-gold flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {t("competitions.detail.freePostalAvailable")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("competitions.detail.freePostalDesc")}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gold flex-shrink-0" />
                        </Link>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-gold" />
                  <span className="font-medium text-foreground text-[17px]">
                    {t("competitions.detail.ticketSales")}
                  </span>
                </div>
              </div>
              <CompetitionProgressBar
                competition={{
                  _id: competitionId,
                  ticketsSold: soldTickets,
                  maxTickets,
                }}
                bonusAwards={bonusAwards}
                variant="detail"
                countdownLabel={`${countdown}s`}
              />
            </div>

            {competition.drawDate && <CountdownTimer targetDate={String(competition.drawDate)} />}
          </div>
        </div>

        <div className="mt-8">
          <div className="relative overflow-hidden rounded-xl lg:rounded-[2rem]">
            <div className="p-1 lg:p-1.5 rounded-xl lg:rounded-[2rem] bg-white/5 ring-1 ring-white/10">
              <div className="rounded-[calc(1.25rem-0.25rem)] lg:rounded-[calc(2rem-0.375rem)] bg-card p-4 lg:p-8">
                <h3 className="flex items-center justify-between w-full">
                  <button
                    type="button"
                    onClick={() => setAboutOpen(!aboutOpen)}
                    className="flex items-center justify-between w-full text-left"
                    aria-expanded={aboutOpen}
                    data-umami-event="competition:about-toggle"
                  >
                    <div className="flex items-center gap-2.5 lg:gap-3">
                      <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-gold/10 flex items-center justify-center">
                        <Trophy className="w-4 h-4 lg:w-5 lg:h-5 text-gold" />
                      </div>
                      <span className="text-base lg:text-lg font-bold text-foreground">
                        {t("competitions.detail.aboutThisPrize")}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${aboutOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </h3>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    aboutOpen ? "max-h-[5000px] opacity-100 mt-4 lg:mt-6" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="border-t border-gold/10 pt-4 lg:pt-6">
                    <p className="text-sm lg:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {competition.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(bonusAwards.length > 0 || bonusAwardWins.length > 0) && (
          <div id="bonus-draws" className="mt-8 scroll-mt-24">
            <BonusAwardsSection
              awards={bonusAwards}
              wins={bonusAwardWins}
              ticketsSold={soldTickets}
              maxTickets={maxTickets}
            />
          </div>
        )}

        {instantPrizesLoading ? (
          <div id="instant-wins" className="mt-8 space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gold/10 animate-pulse" />
              <div className="h-6 w-32 bg-gold/10 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" shimmer />
              ))}
            </div>
          </div>
        ) : instantPrizes.length > 0 ? (
          <div id="instant-wins" className="mt-8 scroll-mt-24">
            <InstantWinsSection competitionId={competitionId} />
          </div>
        ) : null}

        {relatedComps.length > 0 && <RelatedCompetitions competitions={relatedComps} />}

        <CompetitionFaq competition={competition} />
      </div>

      <BrandDialog
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        mode="fullscreen"
        images={images}
        currentIndex={currentImageIndex}
        onIndexChange={setCurrentImageIndex}
      />

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareConfig={{
          url: `${typeof window !== "undefined" ? window.location.origin : ""}/`,
          text: `Check out this competition: ${competition.title}`,
          referralCode: myReferralCode,
        }}
        title={t("competitions.detail.share")}
      />
    </>
  );
}
