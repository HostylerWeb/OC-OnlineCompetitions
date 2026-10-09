"use client";

import { ArrowRight, Trophy } from "@oc/icons";
import type { Competition } from "@oc/types";
import { cn } from "@oc/utils";
import { Badge } from "@/components/ui/badge";
import { CompetitionProgressBar } from "@/components/ui/competition-progress-bar";
import { getPrizeDisplayLabel, isCashOnly } from "@/lib/competition-display";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import {
  getCompetitionHref,
  getCompetitionImageUrl,
  getCompetitionPrizeValue,
  getCompetitionProgress,
  getCompetitionTicketPrice,
} from "./competition-helpers";
import {
  dashboardCardBodyClass,
  dashboardCardContentClass,
  dashboardCardFooterClass,
  dashboardCardHeaderClass,
  dashboardCardImageClass,
  dashboardCardRowClass,
  dashboardCompactAsideClass,
  dashboardCompactBodyClass,
  dashboardCompactMetaClass,
  dashboardCompactRowClass,
  dashboardCompactThumbClass,
  dashboardCompactTitleClass,
  dashboardGridFooterClass,
  dashboardGridImageClass,
  dashboardGridTileClass,
} from "./dashboard-list-styles";
import type { DashboardListViewMode } from "./dashboard-list-view-mode";

interface CompetitionCardProps {
  competition: Competition;
  variant?: DashboardListViewMode;
}

function CompetitionThumbnail({
  competition,
  className,
  badgeClassName,
}: {
  competition: Competition;
  className?: string;
  badgeClassName?: string;
}) {
  const { t, locale } = useTranslation();
  const imageUrl = getCompetitionImageUrl(competition);
  const ticketPrice = getCompetitionTicketPrice(competition);

  return (
    <div className={cn("relative bg-muted/30", className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
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
        <div className="absolute inset-0 flex items-center justify-center">
          <Trophy className="size-6 text-primary/35 sm:size-7" aria-hidden="true" />
        </div>
      )}
      <Badge
        variant="default"
        className={cn(
          "absolute top-1.5 right-1.5 font-semibold text-[10px] text-primary-foreground shadow-sm",
          badgeClassName
        )}
      >
        {(() => {
          const op = (competition as { originalPrice?: number }).originalPrice;
          return op != null && op > ticketPrice ? (
            <>
              <span className="line-through text-primary-foreground/60 mr-1">
                {formatCurrency(op, locale, "GBP")}
              </span>
              {formatCurrency(ticketPrice, locale, "GBP")}
              {t("competitions.detail.perTicket")}
            </>
          ) : (
            <>
              {formatCurrency(ticketPrice, locale, "GBP")}
              {t("competitions.detail.perTicket")}
            </>
          );
        })()}
      </Badge>
    </div>
  );
}

function CompetitionViewLink({ href, compact = false }: { href: string; compact?: boolean }) {
  const { t } = useTranslation();
  if (compact) {
    return (
      <a
        href={href}
        aria-label={t("ticketCard.viewCompetition")}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
      </a>
    );
  }

  return (
    <a
      href={href}
      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
    >
      {t("dashboard.orders.view")}
      <ArrowRight data-icon="inline-end" />
    </a>
  );
}

function CompetitionProgressMeta({
  competition,
  className,
}: {
  competition: Competition;
  className?: string;
}) {
  return (
    <CompetitionProgressBar
      competition={competition}
      variant="compact-meta"
      className={className}
    />
  );
}

function CompetitionCompactCard({ competition }: { competition: Competition }) {
  const { t, locale } = useTranslation();
  const href = getCompetitionHref(competition);
  const imageUrl = getCompetitionImageUrl(competition);
  const percentageSold = getCompetitionProgress(competition);
  const ticketPrice = getCompetitionTicketPrice(competition);
  const currency = competition.currency ?? "GBP";

  return (
    <div className={dashboardCompactRowClass}>
      <div className={dashboardCompactThumbClass}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
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
          <div className="flex size-full items-center justify-center">
            <Trophy className="size-4 text-primary/40" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className={dashboardCompactBodyClass}>
        <p className={dashboardCompactTitleClass}>{competition.title}</p>
        {(() => {
          const label = getPrizeDisplayLabel(competition, {
            t: t as (key: string) => string,
            locale,
            currency,
          });
          return label ? <p className="truncate text-xs text-muted-foreground">{label}</p> : null;
        })()}
        <div className={dashboardCompactMetaClass}>
          <span>
            {(() => {
              const op = (competition as { originalPrice?: number }).originalPrice;
              return op != null && op > ticketPrice ? (
                <>
                  <span className="line-through text-muted-foreground mr-1">
                    {formatCurrency(op, locale, "GBP")}
                  </span>
                  {formatCurrency(ticketPrice, locale, "GBP")}
                  {t("competitions.detail.perTicket")}
                </>
              ) : (
                <>
                  {formatCurrency(ticketPrice, locale, "GBP")}
                  {t("competitions.detail.perTicket")}
                </>
              );
            })()}
          </span>
          <span>{t("progressBar.pctSold", { pct: percentageSold.toFixed(0) })}</span>
        </div>
      </div>

      <div className={dashboardCompactAsideClass}>
        <CompetitionViewLink href={href} compact />
      </div>
    </div>
  );
}

function CompetitionGridCard({ competition }: { competition: Competition }) {
  const { t, locale } = useTranslation();
  const href = getCompetitionHref(competition);
  const prizeValue = getCompetitionPrizeValue(competition);
  const percentageSold = getCompetitionProgress(competition);
  const currency = competition.currency ?? "GBP";

  return (
    <a
      href={href}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={dashboardGridTileClass}>
        <CompetitionThumbnail
          competition={competition}
          className={dashboardGridImageClass}
          badgeClassName="top-1 right-1 text-[10px]"
        />
        {prizeValue > 0 && (
          <Badge className="absolute top-1.5 left-1.5 text-[10px]">
            {formatCurrency(prizeValue, locale, currency)}
          </Badge>
        )}

        <div className={dashboardGridFooterClass}>
          <p
            className="min-w-0 truncate text-xs font-semibold leading-tight"
            title={competition.title}
          >
            {competition.title}
          </p>
          <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
            {isCashOnly(competition) ? (
              <span>{t("competitions.detail.taxFree")}</span>
            ) : prizeValue > 0 ? (
              <span>{t("competitions.detail.cashAlternative")}</span>
            ) : null}
            <span className="font-medium tabular-nums text-foreground">
              {t("progressBar.pctSold", { pct: percentageSold.toFixed(0) })}
            </span>
          </div>
          <span className="text-[11px] font-medium text-gold transition-colors group-hover:text-gold/80">
            {t("dashboard.tickets.viewCompetition")}
          </span>
        </div>
      </div>
    </a>
  );
}

function CompetitionDefaultCard({ competition }: { competition: Competition }) {
  const { t, locale } = useTranslation();
  const href = getCompetitionHref(competition);
  const currency = competition.currency ?? "GBP";

  return (
    <div className={dashboardCardRowClass}>
      <CompetitionThumbnail
        competition={competition}
        className={cn(dashboardCardImageClass, "h-full")}
      />

      <div className={dashboardCardBodyClass}>
        <div className={dashboardCardHeaderClass}>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{competition.title}</h3>
            {(() => {
              const label = getPrizeDisplayLabel(competition, {
                t: t as (key: string) => string,
                locale,
                currency,
              });
              return label ? <p className="mt-0.5 text-xs text-muted-foreground">{label}</p> : null;
            })()}
          </div>
        </div>

        <div className={cn(dashboardCardContentClass, "flex flex-col justify-center")}>
          <CompetitionProgressMeta competition={competition} />
        </div>

        <div className={dashboardCardFooterClass}>
          <span className="text-xs text-muted-foreground">
            {(() => {
              const tp = getCompetitionTicketPrice(competition);
              const op = (competition as { originalPrice?: number }).originalPrice;
              return op != null && op > tp ? (
                <>
                  <span className="line-through text-muted-foreground mr-1">
                    {formatCurrency(op, locale, "GBP")}
                  </span>
                  {formatCurrency(tp, locale, "GBP")}
                  {t("competitions.detail.perTicket")}
                </>
              ) : (
                <>
                  {formatCurrency(tp, locale, "GBP")}
                  {t("competitions.detail.perTicket")}
                </>
              );
            })()}
          </span>
          <CompetitionViewLink href={href} />
        </div>
      </div>
    </div>
  );
}

export function CompetitionCard({ competition, variant = "card" }: CompetitionCardProps) {
  switch (variant) {
    case "compact":
      return <CompetitionCompactCard competition={competition} />;
    case "grid":
      return <CompetitionGridCard competition={competition} />;
    default:
      return <CompetitionDefaultCard competition={competition} />;
  }
}
