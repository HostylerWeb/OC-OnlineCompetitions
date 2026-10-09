"use client";

import { ArrowRight, Trophy } from "@oc/icons";
import type { Winner } from "@oc/types";
import { withAssetCacheVersion } from "@oc/utils";
import { useEffect, useMemo, useState } from "react";
import { GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { Marquee } from "@/components/ui/marquee";
import { CompetitionEntryListDialog } from "@/components/winners/CompetitionEntryListDialog";
import {
  getCompetitionTitle,
  getPopulatedWinnerUser,
  getWinnerCompetitionId,
  getWinnerDisplayName,
  getWinnerSpotlightImageUrl,
} from "@/components/winners/WinnerCard";
import { WinnerPickTile } from "@/components/winners/WinnerPickTile";
import { WinnerSpotlight } from "@/components/winners/WinnerSpotlight";
import { takeRecentWinners } from "@/lib/home-winners";
import { formatNumber, useTranslation } from "@/lib/i18n";

type EntryDialogState = {
  competitionId: string;
  competitionTitle: string;
  highlightTicketNumbers: number[];
  winnerDisplayName: string;
};

function winnerKey(winner: Winner): string {
  return winner._id ?? winner.id ?? "";
}

function getWinnerPrizeLabel(winner: Winner, luxuryFallback: string): string {
  const competitionTitle = getCompetitionTitle(winner);
  return winner.prizeTitle || competitionTitle || luxuryFallback;
}

function WinnerStripCard({ winner }: { winner: Winner }) {
  const { t, locale } = useTranslation();
  const userObj = getPopulatedWinnerUser(winner);
  const profileRaw = winner.avatarUrl?.trim() || userObj?.avatarUrl?.trim();
  const imageUrl = profileRaw ? withAssetCacheVersion(profileRaw) : getWinnerSpotlightImageUrl(winner);
  const displayName = getWinnerDisplayName(winner, t("staticPages.winners.anonymousWinner"));
  const prize = getWinnerPrizeLabel(winner, t("staticPages.winners.luxuryPrize"));

  return (
    <div
      className="flex w-[17rem] shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-card/80 px-3 py-2.5 backdrop-blur-sm sm:w-[19rem]"
      aria-hidden
    >
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-gold/20">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gold/10">
            <Trophy className="h-5 w-5 text-gold/50" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{prize}</p>
        {winner.ticketNumber > 0 ? (
          <p className="text-[0.65rem] text-gold/80">
            #{formatNumber(winner.ticketNumber, locale)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function WinnersShowcase({ winners: winnersRaw }: { winners: Winner[] }) {
  const { t } = useTranslation();
  const [entryDialog, setEntryDialog] = useState<EntryDialogState | null>(null);

  const winners = useMemo(() => takeRecentWinners(winnersRaw), [winnersRaw]);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  useEffect(() => {
    if (winners.length === 0) return;
    setSpotlightId((prev) => {
      if (prev && winners.some((w) => winnerKey(w) === prev)) return prev;
      return winnerKey(winners[0]);
    });
  }, [winners]);

  const spotlightWinner = useMemo(() => {
    if (winners.length === 0) return undefined;
    if (spotlightId) {
      const match = winners.find((w) => winnerKey(w) === spotlightId);
      if (match) return match;
    }
    return winners[0];
  }, [winners, spotlightId]);

  const pickList = useMemo(() => {
    if (!spotlightWinner) return [];
    const activeKey = winnerKey(spotlightWinner);
    return winners.filter((w) => winnerKey(w) !== activeKey);
  }, [winners, spotlightWinner]);

  function openEntryDialog(winner: Winner) {
    const competitionId = getWinnerCompetitionId(winner);
    if (!competitionId) return;
    setEntryDialog({
      competitionId,
      competitionTitle: getCompetitionTitle(winner),
      highlightTicketNumbers: winner.ticketNumber > 0 ? [winner.ticketNumber] : [],
      winnerDisplayName: getWinnerDisplayName(winner, t("staticPages.winners.anonymousWinner")),
    });
  }

  if (winners.length === 0 || !spotlightWinner) return null;

  return (
    <section className="relative overflow-hidden bg-background py-16 sm:py-20 md:py-24 lg:py-28">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-gold/5 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" />

      <div className="oc-container-wide relative z-10">
        <div className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold/80">
              {t("home.winners.recentWinners")}
            </p>
            <h2 className="text-4xl font-bold tracking-tighter leading-none text-foreground sm:text-5xl md:text-6xl">
              <span className="text-gold">{t("home.winners.heading")}</span>
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">{t("home.winners.subtitle")}</p>
          </div>
          <GoldOutlineButton asChild size="lg" className="w-full shrink-0 sm:w-auto">
            <Link href="/winners" data-umami-event="home:winners-view-all">
              {t("home.winners.viewAll")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </GoldOutlineButton>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="lg:col-span-7">
            <WinnerSpotlight
              key={winnerKey(spotlightWinner)}
              winner={spotlightWinner}
              onSeeEntries={() => openEntryDialog(spotlightWinner)}
              className="animate-fade-in-scale h-full"
              latestLabel={t("home.winners.latestWinner")}
              seeEntriesUmamiEvent="home:winners-see-entries"
            />
          </div>

          {pickList.length > 0 ? (
            <div className="flex flex-col gap-2.5 sm:gap-3 lg:col-span-5 lg:justify-center">
              {pickList.map((winner) => (
                <WinnerPickTile
                  key={winnerKey(winner)}
                  winner={winner}
                  onSelect={() => setSpotlightId(winnerKey(winner))}
                  umamiEvent="home:winners-spotlight-select"
                />
              ))}
            </div>
          ) : null}
        </div>

        {winners.length > 1 ? (
          <div className="relative mt-10">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent sm:w-20" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent sm:w-20" />
            <Marquee pauseOnHover className="[--duration:55s] [--gap:0.75rem]" repeat={2}>
              {winners.map((winner) => (
                <WinnerStripCard key={winnerKey(winner)} winner={winner} />
              ))}
            </Marquee>
          </div>
        ) : null}
      </div>

      <CompetitionEntryListDialog
        open={entryDialog != null}
        onOpenChange={(open) => {
          if (!open) setEntryDialog(null);
        }}
        competitionId={entryDialog?.competitionId ?? ""}
        competitionTitle={entryDialog?.competitionTitle ?? ""}
        highlightTicketNumbers={entryDialog?.highlightTicketNumbers ?? []}
        winnerDisplayName={entryDialog?.winnerDisplayName}
      />
    </section>
  );
}
