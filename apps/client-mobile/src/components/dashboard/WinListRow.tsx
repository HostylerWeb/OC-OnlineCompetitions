"use client";

import type { LucideIcon } from "@oc/icons";
import {
  DASHBOARD_LIST_GAP,
  DASHBOARD_LIST_HEIGHTS,
  getDashboardCardRowHeight,
  getDashboardCompactRowHeight,
} from "./dashboard-list-heights";
import { dashboardListCssVars } from "./dashboard-list-styles";
import type { DashboardListViewMode } from "./dashboard-list-view-mode";
import { WinCard } from "./WinCard";

export interface WinListItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  value?: number;
  ticketNumber?: number;
  date: string;
  claimed: boolean;
  icon: LucideIcon;
}

interface WinListRowProps {
  index: number;
  style: React.CSSProperties;
  wins: WinListItem[];
  viewMode: Extract<DashboardListViewMode, "compact" | "card">;
}

export function WinListRow({ index, style, wins, viewMode }: WinListRowProps) {
  const item = wins[index];
  if (!item) return null;

  const rowHeight =
    viewMode === "compact" ? getDashboardCompactRowHeight("win") : getDashboardCardRowHeight("win");
  const gap = viewMode === "compact" ? DASHBOARD_LIST_GAP.compact : DASHBOARD_LIST_GAP.card;

  return (
    <div
      style={{
        ...style,
        ...dashboardListCssVars(
          DASHBOARD_LIST_HEIGHTS.win.compact,
          DASHBOARD_LIST_HEIGHTS.win.card
        ),
        height: rowHeight,
        marginTop: index > 0 ? gap : 0,
      }}
    >
      <WinCard variant={viewMode} {...item} />
    </div>
  );
}

interface WinGridRowProps {
  index: number;
  style: React.CSSProperties;
  wins: WinListItem[];
  columnCount?: number;
}

export function WinGridRow({ index, style, wins, columnCount = 2 }: WinGridRowProps) {
  const start = index * columnCount;
  const rowItems = wins.slice(start, start + columnCount);
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
      {rowItems.map((item) => (
        <WinCard key={item.id} variant="grid" {...item} />
      ))}
    </div>
  );
}
