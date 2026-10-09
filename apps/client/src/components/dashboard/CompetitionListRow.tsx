"use client";

import type { Competition } from "@oc/types";
import { CompetitionCard } from "./CompetitionCard";
import {
  DASHBOARD_LIST_GAP,
  DASHBOARD_LIST_HEIGHTS,
  getDashboardCardRowHeight,
  getDashboardCompactRowHeight,
} from "./dashboard-list-heights";
import { dashboardListCssVars } from "./dashboard-list-styles";
import type { DashboardListViewMode } from "./dashboard-list-view-mode";

interface CompetitionListRowProps {
  index: number;
  style: React.CSSProperties;
  competitions: Competition[];
  viewMode: Extract<DashboardListViewMode, "compact" | "card">;
}

export function CompetitionListRow({
  index,
  style,
  competitions,
  viewMode,
}: CompetitionListRowProps) {
  const competition = competitions[index];
  if (!competition) return null;

  const rowHeight =
    viewMode === "compact"
      ? getDashboardCompactRowHeight("competition")
      : getDashboardCardRowHeight("competition");
  const gap = viewMode === "compact" ? DASHBOARD_LIST_GAP.compact : DASHBOARD_LIST_GAP.card;

  return (
    <div
      style={{
        ...style,
        ...dashboardListCssVars(
          DASHBOARD_LIST_HEIGHTS.competition.compact,
          DASHBOARD_LIST_HEIGHTS.competition.card
        ),
        height: rowHeight,
        marginTop: index > 0 ? gap : 0,
      }}
    >
      <CompetitionCard competition={competition} variant={viewMode} />
    </div>
  );
}

interface CompetitionGridRowProps {
  index: number;
  style: React.CSSProperties;
  competitions: Competition[];
  columnCount?: number;
}

export function CompetitionGridRow({
  index,
  style,
  competitions,
  columnCount = 2,
}: CompetitionGridRowProps) {
  const start = index * columnCount;
  const rowItems = competitions.slice(start, start + columnCount);
  if (rowItems.length === 0) return null;

  return (
    <div
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gap: DASHBOARD_LIST_GAP.grid,
        marginTop: index > 0 ? DASHBOARD_LIST_GAP.grid : 0,
      }}
    >
      {rowItems.map((competition) => (
        <CompetitionCard key={competition._id} competition={competition} variant="grid" />
      ))}
    </div>
  );
}
