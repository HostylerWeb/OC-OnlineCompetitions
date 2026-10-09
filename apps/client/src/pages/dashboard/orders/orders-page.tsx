"use client";

import { useInfiniteMyOrders } from "@oc/api-client";
import { Package } from "@oc/icons";
import { useMemo, useState, useEffect } from "react";
import { useData } from "vike-react/useData";
import {
  DashboardEmptyCard,
  DashboardFilterTabs,
  DashboardListSkeleton,
  DashboardListToolbar,
  type DashboardListViewMode,
  DashboardListViewModeToggle,
  DashboardPageHeader,
  DashboardVirtualList,
  getDashboardCardRowHeightWithGap,
  getDashboardCompactRowHeightWithGap,
  OrderGridRow,
  OrderListRow,
  type OrderStatusFilter,
  orderMatchesStatusFilter,
} from "@/components/dashboard";
import { EmptyState } from "@/components/EmptyState";
import { useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";

const ORDER_STATUS_FILTERS = [
  { value: "all" as const, labelKey: "dashboard.orders.all" },
  { value: "paid" as const, labelKey: "dashboard.orders.paid" },
  { value: "pending" as const, labelKey: "dashboard.orders.pending" },
  { value: "failed" as const, labelKey: "dashboard.orders.failed" },
  { value: "refunded" as const, labelKey: "dashboard.orders.refunded" },
] as const;

export default function DashboardOrdersView() {
  const { t } = useTranslation();
  const data = useData<Data>();
  const {
    data: ordersDataResult,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMyOrders(20, {
    initialData: data?.ordersPage1?.length
      ? {
          pages: [
            {
              data: data.ordersPage1,
              meta: {
                page: 1,
                limit: 20,
                hasMore: data.ordersPage1.length >= 20,
              },
            },
          ],
          pageParams: [1],
        }
      : undefined,
  });
  const [filter, setFilter] = useState<OrderStatusFilter>("all");
  const [viewMode, setViewMode] = useState<DashboardListViewMode>("compact");

  const orders = (ordersDataResult?.pages ?? []).flatMap((p) => p.data ?? []);

  const filteredOrders = useMemo(
    () => orders.filter((order) => orderMatchesStatusFilter(order, filter)),
    [filter, orders]
  );

  useEffect(() => {
    if (filter === "all" || isLoading || isFetchingNextPage || !hasNextPage) return;
    if (filteredOrders.length === 0) {
      void fetchNextPage();
    }
  }, [filter, filteredOrders.length, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const listViewMode = viewMode === "grid" ? "card" : viewMode;

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title={t("dashboard.orders.heading")}
        subtitle={t("dashboard.orders.subtitle")}
      />

      <DashboardListToolbar
        filters={
          <DashboardFilterTabs
            value={filter}
            onValueChange={setFilter}
            options={ORDER_STATUS_FILTERS.map((f) => ({ value: f.value, label: t(f.labelKey) }))}
            umamiEvent="orders:filter-change"
          />
        }
        actions={
          <DashboardListViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            ariaLabel={t("dashboard.orders.layoutAria")}
            umamiEvent="orders:view-mode-toggle"
          />
        }
      />

      {isLoading ? (
        <DashboardListSkeleton viewMode={viewMode} count={5} entity="order" />
      ) : isError ? (
        <EmptyState
          icon={Package}
          title={t("dashboard.orders.failedToLoad")}
          description={t("dashboard.orders.failedToLoadDesc")}
          action={{ label: t("dashboard.orders.retry"), onClick: () => refetch() }}
          umamiEvent="orders:retry"
        />
      ) : filteredOrders.length === 0 ? (
        <DashboardEmptyCard
          icon={Package}
          title={
            filter === "all"
              ? t("dashboard.orders.noOrders")
              : t("dashboard.orders.noOrdersFiltered", { filter })
          }
          description={t("dashboard.orders.noOrdersDesc")}
          action={{ label: t("dashboard.orders.browseCompetitions"), href: "/competitions" }}
        />
      ) : (
        <DashboardVirtualList
          viewMode={viewMode}
          itemCount={filteredOrders.length}
          listRowComponent={OrderListRow}
          gridRowComponent={OrderGridRow}
          listRowProps={{ orders: filteredOrders, viewMode: listViewMode }}
          gridRowProps={{ orders: filteredOrders }}
          compactRowHeight={getDashboardCompactRowHeightWithGap("order")}
          cardRowHeight={getDashboardCardRowHeightWithGap("order")}
          isInfinite
          fetchNextPage={fetchNextPage}
          hasMore={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      )}
    </div>
  );
}
