"use client";

import { useCompetitionStream, useInfiniteEntries } from "@oc/api-client";
import { ArrowLeft, RefreshCw, Search, Ticket } from "@oc/icons";
import { formatTicketNumber, getTicketsSold, OrderNumberCell } from "@oc/utils";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorBoundary, ErrorPage } from "@/components/ErrorBoundary";
import { Link } from "@/components/Link";
import { CompetitionProgressBar } from "@/components/ui/competition-progress-bar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";

const LIMIT = 50;

export default function Page() {
  const { t } = useTranslation();
  const { competitionId = "" } = useParams<{ competitionId: string }>();
  useCompetitionStream(competitionId ? [competitionId] : []);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TODO: fetch competition detail via query hook
  const competition: { ticketCount?: number; title?: string; maxTickets?: number } | null =
    null as any;

  const {
    data: entriesData,
    isLoading: isLoadingEntries,
    isFetching: isFetchingEntries,
    isError: isEntriesError,
    refetch: refetchEntries,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteEntries(competitionId, {
    limit: LIMIT,
    search: debouncedSearch,
    initialData: undefined,
  });

  const freshEntries = (entriesData?.pages ?? []).flatMap((p) => p.data ?? []);
  const entriesTotal = entriesData?.pages[0]?.meta?.total;
  const isSearching = debouncedSearch.length > 0;
  const reliableTotal = isSearching ? entriesTotal : (entriesTotal ?? competition?.ticketCount);
  const showTotalSkeleton = !isSearching && reliableTotal == null && isLoadingEntries;

  const stableEntriesRef = useRef(freshEntries);
  if (freshEntries.length > 0) stableEntriesRef.current = freshEntries;

  const isSearchLoading = isSearching && isFetchingEntries;
  const isSearchEmpty = isSearching && !isFetchingEntries && freshEntries.length === 0;
  const displayEntries = isSearchLoading ? stableEntriesRef.current : freshEntries;

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) fetchNextPage();
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const title = competition?.title ?? "Entries";

  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <ErrorPage
        error={error.message}
        title={t("staticPages.entries.failedToLoadEntries")}
        message={t("staticPages.entries.failedToLoadDesc")}
        onRetry={() => {
          setError(null);
        }}
        retryIcon={RefreshCw}
      />
    );
  }

  return (
    <ErrorBoundary onError={(_err) => setError(_err)}>
      <div className="oc-container-medium pb-8">
        <div className="dashboard-root py-5 lg:py-8">
          <Link
            href="/entries"
            data-umami-event="entries:back-to-all"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("staticPages.entries.backToAll")}
          </Link>

          {competition ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="dashboard-title">{title}</h1>
                {showTotalSkeleton ? (
                  <Skeleton className="h-4 w-48 mt-1" shimmer />
                ) : isSearchLoading ? (
                  <p className="dashboard-subtitle transition-opacity duration-300">
                    <span className="text-gold">{t("staticPages.entries.searching")}</span>
                  </p>
                ) : reliableTotal != null ? (
                  <p className="dashboard-subtitle transition-opacity duration-300">
                    {reliableTotal.toLocaleString()} {t("staticPages.entries.totalEntries")}
                    {isSearching ? ` ${t("staticPages.entries.matchingSearch")}` : ""}
                  </p>
                ) : null}
              </div>
              <CompetitionProgressBar
                competition={{
                  _id: competitionId,
                  ticketsSold: competition ? getTicketsSold(competition) : 0,
                  maxTickets: competition?.maxTickets ?? 0,
                }}
                variant="entries"
                className="flex-1 md:max-w-md"
              />
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              <Skeleton className="h-8 w-64" shimmer />
              <Skeleton className="h-4 w-48" shimmer />
            </div>
          )}

          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("staticPages.entries.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 w-full"
                data-umami-event="entries:search"
                data-umami-event-query={searchQuery}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  data-umami-event="entries:clear-search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {!isSearching && isLoadingEntries && freshEntries.length === 0 ? (
            <div className="dashboard-table-panel p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" shimmer />
              ))}
            </div>
          ) : isSearchEmpty ? (
            <div className="dashboard-table-panel flex flex-col items-center justify-center py-20">
              <Ticket className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">{t("staticPages.entries.noSearchResults")}</p>
            </div>
          ) : isEntriesError && !isLoadingEntries ? (
            <div className="dashboard-table-panel flex flex-col items-center justify-center py-20">
              <Ticket className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground mb-4">
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
            <div className="dashboard-table-panel flex flex-col items-center justify-center py-20">
              <Ticket className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">{t("staticPages.entries.noEntriesForComp")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="grid grid-cols-[9rem_1fr_8rem] items-center border-b border-border/60 bg-muted/20 px-4 py-2">
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
              <div className="max-h-[720px] overflow-y-auto">
                <div className="divide-y divide-border/60">
                  {displayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[9rem_1fr_8rem] items-center px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="py-2 text-sm font-medium text-foreground">
                        {entry.orderNumber ? (
                          <OrderNumberCell value={entry.orderNumber} />
                        ) : (
                          <span className="text-sm text-muted-foreground">&mdash;</span>
                        )}
                      </div>
                      <div className="min-w-0 py-2 text-sm font-medium text-[var(--text-primary,theme(colors.foreground))]">
                        <p
                          className="truncate"
                          title={entry.displayName ?? entry.firstName ?? undefined}
                        >
                          {entry.displayName ?? entry.firstName}
                        </p>
                      </div>
                      <div className="py-2 text-right text-sm">
                        <span className="text-base font-bold text-gold tabular-nums">
                          {formatTicketNumber(entry.ticketNumber ?? 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {hasNextPage && (
                  <div ref={sentinelRef} className="flex items-center justify-center py-4">
                    {isFetchingNextPage && <Spinner size="sm" />}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
