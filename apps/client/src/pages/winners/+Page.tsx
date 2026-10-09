"use client";

import { useWinners, useWinnersStats } from "@oc/api-client";

import { ArrowRight, Trophy } from "@oc/icons";
import type { Winner } from "@oc/types";
import { cn } from "@oc/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "vike-react/useData";
import { GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { CompetitionEntryListDialog } from "@/components/winners/CompetitionEntryListDialog";
import {
  getCompetitionTitle,
  getWinnerCompetitionId,
  getWinnerDisplayName,
} from "@/components/winners/WinnerCard";
import { WinnerPickTile } from "@/components/winners/WinnerPickTile";
import { WinnerSpotlight } from "@/components/winners/WinnerSpotlight";
import type { Data } from "./+data";

type EntryDialogState = {
  competitionId: string;
  competitionTitle: string;
  highlightTicketNumbers: number[];
  winnerDisplayName: string;
};

function formatCompactPrizeValue(value: number, locale: string): string | null {
  if (value <= 0) return null;
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const formatted = millions % 1 === 0 ? String(millions) : millions.toFixed(1);
    return `£${formatted}M`;
  }
  if (value >= 1_000) {
    return `£${Math.round(value / 1_000).toLocaleString(locale)}K`;
  }
  return `£${value.toLocaleString(locale)}`;
}

function WinnersStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[9rem] flex-1 rounded-2xl border border-gold/15 bg-card/80 px-5 py-4 backdrop-blur-sm sm:min-w-[10rem]">
      <p className="text-2xl font-bold tracking-tight text-gold sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
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
  const data = useData<Data>();

  const {
    data: winnersResponse,
    isLoading,
    isError: winnersError,
    refetch: refetchWinners,
  } = useWinners(50, { initialData: { data: data?.winners ?? [] } });
  const winners = winnersResponse?.data ?? [];

  const { data: statsResponse } = useWinnersStats({
    initialData: data?.winnerStats ? { data: data.winnerStats } : undefined,
  });
  const stats = statsResponse?.data;

  const [entryDialog, setEntryDialog] = useState<EntryDialogState | null>(null);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const spotlightRef = useRef<HTMLElement>(null);
  const consumedEntriesQuery = useRef(false);

  function winnerKey(winner: Winner): string {
    return winner._id ?? winner.id ?? "";
  }

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

  function selectSpotlight(winner: Winner) {
    setSpotlightId(winnerKey(winner));
    spotlightRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

  useEffect(() => {
    if (consumedEntriesQuery.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const entriesCompId = params.get("entries")?.trim();
    if (!entriesCompId) {
      consumedEntriesQuery.current = true;
      return;
    }
    if (isLoading) return;

    consumedEntriesQuery.current = true;
    params.delete("entries");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    const match = winners.find((w) => getWinnerCompetitionId(w) === entriesCompId);
    if (match) {
      openEntryDialog(match);
      return;
    }

    setEntryDialog({
      competitionId: entriesCompId,
      competitionTitle: t("staticPages.entries.heading"),
      highlightTicketNumbers: [],
      winnerDisplayName: "",
    });
  }, [isLoading, winners, t]);

  const hasError = winnersError;
  const totalPrizeLabel = stats ? formatCompactPrizeValue(stats.totalPrizeValue, locale) : null;
  const showWinnerCount = (stats?.totalWinners ?? 0) > 0;
  const showPrizeValue = Boolean(totalPrizeLabel);
  const showStats = showWinnerCount || showPrizeValue;

  return (
    <div className="oc-container-wide pb-12 animate-fade-in">
      <section className="relative mb-10 overflow-hidden rounded-[1.75rem] border border-gold/10 bg-gradient-to-br from-gold/[0.07] via-card to-background sm:mb-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-10 lg:p-10">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tighter leading-none sm:text-5xl lg:text-6xl">
              <span className="text-gold">{t("staticPages.winners.heading")}</span>{" "}
              {t("staticPages.winners.subheading")}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("staticPages.winners.heroDesc")}
            </p>
          </div>

          {showStats && !isLoading ? (
            <div className="flex flex-wrap gap-3 lg:max-w-md lg:justify-end">
              {showWinnerCount ? (
                <WinnersStatCard
                  label={t("staticPages.winners.happyWinners")}
                  value={formatNumber(stats?.totalWinners ?? 0, locale)}
                />
              ) : null}
              {showPrizeValue && totalPrizeLabel ? (
                <WinnersStatCard
                  label={t("staticPages.winners.totalPrizesAwarded")}
                  value={totalPrizeLabel}
                />
              ) : null}
            </div>
          ) : isLoading ? (
            <div className="flex gap-3">
              <Skeleton className="h-[5.5rem] flex-1 rounded-2xl" shimmer />
              <Skeleton className="h-[5.5rem] flex-1 rounded-2xl" shimmer />
            </div>
          ) : null}
        </div>
      </section>

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
        <div className="mb-12 space-y-6">
          <Skeleton className="min-h-[22rem] rounded-[1.75rem] sm:min-h-[26rem]" shimmer />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl sm:h-28" shimmer />
            ))}
          </div>
        </div>
      ) : winners.length > 0 && spotlightWinner ? (
        <div className="mb-12 space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
            <section ref={spotlightRef} className="lg:col-span-7">
              <WinnerSpotlight
                key={winnerKey(spotlightWinner)}
                winner={spotlightWinner}
                onSeeEntries={() => openEntryDialog(spotlightWinner)}
                latestLabel={t("staticPages.winners.latestWinner")}
                className="animate-fade-in-scale h-full"
              />
            </section>

            {pickList.length > 0 ? (
              <div className="hidden flex-col gap-2.5 sm:gap-3 lg:col-span-5 lg:flex lg:justify-center">
                {pickList.slice(0, 5).map((winner) => (
                  <WinnerPickTile
                    key={winnerKey(winner)}
                    winner={winner}
                    onSelect={() => selectSpotlight(winner)}
                    umamiEvent="winners:spotlight-select"
                  />
                ))}
              </div>
            ) : null}
          </div>

          {pickList.length > 0 ? (
            <div className="space-y-4">
              <h2
                className={cn(
                  "text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground",
                  pickList.length <= 5 && "lg:hidden"
                )}
              >
                {t("home.winners.recentWinners")}
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 animate-fade-in-stagger lg:hidden">
                {pickList.map((winner) => (
                  <WinnerPickTile
                    key={winnerKey(winner)}
                    winner={winner}
                    onSelect={() => selectSpotlight(winner)}
                    umamiEvent="winners:spotlight-select"
                  />
                ))}
              </div>
              {pickList.length > 5 ? (
                <div className="hidden grid-cols-2 gap-2.5 sm:gap-3 lg:grid animate-fade-in-stagger">
                  {pickList.slice(5).map((winner) => (
                    <WinnerPickTile
                      key={winnerKey(winner)}
                      winner={winner}
                      onSelect={() => selectSpotlight(winner)}
                      umamiEvent="winners:spotlight-select"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : !hasError ? (
        <div className={cn("mb-12")}>
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
    </div>
  );
}
