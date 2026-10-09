"use client";

import { useInfiniteCompetitionInstantPrizes } from "@oc/api-client";
import { Gift, Sparkles } from "@oc/icons";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { PrizeList } from "./PrizeList";
import type { InstantWinsSectionProps } from "./types";

export function InstantWinsSection({ competitionId }: InstantWinsSectionProps) {
  const { t, locale } = useTranslation();
  const [openItems, setOpenItems] = useState<string[]>([]);
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteCompetitionInstantPrizes(competitionId, 50);
  const prizes = (data?.pages ?? []).flatMap((p) => p.data ?? []);
  const firstPrizeId = prizes[0]?.id;
  const hasInitializedOpen = useRef(false);

  const totalRemaining = prizes.reduce(
    (sum, prize) => sum + Math.max(0, prize.quantity - prize.claimedCount),
    0
  );
  const activePrizeCount = prizes.filter((prize) => !(prize.isArchived ?? false)).length;

  useEffect(() => {
    if (!hasInitializedOpen.current && firstPrizeId) {
      setOpenItems([firstPrizeId]);
      hasInitializedOpen.current = true;
    }
  }, [firstPrizeId]);

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gold/15 bg-gradient-to-r from-gold/5 via-card/80 to-card/80 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/20 sm:h-11 sm:w-11">
            <Gift className="h-5 w-5 text-gold" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-foreground sm:text-xl">
                {t("competitions.instantWins.heading")}
              </h3>
              {activePrizeCount > 0 ? (
                <Badge className="border-gold/25 bg-gold/10 text-gold">
                  {t("competitions.instantWins.activeCount", { count: activePrizeCount })}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {prizes.length > 0
                ? totalRemaining > 0
                  ? t("competitions.instantWins.stillUpForGrabs", {
                      count: formatNumber(totalRemaining, locale),
                    })
                  : t("competitions.instantWins.allClaimed")
                : t("competitions.instantWins.noInstantWins")}
            </p>
          </div>
        </div>
        {prizes.length > 0 ? (
          <div className="hidden items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gold/80 sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            {t("competitions.instantWins.bonusPrizes")}
          </div>
        ) : null}
      </div>

      <PrizeList
        prizes={prizes}
        openItems={openItems}
        onOpenItemsChange={setOpenItems}
        isLoading={isLoading}
        hasMore={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
      />
    </div>
  );
}
