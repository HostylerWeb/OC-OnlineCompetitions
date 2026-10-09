import { Clock, Trophy, Zap } from "@oc/icons";
import type { Category, Competition, EntryCompetition } from "@oc/types";
import {
  CountdownLabel,
  cn,
  getAvailableTickets,
  getCompetitionCountdownTarget,
  getCompetitionImageUrl,
  getProgress,
  getTicketsSold,
} from "@oc/utils";

import { useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { CompetitionCardCountdown } from "@/components/home/CompetitionCardCountdown";
import { useCountdown } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompetitionProgressBar } from "@/components/ui/competition-progress-bar";
import { formatCurrency, formatDate, useTranslation } from "@/lib/i18n";
import { PriceBadge } from "./PriceBadge";

type CompetitionCardSource = Competition | EntryCompetition;

interface CompetitionCardProps {
  competition: CompetitionCardSource;
  variant?: "default" | "compact" | "hot";
  categories?: Category[];
  /** Mark this card's image as LCP. Pass on the first above-the-fold card. */
  priority?: boolean;
  /** Override the link target. Defaults to /competitions/:slug. */
  href?: string;
  umamiEvent?: string;
  /** When set, card acts as a button (no navigation). */
  onCardClick?: () => void;
  /** Footer CTA when competition is active and not sold out (compact variant). */
  ctaLabel?: string;
}

function getCompId(comp: CompetitionCardSource): string {
  if ("_id" in comp && comp._id) return comp._id;
  if ("id" in comp && comp.id) return comp.id;
  return "";
}

function getCompSlug(comp: CompetitionCardSource): string {
  if ("slug" in comp && comp.slug) return comp.slug;
  return getCompId(comp);
}

function getImageUrl(comp: CompetitionCardSource): string | undefined {
  if ("updatedAt" in comp || "prizeImageUrl" in comp || "imageUrl" in comp) {
    return getCompetitionImageUrl({
      prizeImageUrl: "prizeImageUrl" in comp ? comp.prizeImageUrl : undefined,
      imageUrl: "imageUrl" in comp ? comp.imageUrl : undefined,
      updatedAt: "updatedAt" in comp ? comp.updatedAt : undefined,
    });
  }
  return undefined;
}

function getMaxTickets(comp: CompetitionCardSource): number {
  if ("maxTickets" in comp && comp.maxTickets != null) return comp.maxTickets;
  if ("totalTickets" in comp && comp.totalTickets != null) return comp.totalTickets;
  return 0;
}

function getTicketPrice(comp: CompetitionCardSource): number {
  if ("ticketPrice" in comp && comp.ticketPrice != null) return comp.ticketPrice;
  return 0;
}

function getPrizeValue(comp: CompetitionCardSource): number {
  if ("prizeValue" in comp && comp.prizeValue != null) return comp.prizeValue;
  return 0;
}

function getCurrency(comp: CompetitionCardSource): string {
  if ("currency" in comp && comp.currency) return comp.currency;
  return "GBP";
}

function getHref(comp: CompetitionCardSource): string {
  return `/competitions/${getCompSlug(comp)}`;
}

function useCompCountdown(comp: CompetitionCardSource, enabled: boolean) {
  const countdownDate =
    getCompetitionCountdownTarget({
      drawDate: "drawDate" in comp ? comp.drawDate : undefined,
      endDate: "endDate" in comp ? comp.endDate : undefined,
    }) ?? undefined;
  return useCountdown(countdownDate, enabled);
}

export function CompetitionCard({
  competition: comp,
  variant = "default",
  categories,
  href: hrefOverride,
  umamiEvent,
  onCardClick,
  ctaLabel: ctaLabelOverride,
}: CompetitionCardProps) {
  const { t, locale } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const linkHref = hrefOverride ?? getHref(comp);
  const totalTickets = getMaxTickets(comp);
  const soldTickets = getTicketsSold(comp);
  const isActive = comp.status === "active";
  const percentageSold = getProgress(soldTickets, totalTickets);
  const ticketsLeft = getAvailableTickets(comp);
  const imageUrl = getImageUrl(comp);
  const timeLeft = useCompCountdown(comp, isActive);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const categoryLabel =
    "category" in comp && comp.category
      ? (categories?.find((c) => c.slug === comp.category)?.label ??
        categories?.find((c) => c.slug === comp.category)?.name)
      : undefined;

  if (variant === "hot") {
    return (
      <Link
        href={linkHref}
        className="group block h-full"
        data-umami-event={umamiEvent || "competitions:card-click"}
        data-umami-event-id={getCompSlug(comp)}
        data-umami-event-title={comp.title}
        data-umami-event-price={getTicketPrice(comp)}
      >
        <div className="rounded-[calc(2rem-1px)] bg-[var(--surface-2,theme(colors.card))] border border-[var(--border-subtle,theme(colors.white/5))] overflow-hidden hover:border-[var(--border-active,theme(colors.gold/30))] transition-all duration-300 h-full">
          <div className="relative h-32 bg-gradient-to-br from-gold/10 to-[var(--surface-1,theme(colors.background))]">
            {imageUrl && !imageFailed ? (
              <img
                src={imageUrl}
                alt={comp.title}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-gold/20" />
              </div>
            )}
            <div className="absolute top-2 right-2 bg-gold text-primary-foreground text-[11px] font-bold px-2.5 py-1 rounded-full">
              {(() => {
                const tp = getTicketPrice(comp);
                const op = (comp as any).originalPrice;
                const cur = "GBP";
                if (tp === 0) return t("home.free");
                return op != null && op > tp ? (
                  <>
                    <span className="line-through text-primary-foreground/60 mr-1">
                      {formatCurrency(op, locale, cur)}
                    </span>
                    {formatCurrency(tp, locale, cur)}
                    {t("home.perTicket")}
                  </>
                ) : (
                  <>
                    {formatCurrency(tp, locale, cur)}
                    {t("home.perTicket")}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="p-4">
            <p className="text-[15px] font-semibold text-[var(--text-primary,theme(colors.foreground))] truncate group-hover:text-gold transition-colors">
              {comp.title}
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-lg font-bold text-gold">
                {formatCurrency(getPrizeValue(comp), locale, getCurrency(comp))}
              </span>
              <span className="text-xs text-[var(--text-muted,theme(colors.muted-foreground))]">
                {t("home.pctSold", { percent: percentageSold.toFixed(0) })}
              </span>
            </div>
            <div className="h-1 bg-[var(--border-subtle,theme(colors.white/5))] rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-gold-dark"
                style={{ width: `${percentageSold}%` }}
              />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    const drawDate = "drawDate" in comp ? comp.drawDate : undefined;
    const cardUmami = {
      "data-umami-event": umamiEvent || "competitions:card-click",
      "data-umami-event-id": getCompSlug(comp),
      "data-umami-event-title": comp.title,
      "data-umami-event-price": getTicketPrice(comp),
    };
    const cardClassName = "@container/card group block h-full min-w-0";
    const cardInner = (
        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gold/10 border-b-0 bg-card shadow-sm transition-colors duration-300 hover:border-gold/30">
          {drawDate && (
            <div className="comp-card-draw-badge absolute top-1.5 right-1.5 @lg/card:top-3 @lg/card:right-3 z-10 max-w-[calc(100%-0.75rem)]">
              <span className="block bg-gold/60 text-black backdrop-blur-sm text-[10px] @lg/card:text-sm font-bold px-2 @lg/card:px-4 py-0.5 @lg/card:py-1.5 rounded-md shadow-md">
                <span className="@sm/card:hidden">
                  {t("home.drawDateShort", { date: formatDate(drawDate, "d MMM", locale) })}
                </span>
                <span className="hidden @sm/card:inline">
                  {t("home.drawDate", { date: formatDate(drawDate, "d MMMM yyyy", locale) })}
                </span>
              </span>
            </div>
          )}
          <div className="relative aspect-[4/3] flex-shrink-0 overflow-hidden">
            {imageUrl && !imageFailed ? (
              <img
                src={imageUrl}
                alt={comp.title}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 50vw"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/20 to-gold/5">
                <Trophy className="w-10 h-10 @lg/card:w-12 @lg/card:h-12 text-gold/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {categoryLabel && (
              <div className="absolute top-1.5 left-1.5 @lg/card:top-3 @lg/card:left-3 z-10 max-w-[55%]">
                <span className="block truncate bg-gold/60 text-black backdrop-blur-sm text-[10px] @lg/card:text-sm font-bold px-2 @lg/card:px-4 py-0.5 @lg/card:py-1.5 rounded-md shadow-md">
                  {categoryLabel}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col flex-1 justify-between p-2 @sm/card:p-4 @lg/card:p-5 gap-1 @sm/card:gap-1.5 @lg/card:gap-2">
            <div>
              <h3 className="font-semibold text-[13px] leading-snug line-clamp-2 @sm/card:text-[16px] @lg/card:text-[21px] text-balance break-words text-gold">
                {comp.title}
              </h3>
            </div>

            <div className="space-y-1.5 @lg/card:space-y-2">
              {"ticketPrice" in comp && (
                <PriceBadge
                  competition={comp as Competition}
                  size="responsive"
                  showPerTicket={false}
                />
              )}
              <CompetitionProgressBar
                competition={{
                  _id: getCompId(comp),
                  ticketsSold: soldTickets,
                  maxTickets: totalTickets,
                }}
                variant="card"
              />

              {isActive && (
                <CompetitionCardCountdown
                  timeLeft={timeLeft}
                  endDate={
                    getCompetitionCountdownTarget({
                      drawDate: "drawDate" in comp ? comp.drawDate : undefined,
                      endDate: "endDate" in comp ? comp.endDate : undefined,
                    }) ?? undefined
                  }
                />
              )}
            </div>
          </div>

          {(() => {
            const ctaActive = isActive && ticketsLeft > 0;
            const ctaLabel = !isActive
              ? t("home.notAvailable")
              : ticketsLeft === 0
                ? t("home.soldOut")
                : (ctaLabelOverride ?? t("home.enterNow"));
            return (
              <div
                className={cn(
                  "mt-auto shrink-0 rounded-b-2xl p-px",
                  ctaActive
                    ? "bg-gradient-to-r from-gold via-amber-500 to-orange-600"
                    : "bg-gradient-to-r from-muted-foreground/25 to-muted-foreground/15"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center rounded-b-[calc(1rem-1px)] py-1.5 text-center @sm/card:py-2.5",
                    "text-[10px] @sm/card:text-sm @lg/card:text-base font-bold uppercase tracking-[0.1em] @sm/card:tracking-[0.14em]",
                    "transition-colors duration-200",
                    ctaActive
                      ? "bg-card text-gold group-hover:bg-gold group-hover:text-primary-foreground"
                      : "bg-card/90 text-muted-foreground"
                  )}
                >
                  {ctaLabel}
                </div>
              </div>
            );
          })()}
        </div>
    );

    if (onCardClick) {
      return (
        <div
          role="button"
          tabIndex={0}
          className={cn(cardClassName, "cursor-pointer")}
          onClick={onCardClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCardClick();
            }
          }}
          {...cardUmami}
        >
          {cardInner}
        </div>
      );
    }

    return (
      <Link href={linkHref} className={cardClassName} {...cardUmami}>
        {cardInner}
      </Link>
    );
  }

  return (
    <Link
      href={linkHref}
      className="group block animate-fade-in-up"
      data-umami-event={umamiEvent || "competitions:card-click"}
      data-umami-event-id={getCompSlug(comp)}
      data-umami-event-title={comp.title}
      data-umami-event-price={getTicketPrice(comp)}
    >
      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative rounded-[2rem] bg-black/5 p-1.5 shadow-xl shadow-gold/5 ring-1 ring-black/5">
          <div className="relative rounded-[calc(2rem-0.375rem)] bg-card overflow-hidden">
            <div className="relative -mt-12 mb-[-3rem] pt-12 overflow-visible">
              <div className="relative h-56 sm:h-64 overflow-hidden rounded-b-3xl">
                {imageUrl && !imageFailed ? (
                  <img
                    src={imageUrl}
                    alt={comp.title}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    className={cn(
                      "object-cover transition-transform duration-700",
                      isHovered && "scale-105"
                    )}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/30 via-gold/10 to-amber-900/20">
                    <div className="w-20 h-20 rounded-full bg-gold/10 backdrop-blur-sm flex items-center justify-center">
                      <Trophy className="w-10 h-10 text-gold/60" />
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

                {categoryLabel && (
                  <div className="absolute top-4 left-4 z-20">
                    <Badge className="bg-gold/90 text-primary-foreground backdrop-blur-sm">
                      {categoryLabel}
                    </Badge>
                  </div>
                )}

                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 z-20">
                    <div className="bg-black/85 backdrop-blur-sm py-3 px-4">
                      <div className="flex items-center justify-center gap-3 text-gold">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-semibold uppercase tracking-wider">
                            {t("home.endsIn")}
                          </span>
                        </div>
                        <CountdownLabel
                          timeLeft={timeLeft}
                          size="lg"
                          icon={<Clock className="w-7 h-7 text-gold" />}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative z-10 px-4 pb-4 pt-0 lg:px-5 lg:pb-5">
              <div className="mb-3 lg:mb-4">
                <h3 className="font-bold text-base lg:text-lg text-foreground line-clamp-2 leading-tight mb-1">
                  {comp.title}
                </h3>
                {"shortDescription" in comp || "description" in comp ? (
                  <p className="text-xs lg:text-sm text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap">
                    {("shortDescription" in comp && comp.shortDescription) ||
                      ("description" in comp && comp.description)}
                  </p>
                ) : null}
              </div>

              {"ticketPrice" in comp && (
                <div className="mb-4">
                  <PriceBadge competition={comp as Competition} size="lg" showPerTicket />
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Zap className="w-3 h-3 text-gold" />
                    {soldTickets.toLocaleString()} / {totalTickets.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground font-medium">
                    {t("home.pctSold", { percent: percentageSold.toFixed(0) })}
                  </span>
                </div>
                <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden ring-1 ring-inset ring-black/5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      percentageSold >= 75
                        ? "bg-gradient-to-r from-green-500 to-green-400"
                        : percentageSold >= 50
                          ? "bg-gradient-to-r from-gold to-amber-400"
                          : "bg-gradient-to-r from-gold/80 to-gold"
                    )}
                    style={{ width: `${percentageSold}%` }}
                  />
                </div>
              </div>

              <Button
                variant={isActive && ticketsLeft > 0 ? "gold" : "outline"}
                size="lg"
                className="w-full font-semibold"
                disabled={!isActive || ticketsLeft === 0}
                data-umami-event="competitions:card-cta-click"
                data-umami-event-id={getCompSlug(comp)}
                data-umami-event-status={
                  !isActive ? "not-available" : ticketsLeft === 0 ? "sold-out" : "active"
                }
              >
                {!isActive ? (
                  t("home.notAvailable")
                ) : ticketsLeft === 0 ? (
                  t("home.soldOut")
                ) : (
                  <>
                    {t("home.enterNow")}
                    <Zap className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
