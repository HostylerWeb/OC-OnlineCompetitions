"use client";

import type { PublicBonusAwardEntry, PublicBonusAwardWinDTO } from "@oc/types";
import { cn, formatTicketNumber } from "@oc/utils";
import { CheckIcon, Star } from "lucide-react";
import { CORNER_BADGE_CLASS, TICKET_CARD_SHELL_CLASS } from "@/components/shared/ticketCardShared";
import { formatCurrency, useTranslation } from "@/lib/i18n";

const BONUS_CARD_HEIGHT = 120;

interface BonusAwardCardProps {
  award: PublicBonusAwardEntry;
  wins: PublicBonusAwardWinDTO[];
  pctToGo: string;
}

export function BonusAwardCard({ award, wins, pctToGo }: BonusAwardCardProps) {
  const { t, locale } = useTranslation();
  const isWon = wins.length > 0;
  const firstWin = wins[0];
  const milestonePct = award.assignment.milestonePct;
  const value = award.bonusAward.value;

  const prizeLabel =
    value != null && value > 0
      ? t("competitions.bonusAwards.cashPrize", { value: formatCurrency(value, locale) })
      : award.bonusAward.title;

  const bigNumber = isWon ? formatTicketNumber(firstWin!.ticketNumber) : `${milestonePct}%`;

  const winnerName = isWon ? (firstWin!.displayName ?? t("competitions.bonusAwards.winner")) : null;

  const badge = isWon ? (
    <span
      className={cn(
        CORNER_BADGE_CLASS,
        "h-6 min-h-6 text-[10px] [&>svg]:size-3",
        "bg-gold text-black flex items-center justify-center gap-0.5"
      )}
    >
      <CheckIcon className="size-3" />
      {t("competitions.bonusAwards.reached")}
    </span>
  ) : (
    <span
      className={cn(
        CORNER_BADGE_CLASS,
        "h-6 min-h-6 text-[10px] [&>svg]:size-3",
        "bg-gray-200/20 text-white border-b border-gray-200/30 flex items-center justify-center gap-1"
      )}
    >
      <Star className="size-3 text-white fill-white" />
      {t("competitions.bonusAwards.milestonePct", { percent: milestonePct })}
    </span>
  );

  return (
    <div
      className={cn(
        TICKET_CARD_SHELL_CLASS,
        isWon
          ? "border-gold/20 bg-card hover:border-gold/40 transition-colors"
          : "border-gray-200/20 bg-gray-200/5 hover:border-gray-200/40 transition-colors",
        "pt-7 justify-between gap-1"
      )}
      style={{ height: BONUS_CARD_HEIGHT }}
    >
      <span
        className={cn(
          "w-full truncate text-center font-bold",
          isWon ? "text-gold text-[13px]" : "text-gray-400 text-xs"
        )}
      >
        {isWon ? winnerName : t("competitions.bonusAwards.pctToGo", { percent: pctToGo })}
      </span>

      <span
        className={cn(
          "w-full truncate text-center font-semibold leading-tight",
          isWon ? "text-gold/90 text-[15px]" : "text-gray-400 text-sm"
        )}
      >
        {prizeLabel}
      </span>

      <span className="w-full truncate text-center text-base font-bold leading-tight text-gold">
        {isWon ? bigNumber : ""}
      </span>

      {badge}
    </div>
  );
}
