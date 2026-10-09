"use client";

import { useCompetitionStream, useInfiniteEntries, type PublicEntry } from "@oc/api-client";
import type { ApiResponse } from "@oc/types";
import { Search, Ticket, Trophy } from "@oc/icons";
import { formatTicketNumber, OrderNumberCell } from "@oc/utils";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatNumber, useTranslation } from "@/lib/i18n";

const LIMIT = 50;

export type CompetitionEntryListProps = {
  competitionId: string;
  highlightTicketNumbers?: number[];
  initialData?: ApiResponse<PublicEntry[]>;
  enabled?: boolean;
  searchUmamiEvent?: string;
  className?: string;
  showFooterDisclaimer?: boolean;
};

function countUniquePlayers(entries: PublicEntry[]): number {
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = (entry.displayName ?? entry.firstName ?? entry.id).trim().toLowerCase();
    if (key) keys.add(key);
  }
  return keys.size;
}

function normalizeTicketKey(value: number | string): string {
  return String(value).replace(/\D/g, "");
}

export function CompetitionEntryList({
  competitionId,
  highlightTicketNumbers = [],
  initialData,
  enabled = true,
  searchUmamiEvent = "entries:search",
  className,
  showFooterDisclaimer = true,
}: CompetitionEntryListProps) {
  const { t, locale } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useCompetitionStream(enabled && competitionId ? [competitionId] : []);

  const winningTickets = useMemo(() => {
    return new Set(highlightTicketNumbers.map((n) => normalizeTicketKey(n)).filter(Boolean));
  }, [highlightTicketNumbers]);

  const {
    data: entriesData,
    isLoading: isLoadingEntries,
    isFetching: isFetchingEntries,
    isPlaceholderData: isEntriesPlaceholder,
    isError: isEntriesError,
    refetch: refetchEntries,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteEntries(enabled ? competitionId : "", {
    limit: LIMIT,
    search: debouncedSearch,
    initialData: !debouncedSearch ? initialData : undefined,
  });

  useEffect(() => {
    if (enabled) return;
    setSearchQuery("");
    setDebouncedSearch("");
  }, [enabled]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  const freshEntries = (entriesData?.pages ?? []).flatMap((p) => p.data ?? []);
  const isSearching = debouncedSearch.length > 0;
  const isSearchPending = isSearching && isFetchingEntries;
  const displayEntries = freshEntries;

  const isSearchEmpty =
    isSearching && !isSearchPending && !isEntriesPlaceholder && freshEntries.length === 0;

  const ticketsDisplayed = displayEntries.length;
  const playersDisplayed = useMemo(() => countUniquePlayers(displayEntries), [displayEntries]);
  const entriesTotal = entriesData?.pages[0]?.meta?.total;

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage || !enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) fetchNextPage();
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, enabled]);

  if (!competitionId) return null;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("staticPages.entries.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9"
          data-umami-event={searchUmamiEvent}
        />
        {isSearchPending ? (
          <Spinner
            size="sm"
            className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {!isSearching && isLoadingEntries && freshEntries.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" shimmer />
          ))}
        </div>
      ) : isSearchEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Ticket className="mb-4 h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm text-muted-foreground">{t("staticPages.entries.noSearchResults")}</p>
        </div>
      ) : isEntriesError && !isLoadingEntries ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            {t("staticPages.entries.failedToLoadEntries")}
          </p>
          <button
            type="button"
            onClick={() => refetchEntries()}
            className="text-sm font-medium text-gold hover:underline"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : displayEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("staticPages.entries.noEntriesForComp")}</p>
        </div>
      ) : (
        <div
          className={cn(
            "min-h-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-opacity duration-200",
            isSearchPending && "opacity-60",
          )}
        >
          <div className="grid grid-cols-[9rem_1fr_8rem] items-center border-b border-border/60 bg-muted/20 px-3 py-2 sm:px-4">
            <span className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("staticPages.entries.orderHeader")}
            </span>
            <span className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("staticPages.entries.nameHeader")}
            </span>
            <span className="text-right text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("staticPages.entries.ticketHeader")}
            </span>
          </div>
          <div className="max-h-[min(50vh,28rem)] overflow-y-auto md:max-h-[min(65vh,36rem)]">
            <div className="divide-y divide-border/60">
              {displayEntries.map((entry) => {
                const ticketKey = normalizeTicketKey(entry.ticketNumber ?? 0);
                const isWinnerRow = winningTickets.has(ticketKey);
                return (
                  <div
                    key={entry.id}
                    className={
                      isWinnerRow
                        ? "grid grid-cols-[9rem_1fr_8rem] items-center bg-gold/10 px-3 py-2.5 sm:px-4"
                        : "grid grid-cols-[9rem_1fr_8rem] items-center px-3 py-2.5 transition-colors hover:bg-muted/30 sm:px-4"
                    }
                  >
                    <div className="py-1 text-sm font-medium text-foreground">
                      {entry.orderNumber ? (
                        <OrderNumberCell value={entry.orderNumber} />
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </div>
                    <div className="min-w-0 py-1 text-sm font-medium">
                      <p className="truncate" title={entry.displayName ?? entry.firstName ?? undefined}>
                        {entry.displayName ?? entry.firstName}
                      </p>
                      {isWinnerRow ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gold">
                          <Trophy className="h-3 w-3" />
                          {t("staticPages.winners.entryRowWinner")}
                        </span>
                      ) : null}
                    </div>
                    <div className="py-1 text-right text-sm">
                      <span
                        className={
                          isWinnerRow
                            ? "text-base font-bold tabular-nums text-gold"
                            : "text-base font-bold tabular-nums text-foreground"
                        }
                      >
                        {formatTicketNumber(entry.ticketNumber ?? 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasNextPage ? (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                {isFetchingNextPage ? <Spinner size="sm" /> : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showFooterDisclaimer && ticketsDisplayed > 0 ? (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          {t("staticPages.entries.listFooterStats", {
            players: formatNumber(playersDisplayed, locale),
            tickets: formatNumber(ticketsDisplayed, locale),
          })}
          {entriesTotal != null && entriesTotal > ticketsDisplayed ? (
            <span className="text-muted-foreground/80">
              {" "}
              {t("staticPages.entries.listFooterOfTotal", {
                total: formatNumber(entriesTotal, locale),
              })}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
