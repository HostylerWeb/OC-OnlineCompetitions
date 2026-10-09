"use client";

import { Ticket } from "@oc/icons";
import type { MyEntriesStats } from "@oc/types";
import { cn } from "@oc/utils";
import { DashboardStatCard } from "@/components/DashboardStatCard";
import { useTranslation } from "@/lib/i18n";
import { dashboardListShellClass } from "../dashboard-list-styles";
import { dashboardStatsItemClass, dashboardStatsRowClass } from "../dashboardStyles";

interface DashboardTicketsStatsProps {
  stats?: MyEntriesStats;
  isLoading: boolean;
}

function StatsSkeletonRow() {
  return (
    <div className={cn(dashboardListShellClass, "p-3")} aria-hidden="true">
      <div className={dashboardStatsRowClass}>
        {[...Array(3)].map((_, index) => (
          <div key={index} className={dashboardStatsItemClass}>
            <DashboardStatCard icon={Ticket} isLoading compact />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardTicketsStats({ stats, isLoading }: DashboardTicketsStatsProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <StatsSkeletonRow />;
  }

  if (!stats || stats.totalTickets === 0) {
    return null;
  }

  const items = [
    {
      title: t("dashboard.tickets.totalTickets"),
      value: stats.totalTickets,
      variant: "gold" as const,
    },
    {
      title: t("dashboard.tickets.active"),
      value: stats.activeTickets,
      variant: "emerald" as const,
    },
    {
      title: t("dashboard.tickets.competitions"),
      value: stats.competitionCount,
      variant: "purple" as const,
    },
    ...(stats.prizeWins > 0
      ? [
          {
            title: t("dashboard.tickets.prizeWins"),
            value: stats.prizeWins,
            variant: "gold" as const,
          },
        ]
      : []),
  ];

  return (
    <div className={cn(dashboardListShellClass, "p-3")}>
      <div className={dashboardStatsRowClass}>
        {items.map((item) => (
          <div key={item.title} className={dashboardStatsItemClass}>
            <DashboardStatCard
              title={item.title}
              value={item.value}
              icon={Ticket}
              variant={item.variant}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
