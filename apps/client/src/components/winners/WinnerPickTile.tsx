"use client";

import { Trophy } from "@oc/icons";
import type { Winner } from "@oc/types";
import { cn, formatDate } from "@oc/utils";
import {
  getCompetitionTitle,
  getWinnerDisplayName,
  getWinnerSpotlightImageUrl,
} from "@/components/winners/WinnerCard";
import { useTranslation } from "@/lib/i18n";

function getWinnerPrizeLabel(winner: Winner, luxuryFallback: string): string {
  const competitionTitle = getCompetitionTitle(winner);
  return winner.prizeTitle || competitionTitle || luxuryFallback;
}

export function WinnerPickTile({
  winner,
  onSelect,
  className,
  umamiEvent,
}: {
  winner: Winner;
  onSelect?: () => void;
  className?: string;
  umamiEvent?: string;
}) {
  const { t } = useTranslation();
  const displayName = getWinnerDisplayName(winner, t("staticPages.winners.anonymousWinner"));
  const prize = getWinnerPrizeLabel(winner, t("staticPages.winners.luxuryPrize"));
  const imageUrl = getWinnerSpotlightImageUrl(winner);
  const drawnDate = formatDate(winner.drawnAt);

  const content = (
    <div className="flex w-full min-w-0">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden sm:h-28 sm:w-28">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gold/10">
            <Trophy className="h-8 w-8 text-gold/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/80" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-3 sm:px-4 sm:py-4">
        <p className="truncate text-sm font-bold text-foreground sm:text-base">{displayName}</p>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">{prize}</p>
        <p className="text-[0.65rem] uppercase tracking-wide text-gold/70 sm:text-xs">{drawnDate}</p>
      </div>
    </div>
  );

  const shellClass = cn(
    "group relative flex w-full overflow-hidden rounded-2xl bg-card/60 text-left ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:ring-gold/35",
    onSelect && "cursor-pointer",
    className
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        data-umami-event={umamiEvent}
        className={shellClass}
      >
        {content}
      </button>
    );
  }

  return <div className={shellClass}>{content}</div>;
}
