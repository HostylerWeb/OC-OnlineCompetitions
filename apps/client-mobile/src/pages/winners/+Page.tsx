"use client";

import { useWinners } from "@oc/api-client";

import { ArrowRight, Calendar, MapPin, Sparkles, Ticket, Trophy } from "@oc/icons";
import type { Winner } from "@oc/types";
import { cn, formatDate, getDisplayName } from "@oc/utils";
import { useMemo, useState } from "react";
import { GoldOutlineButton } from "@/components/buttons";
import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import { Link } from "@/components/Link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber, useTranslation } from "@/lib/i18n";

function getCompetitionIdObject(winner: Winner) {
  return typeof winner.competitionId === "object" && winner.competitionId !== null
    ? winner.competitionId
    : null;
}

function getCompetitionTitle(winner: Winner): string {
  const comp = getCompetitionIdObject(winner);
  if (comp?.title) return comp.title;
  return winner.competitionTitle ?? winner.competition?.title ?? "";
}

function getWinnerImages(winner: Winner): string[] {
  return Array.from(
    new Set<string>([
      ...(winner.prizeImageUrl ? [winner.prizeImageUrl] : []),
      ...(winner.winnerPhotoUrl ? [winner.winnerPhotoUrl] : []),
    ])
  ).filter(Boolean);
}

function _formatPrizeValue(value?: number): string | null {
  if (value == null || value <= 0) return null;
  return `£${value.toLocaleString("en-GB")}`;
}

function formatStatsPrizeValue(value: number, locale: string): string | null {
  if (value <= 0) return null;
  if (value >= 1_000_000) {
    return `£${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `£${Math.round(value / 1_000).toLocaleString("en-GB")}K`;
  }
  return formatCurrency(value, locale);
}

type PopulatedWinnerUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
};

function getPopulatedWinnerUser(winner: Winner): PopulatedWinnerUser | null {
  const userId = winner.userId as string | PopulatedWinnerUser;
  if (typeof userId === "object" && userId !== null) {
    return userId;
  }
  return null;
}

function WinnerAvatar({ winner, className }: { winner: Winner; className?: string }) {
  const userObj = getPopulatedWinnerUser(winner);
  const initials = userObj?.firstName
    ? [userObj.firstName, userObj.lastName]
        .filter(Boolean)
        .map((n) => n?.[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : winner.displayName?.[0]?.toUpperCase() || "W";

  const avatarUrl = userObj?.avatarUrl ?? winner.winnerPhotoUrl;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/20 to-gold/5",
        className
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="text-lg font-bold text-gold sm:text-xl">{initials}</span>
      )}
    </div>
  );
}

function WinnerCard({
  winner,
  featured = false,
  onImageClick,
}: {
  winner: Winner;
  featured?: boolean;
  onImageClick?: () => void;
}) {
  const { t, locale } = useTranslation();
  const userObj = getPopulatedWinnerUser(winner);
  const displayName =
    winner.displayName ||
    getDisplayName(
      {
        firstName: userObj?.firstName ?? undefined,
        lastName: userObj?.lastName ?? undefined,
      },
      userObj?.email ?? ""
    ) ||
    t("staticPages.winners.anonymousWinner");
  const cardImage = getWinnerImages(winner)[0];
  const prizeValueLabel =
    winner.prizeValue != null && winner.prizeValue > 0
      ? formatCurrency(winner.prizeValue, locale)
      : null;
  const competitionTitle = getCompetitionTitle(winner);
  const drawnDate = formatDate(winner.drawnAt);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[1.5rem] transition-transform duration-300 hover:-translate-y-0.5",
        featured && "lg:col-span-2"
      )}
    >
      <div
        className={cn(
          "rounded-[1.5rem] p-1.5 ring-1 transition-colors duration-500",
          featured ? "bg-gold/10 ring-gold/25" : "bg-white/5 ring-white/10 hover:ring-gold/25"
        )}
      >
        <div
          className={cn(
            "overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-card",
            featured ? "grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" : "flex flex-col"
          )}
        >
          <div
            className={cn(
              "relative overflow-hidden bg-gradient-to-br from-gold/10 to-background",
              featured ? "min-h-[220px] lg:min-h-full" : "aspect-[16/10]"
            )}
          >
            {cardImage ? (
              <button
                type="button"
                onClick={onImageClick}
                aria-label={t("staticPages.winners.viewPrizeImage", {
                  prize: winner.prizeTitle || "prize",
                })}
                data-umami-event="winners:image-click"
                data-umami-event-winner={winner._id}
                className="absolute inset-0 z-10 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                <span className="sr-only">{t("staticPages.winners.openPreview")}</span>
              </button>
            ) : null}
            {cardImage ? (
              <img
                src={cardImage}
                alt={winner.prizeTitle || t("staticPages.winners.prize")}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full min-h-[180px] items-center justify-center bg-gradient-to-br from-gold/10 to-gold/5">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold/20 bg-card">
                    <Trophy className="h-6 w-6 text-gold/60" />
                  </div>
                  <span className="text-xs font-medium text-gold/50">
                    {winner.prizeTitle || t("staticPages.winners.prize")}
                  </span>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            {prizeValueLabel ? (
              <div className="absolute bottom-3 left-3 rounded-full border border-gold/30 bg-black/55 px-3 py-1 text-sm font-bold text-gold backdrop-blur-sm">
                {prizeValueLabel}
              </div>
            ) : null}
            {featured ? (
              <Badge className="absolute left-3 top-3 z-20 border-0 bg-gold text-primary-foreground">
                <Sparkles className="mr-1 h-3 w-3" />
                {t("staticPages.winners.latestWinner")}
              </Badge>
            ) : null}
          </div>

          <div className={cn("flex flex-col p-4 sm:p-5 lg:p-6", featured && "justify-center")}>
            <div className="mb-4 flex items-center gap-3">
              <WinnerAvatar winner={winner} className="h-12 w-12 sm:h-14 sm:w-14" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground sm:text-lg">
                  {displayName}
                </p>
                {winner.location ? (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{winner.location}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold">
                <Trophy className="h-4 w-4 text-black" />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-gold/10 bg-gradient-to-br from-gold/5 to-transparent p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("staticPages.winners.prizeWon")}
                </p>
                <p className="mt-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
                  {winner.prizeTitle || competitionTitle || t("staticPages.winners.luxuryPrize")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-gold/80" />
                  {drawnDate}
                </span>
                {winner.ticketNumber > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Ticket className="h-3.5 w-3.5 shrink-0 text-gold/80" />
                    {t("staticPages.winners.ticketNumber")}
                    {formatNumber(winner.ticketNumber, locale)}
                  </span>
                ) : null}
              </div>
            </div>

            {winner.testimonial ? (
              <blockquote className="mt-4 border-l-2 border-gold/30 pl-4 text-sm italic leading-relaxed text-muted-foreground sm:text-base">
                &ldquo;{winner.testimonial}&rdquo;
              </blockquote>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function WinnersEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-gold/15 bg-gradient-to-br from-gold/5 via-card to-card px-6 py-14 text-center sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-gold/20 bg-card">
        <Trophy className="h-10 w-10 text-gold/70" />
      </div>

      <h2 className="relative text-2xl font-bold text-foreground sm:text-3xl">
        {t("staticPages.winners.winnersComing")}
      </h2>
      <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {t("staticPages.winners.winnersComingDesc")}
      </p>

      <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <GoldOutlineButton asChild size="lg">
          <Link href="/competitions" data-umami-event="winners:browse-competitions">
            {t("staticPages.winners.browseLiveComps")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </GoldOutlineButton>
        <GoldOutlineButton asChild size="lg">
          <Link href="/auth/sign-up" data-umami-event="winners:create-account">
            {t("staticPages.winners.createFreeAccount")}
          </Link>
        </GoldOutlineButton>
      </div>
    </div>
  );
}

export default function Page() {
  const { t, locale } = useTranslation();

  const {
    data: winnersResponse,
    isLoading,
    isError: winnersError,
    refetch: refetchWinners,
  } = useWinners(50);
  const winners = winnersResponse?.data ?? [];

  // TODO: fetch winners stats via query hook
  const stats: { totalPrizeValue: number; totalWinners: number } | null = null as any;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  function openLightbox(winner: Winner) {
    const images = getWinnerImages(winner);
    if (images.length === 0) return;
    setLightboxImages(images);
    setLightboxIndex(0);
    setLightboxOpen(true);
  }

  const hasError = winnersError;
  const totalPrizeLabel = stats ? formatStatsPrizeValue(stats.totalPrizeValue, locale) : null;
  const showWinnerCount = (stats?.totalWinners ?? 0) > 0;
  const showPrizeValue = Boolean(totalPrizeLabel);
  const showStats = showWinnerCount || showPrizeValue;
  const hasWinnerData = winners.length > 0;
  const showHero = !isLoading && hasWinnerData;

  return (
    <div className="oc-container-wide pb-10 animate-fade-in">
      {showHero ? (
        <section className="relative overflow-hidden py-8 sm:py-12 lg:py-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-gold/10 to-transparent" />

          <div className="relative text-center">
            <Badge className="mb-4 border-gold/25 bg-gold/10 text-gold">
              {t("staticPages.winners.publicGallery")}
            </Badge>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/20 bg-card lg:h-16 lg:w-16">
              <Trophy className="h-7 w-7 text-gold lg:h-8 lg:w-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t("staticPages.winners.heading")}{" "}
              <span className="text-gold">{t("staticPages.winners.subheading")}</span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
              {t("staticPages.winners.heroDesc")}
            </p>
          </div>
        </section>
      ) : null}

      {isLoading && (
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-[1.5rem]" shimmer />
          ))}
        </div>
      )}

      {!isLoading && showStats && (
        <div
          className={cn(
            "mb-10 grid gap-4",
            showWinnerCount && showPrizeValue ? "sm:grid-cols-2" : "max-w-md mx-auto"
          )}
        >
          {showPrizeValue ? (
            <div className="rounded-[1.5rem] bg-gold/5 p-1.5 ring-1 ring-gold/20">
              <div className="rounded-[calc(1.5rem-0.375rem)] bg-card px-5 py-6 text-center sm:px-6">
                <p className="text-3xl font-bold text-gold sm:text-4xl">{totalPrizeLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("staticPages.winners.totalPrizesAwarded")}
                </p>
              </div>
            </div>
          ) : null}
          {showWinnerCount ? (
            <div className="rounded-[1.5rem] bg-white/5 p-1.5 ring-1 ring-white/10">
              <div className="rounded-[calc(1.5rem-0.375rem)] bg-card px-5 py-6 text-center sm:px-6">
                <p className="text-3xl font-bold text-gold sm:text-4xl">
                  {formatNumber(stats!.totalWinners, locale)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stats!.totalWinners === 1
                    ? t("staticPages.winners.happyWinner")
                    : t("staticPages.winners.happyWinners")}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {hasError && (
        <div className="mb-10 text-center">
          <p className="text-muted-foreground">{t("staticPages.winners.unableToLoad")}</p>
          <button
            type="button"
            onClick={() => {
              refetchWinners();
            }}
            data-umami-event="winners:retry"
            className="mt-2 text-xs text-muted-foreground/60 hover:text-gold transition-colors"
          >
            {t("common.tapToRetry")}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="mb-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 rounded-[1.5rem]" shimmer />
          ))}
        </div>
      ) : winners.length > 0 ? (
        <div className="mb-12 grid grid-cols-1 gap-5 lg:grid-cols-2 animate-fade-in-stagger">
          {winners.map((winner, index) => (
            <WinnerCard
              key={winner._id}
              winner={winner}
              featured={index === 0}
              onImageClick={() => openLightbox(winner)}
            />
          ))}
        </div>
      ) : !hasError ? (
        <div className={cn("mb-12", !showHero && "pt-8 sm:pt-10")}>
          <WinnersEmptyState />
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[2rem]">
        <div className="rounded-[2rem] bg-gradient-to-r from-gold/5 to-gold/10 p-1.5 ring-1 ring-gold/20">
          <div className="rounded-[calc(2rem-0.375rem)] bg-card px-6 py-10 text-center sm:px-12 sm:py-12">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t("staticPages.winners.couldYouBeNext")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              {t("staticPages.winners.couldYouBeNextDesc")}
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <GoldOutlineButton asChild size="lg">
                <Link href="/competitions">
                  {t("staticPages.winners.viewLiveComps")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </GoldOutlineButton>
              <GoldOutlineButton asChild size="lg">
                <Link href="/auth/sign-up">{t("staticPages.winners.signUpFree")}</Link>
              </GoldOutlineButton>
            </div>
          </div>
        </div>
      </section>

      <ImagePreviewDialog
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        variant="medium"
        alt={t("staticPages.winners.prizePreview")}
      />
    </div>
  );
}
