"use client";

import { Ticket } from "@oc/icons";
import type { Entry } from "@oc/types";
import { cn } from "@oc/utils";
import { useEffect, useMemo, useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { useTranslation } from "@/lib/i18n";
import { DashboardEmptyCard } from "..";
import { dashboardListShellClass } from "../dashboard-list-styles";
import { CompetitionAccordionItem } from "./CompetitionAccordionItem";
import {
  getLastCompetitionIdForInfiniteScroll,
  groupEntriesByCompetition,
  ORPHANED_COMPETITION_ID,
  sortCompetitionGroups,
} from "./ticketGrouping";

interface CompetitionStats {
  totalTickets: number;
  prizeWins: number;
}

interface DashboardTicketsListProps {
  entries: Entry[];
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  byCompetitionStats: Map<string, CompetitionStats>;
}

export function DashboardTicketsList({
  entries,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  byCompetitionStats,
}: DashboardTicketsListProps) {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const sortedGroups = useMemo(
    () => sortCompetitionGroups(groupEntriesByCompetition(entries)),
    [entries]
  );

  const firstCompetitionId = sortedGroups[0]?.comp._id;

  const lastCompId = useMemo(
    () => getLastCompetitionIdForInfiniteScroll(sortedGroups),
    [sortedGroups]
  );

  const totalTickets = entries.length;

  useEffect(() => {
    if (firstCompetitionId) {
      setOpenItems([firstCompetitionId]);
    }
  }, [firstCompetitionId]);

  const { t } = useTranslation();

  if (sortedGroups.length === 0) {
    return (
      <DashboardEmptyCard
        icon={Ticket}
        title={t("dashboard.tickets.noTickets")}
        description={t("dashboard.tickets.noTicketsDesc")}
        action={{ label: t("dashboard.tickets.browseCompetitions"), href: "/competitions" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          dashboardListShellClass,
          "flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs text-muted-foreground"
        )}
      >
        <span>
          <span className="font-semibold tabular-nums text-foreground">
            {sortedGroups.length.toLocaleString()}
          </span>{" "}
          {t("dashboard.tickets.competitions").toLowerCase()}
        </span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">
            {totalTickets.toLocaleString()}
          </span>{" "}
          {t("dashboard.tickets.totalTickets").toLowerCase()} loaded
        </span>
      </div>

      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={setOpenItems}
        className="flex flex-col gap-3"
      >
        {sortedGroups.map((group) => {
          const compId = group.comp._id !== ORPHANED_COMPETITION_ID ? group.comp._id : undefined;
          const stats = compId ? byCompetitionStats.get(compId) : undefined;
          return (
            <CompetitionAccordionItem
              key={group.comp._id}
              group={group}
              totalCount={stats?.totalTickets ?? group.entries.length}
              prizeWinsCount={stats?.prizeWins ?? 0}
              isInfinite={group.comp._id === lastCompId && hasNextPage}
              fetchNextPage={fetchNextPage}
              hasMore={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />
          );
        })}
      </Accordion>
    </div>
  );
}
