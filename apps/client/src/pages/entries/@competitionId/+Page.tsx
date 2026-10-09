"use client";

import { ArrowLeft, List, RefreshCw } from "@oc/icons";
import { getTicketsSold } from "@oc/utils";
import { useState } from "react";
import { useData } from "vike-react/useData";
import { usePageContext } from "vike-react/usePageContext";
import { CompetitionEntryList } from "@/components/competitions/CompetitionEntryList";
import { ErrorBoundary, ErrorPage } from "@/components/ErrorBoundary";
import { Link } from "@/components/Link";
import { CompetitionProgressBar } from "@/components/ui/competition-progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";

export default function Page() {
  const { t, locale } = useTranslation();
  const pageContext = usePageContext();
  const serverData = useData<Data>();
  const competitionId = pageContext.routeParams.competitionId ?? "";

  const competition = serverData?.competition ?? null;
  const title = competition?.title ?? t("staticPages.entries.heading");
  const entriesTotal = serverData?.meta?.total ?? serverData?.entriesPage?.meta?.total;

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
    <ErrorBoundary onError={(err) => setError(err)}>
      <div className="oc-container-medium pb-10">
        <div className="py-5 lg:py-8">
          <Link
            href="/entries"
            data-umami-event="entries:back-to-all"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-gold"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("staticPages.entries.backToAll")}
          </Link>

          <div className="mb-6 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-gold/10 to-transparent px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-1">
                <h1 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
                  <List className="h-5 w-5 shrink-0 text-gold" />
                  {t("staticPages.winners.entryListTitle")}
                </h1>
                {competition ? (
                  <>
                    <p className="text-sm font-medium text-foreground line-clamp-2">{title}</p>
                    {entriesTotal != null ? (
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(entriesTotal, locale)} {t("staticPages.entries.totalEntries")}
                      </p>
                    ) : (
                      <Skeleton className="mt-1 h-3 w-32" shimmer />
                    )}
                  </>
                ) : (
                  <div className="space-y-2 pt-1">
                    <Skeleton className="h-4 w-64" shimmer />
                    <Skeleton className="h-3 w-28" shimmer />
                  </div>
                )}
              </div>
              {competition ? (
                <CompetitionProgressBar
                  competition={{
                    _id: competitionId,
                    ticketsSold: getTicketsSold(competition),
                    maxTickets: competition.maxTickets ?? 0,
                  }}
                  variant="entries"
                  className="w-full md:max-w-md md:shrink-0"
                />
              ) : (
                <Skeleton className="h-10 w-full md:max-w-md" shimmer />
              )}
            </div>
          </div>

          <CompetitionEntryList
            competitionId={competitionId}
            initialData={serverData?.entriesPage ?? undefined}
            searchUmamiEvent="entries:search"
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
