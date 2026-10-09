"use client";

import { Sparkles, Star } from "@oc/icons";
import type { PublicBonusAwardEntry, PublicBonusAwardWinDTO } from "@oc/types";
import { useMemo } from "react";
import { TICKET_COL_GAP } from "@/components/shared/ticketCardShared";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { BonusAwardCard } from "./BonusAwardCard";

interface BonusAwardsSectionProps {
  awards: PublicBonusAwardEntry[];
  wins: PublicBonusAwardWinDTO[];
  ticketsSold: number;
  maxTickets: number;
}

export function BonusAwardsSection({
  awards,
  wins,
  ticketsSold,
  maxTickets,
}: BonusAwardsSectionProps) {
  const { t } = useTranslation();
  const winsByMilestone = useMemo(() => {
    const map = new Map<number, PublicBonusAwardWinDTO[]>();
    for (const win of wins) {
      const key = win.milestonePct;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(win);
    }
    return map;
  }, [wins]);

  const totalFired = awards.filter((a) => a.assignment.firedAt).length;
  const totalWon = awards.reduce((s, a) => s + (a.assignment.wonCount ?? 0), 0);

  if (awards.length === 0 && wins.length === 0) return null;

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gold/15 bg-gradient-to-r from-gold/5 via-card/80 to-card/80 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/20 sm:h-11 sm:w-11">
            <Star className="h-5 w-5 text-gold" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-foreground sm:text-xl">
                {t("competitions.bonusAwards.heading")}
              </h3>
              {totalFired > 0 ? (
                <Badge className="border-gold/25 bg-gold/10 text-gold">
                  {t("competitions.bonusAwards.milestoneReached", {
                    count: totalFired,
                  })}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {awards.length > 0
                ? totalWon > 0
                  ? t("competitions.bonusAwards.awardedSoFar", {
                      count: totalWon,
                    })
                  : t("competitions.bonusAwards.configured", {
                      count: awards.length,
                    })
                : t("competitions.bonusAwards.noBonusDraws")}
            </p>
          </div>
        </div>
        {awards.length > 0 ? (
          <div className="hidden items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gold/80 sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            {t("competitions.bonusAwards.autoAwarded")}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-start" style={{ gap: TICKET_COL_GAP }}>
        {awards.map((award) => {
          const awardWins = winsByMilestone.get(award.assignment.milestonePct) ?? [];
          const milestonePct = award.assignment.milestonePct;
          const threshold = Math.floor((maxTickets * milestonePct) / 100);
          const ticketsToGo = Math.max(0, threshold - ticketsSold);
          const pctToGo = maxTickets > 0 ? ((ticketsToGo / maxTickets) * 100).toFixed(2) : "0";

          return (
            <div
              key={award.assignment._id}
              className="w-[125px] min-[400px]:w-[150px] lg:w-[170px]"
              style={{ flexShrink: 0 }}
            >
              <BonusAwardCard award={award} wins={awardWins} pctToGo={pctToGo} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
