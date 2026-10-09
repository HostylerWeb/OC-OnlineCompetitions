import type { MeOrderDto } from "@oc/types";
import type { StatusVariant } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";

export type OrderStatusFilter = "all" | "paid" | "pending" | "failed" | "refunded";

export function getOrderItemCount(order: MeOrderDto): number {
  return order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}

export function getOrderPreviewImage(order: MeOrderDto): string | undefined {
  for (const item of order.items ?? []) {
    const comp = item.competitionId;
    if (typeof comp === "object" && comp.prizeImageUrl) {
      return comp.prizeImageUrl;
    }
  }
  return undefined;
}

export function getOrderSummaryTitle(
  order: MeOrderDto,
  t?: (key: string, params?: Record<string, string | number>) => string
): string {
  const tf = t ?? ((key: string) => key);
  const items = order.items ?? [];
  if (items.length === 0) return tf("dashboard.orders.competitionEntries");

  const firstTitle =
    typeof items[0]?.competitionId === "object" ? items[0].competitionId.title : undefined;

  if (items.length === 1) {
    return firstTitle ?? tf("dashboard.orders.competitionEntries");
  }

  return `${firstTitle ?? tf("dashboard.orders.competition")} +${items.length - 1} more`;
}

export function orderMatchesStatusFilter(order: MeOrderDto, filter: OrderStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "paid") {
    return order.status === "completed" || order.status === "processing";
  }
  if (filter === "pending") return order.status === "pending";
  if (filter === "failed") return order.status === "failed";
  if (filter === "refunded") return order.status === "refunded";
  return false;
}

export function orderStatusBadgeVariant(status: MeOrderDto["status"]): StatusVariant {
  switch (status) {
    case "completed":
      return "paid";
    case "processing":
      return "processing";
    case "pending":
      return "pending";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "pending";
  }
}

export function orderStatusLabel(status: MeOrderDto["status"], t: (key: string) => string): string {
  switch (status) {
    case "completed":
      return t("dashboard.orders.statusLabels.paid");
    case "processing":
      return t("dashboard.orders.statusLabels.processing");
    case "pending":
      return t("dashboard.orders.statusLabels.pending");
    case "failed":
      return t("dashboard.orders.statusLabels.failed");
    case "refunded":
      return t("dashboard.orders.statusLabels.refunded");
    default:
      return status;
  }
}

export function formatOrderDate(date: string) {
  return formatDate(date);
}

export function getOrderDetailHref(order: MeOrderDto) {
  const params = new URLSearchParams({ order_id: order._id });
  if (order.provider && order.providerSessionId) {
    params.set("provider", order.provider);
    params.set("session_id", order.providerSessionId);
  }
  return `/checkout/success?${params.toString()}`;
}
