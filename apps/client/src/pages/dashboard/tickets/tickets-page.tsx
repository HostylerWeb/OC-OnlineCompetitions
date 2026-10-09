"use client";

import { useInfiniteMyEntries, useMyEntriesStats } from "@oc/api-client";
import { Ticket } from "@oc/icons";
import { useMemo } from "react";
import { useData } from "vike-react/useData";
import { DashboardPageHeader } from "@/components/dashboard";
import {
  DashboardTicketsList,
  DashboardTicketsStats,
  TicketsAccordionSkeleton,
} from "@/components/dashboard/tickets";
import { EmptyState } from "@/components/EmptyState";
import { useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";

const ENTRIES_PAGE_SIZE = 100;

export default function DashboardTicketsView() {
  const { t } = useTranslation();
  const data = useData<Data>();

  const {
    data: entriesData,
    isLoading: entriesLoading,
    isError: entriesError,
    refetch: _refetchEntries,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMyEntries(ENTRIES_PAGE_SIZE, {
    initialData: data?.entriesPage1?.length
      ? { pages: [{ data: data.entriesPage1 }], pageParams: [1] }
      : undefined,
  });

  const entriesReady = !entriesLoading;

  const {
    data: statsResponse,
    isLoading: statsLoading,
    isError: statsError,
    refetch: _refetchStats,
  } = useMyEntriesStats({
    enabled: entriesReady,
    initialData: data?.entriesStats ? { data: data.entriesStats } : undefined,
  });

  const entries = (entriesData?.pages ?? []).flatMap((page) => page.data ?? []);
  const stats = statsResponse?.data;

  const byCompetitionStats = useMemo(() => {
    const map = new Map<string, { totalTickets: number; prizeWins: number }>();
    for (const stat of stats?.byCompetition ?? []) {
      map.set(stat.competitionId, { totalTickets: stat.totalTickets, prizeWins: stat.prizeWins });
    }
    return map;
  }, [JSON.stringify(stats?.byCompetition)]);

  const showStats = !statsLoading && (stats?.totalTickets ?? 0) > 0;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <DashboardPageHeader
        title={t("dashboard.tickets.heading")}
        subtitle={t("dashboard.tickets.subtitle")}
      />

      {showStats || statsLoading ? (
        <DashboardTicketsStats stats={stats} isLoading={statsLoading} />
      ) : null}

      {statsError ? (
        <EmptyState
          title={t("dashboard.tickets.failedToLoadStats")}
          description={t("dashboard.tickets.statsUnavailable")}
          umamiEvent="tickets:retry-stats"
        />
      ) : null}

      {entriesLoading ? (
        <TicketsAccordionSkeleton />
      ) : entriesError ? (
        <EmptyState
          icon={Ticket}
          title={t("dashboard.tickets.failedToLoadTickets")}
          description={t("dashboard.tickets.failedToLoadTicketsDesc")}
          umamiEvent="tickets:retry"
        />
      ) : (
        <DashboardTicketsList
          entries={entries}
          fetchNextPage={() => fetchNextPage()}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          byCompetitionStats={byCompetitionStats}
        />
      )}
    </div>
  );
}
