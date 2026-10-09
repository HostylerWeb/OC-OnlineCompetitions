"use client";

import { Calendar, List, MapPin, Ticket, Trophy } from "@oc/icons";
import type { Winner } from "@oc/types";
import { cn, formatDate } from "@oc/utils";
import { Button } from "@/components/ui/button";
import {
  getCompetitionTitle,
  getWinnerCompetitionId,
  getWinnerDisplayName,
  getWinnerSpotlightImageUrl,
} from "@/components/winners/WinnerCard";
import { formatNumber, useTranslation } from "@/lib/i18n";

function getWinnerPrizeLabel(winner: Winner, luxuryFallback: string): string {
  const competitionTitle = getCompetitionTitle(winner);
  return winner.prizeTitle || competitionTitle || luxuryFallback;
}

export function WinnerSpotlight({
  winner,
  onSeeEntries,
  className,
  latestLabel,
  seeEntriesUmamiEvent = "winners:see-entries",
}: {
  winner: Winner;
  onSeeEntries?: () => void;
  className?: string;
  latestLabel: string;
  seeEntriesUmamiEvent?: string;
}) {
  const { t, locale } = useTranslation();
  const anonymous = t("staticPages.winners.anonymousWinner");
  const displayName = getWinnerDisplayName(winner, anonymous);
  const prize = getWinnerPrizeLabel(winner, t("staticPages.winners.luxuryPrize"));
  const imageUrl = getWinnerSpotlightImageUrl(winner);
  const drawnDate = formatDate(winner.drawnAt);
  const competitionId = getWinnerCompetitionId(winner);
  const showEntries = Boolean(competitionId && onSeeEntries);

  return (
    <article
      className={cn(
        "group relative min-h-[22rem] overflow-hidden rounded-[1.75rem] ring-1 ring-white/10 sm:min-h-[26rem] lg:min-h-[28rem]",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/15 via-card to-card" />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gold/20 to-background">
          <Trophy className="h-20 w-20 text-gold/30" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/15" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(212,175,55,0.18),_transparent_55%)]" />

      <div className="relative flex h-full flex-col justify-between p-5 sm:p-7 lg:p-8">
        {winner.location ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs text-foreground/90 backdrop-blur-sm">
              <MapPin className="h-3 w-3 text-gold/80" />
              {winner.location}
            </span>
          </div>
        ) : null}

        <div className="mt-auto space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold/80 sm:text-sm">
              {latestLabel}
            </p>
            <h3 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {displayName}
            </h3>
            <p className="mt-2 max-w-xl text-base font-medium leading-snug text-foreground/90 sm:text-lg lg:text-xl">
              {prize}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-gold" />
              {drawnDate}
            </span>
            {winner.ticketNumber > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5 shrink-0 text-gold" />
                {t("staticPages.winners.ticketNumber")}
                {formatNumber(winner.ticketNumber, locale)}
              </span>
            ) : null}
          </div>

          {winner.testimonial ? (
            <p className="max-w-lg border-l-2 border-gold/40 pl-4 text-sm italic leading-relaxed text-foreground/80 sm:text-base">
              &ldquo;{winner.testimonial}&rdquo;
            </p>
          ) : null}

          {showEntries ? (
            <Button
              type="button"
              variant="gold"
              size="sm"
              className="w-full sm:w-auto"
              onClick={onSeeEntries}
              data-umami-event={seeEntriesUmamiEvent}
              data-umami-event-competition={competitionId ?? undefined}
            >
              <List className="mr-2 h-4 w-4" />
              {t("staticPages.winners.seeEntries")}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
