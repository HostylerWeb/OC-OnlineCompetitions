"use client";

import type { MeOrderDto } from "@oc/types";
import {
  DASHBOARD_LIST_GAP,
  DASHBOARD_LIST_HEIGHTS,
  getDashboardCardRowHeight,
  getDashboardCompactRowHeight,
} from "./dashboard-list-heights";
import { dashboardListCssVars } from "./dashboard-list-styles";
import type { DashboardListViewMode } from "./dashboard-list-view-mode";
import { OrderCard } from "./OrderCard";

interface OrderListRowProps {
  index: number;
  style: React.CSSProperties;
  orders: MeOrderDto[];
  viewMode: Extract<DashboardListViewMode, "compact" | "card">;
}

export function OrderListRow({ index, style, orders, viewMode }: OrderListRowProps) {
  const order = orders[index];
  if (!order) return null;

  const rowHeight =
    viewMode === "compact"
      ? getDashboardCompactRowHeight("order")
      : getDashboardCardRowHeight("order");
  const gap = viewMode === "compact" ? DASHBOARD_LIST_GAP.compact : DASHBOARD_LIST_GAP.card;

  return (
    <div
      style={{
        ...style,
        ...dashboardListCssVars(
          DASHBOARD_LIST_HEIGHTS.order.compact,
          DASHBOARD_LIST_HEIGHTS.order.card
        ),
        height: rowHeight,
        marginTop: index > 0 ? gap : 0,
      }}
    >
      <OrderCard order={order} variant={viewMode} />
    </div>
  );
}

interface OrderGridRowProps {
  index: number;
  style: React.CSSProperties;
  orders: MeOrderDto[];
  columnCount?: number;
}

export function OrderGridRow({ index, style, orders, columnCount = 2 }: OrderGridRowProps) {
  const start = index * columnCount;
  const rowItems = orders.slice(start, start + columnCount);
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
      {rowItems.map((order) => (
        <OrderCard key={order._id} order={order} variant="grid" />
      ))}
    </div>
  );
}
