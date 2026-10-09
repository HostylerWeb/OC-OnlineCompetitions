"use client";

import { ArrowRight, Package } from "@oc/icons";
import type { MeOrderDto } from "@oc/types";
import { cn, OrderNumberCell } from "@oc/utils";
import { PriceCell } from "@/components/PriceCell";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import {
  dashboardCardBodyClass,
  dashboardCardContentClass,
  dashboardCardFooterClass,
  dashboardCardHeaderClass,
  dashboardCardImageClass,
  dashboardCardRowClass,
  dashboardCompactAsideClass,
  dashboardCompactBodyClass,
  dashboardCompactMetaClass,
  dashboardCompactRowClass,
  dashboardCompactThumbClass,
  dashboardCompactTitleClass,
  dashboardGridFooterClass,
  dashboardGridImageClass,
  dashboardGridTileClass,
} from "./dashboard-list-styles";
import type { DashboardListViewMode } from "./dashboard-list-view-mode";
import {
  formatOrderDate,
  getOrderDetailHref,
  getOrderItemCount,
  getOrderPreviewImage,
  getOrderSummaryTitle,
  orderStatusBadgeVariant,
  orderStatusLabel,
} from "./order-helpers";

interface OrderCardProps {
  order: MeOrderDto;
  variant?: DashboardListViewMode;
}

function OrderThumbnail({
  imageUrl,
  orderNumber,
  className,
  badgeClassName,
}: {
  imageUrl?: string;
  orderNumber: number | null | undefined;
  className?: string;
  badgeClassName?: string;
}) {
  return (
    <div className={cn("relative bg-muted/30", className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="object-cover"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Package className="size-6 text-primary/35 sm:size-7" aria-hidden="true" />
        </div>
      )}
      <Badge
        variant="secondary"
        className={cn(
          "absolute top-1.5 left-1.5 bg-background/85 text-[10px] backdrop-blur-sm",
          badgeClassName
        )}
      >
        <OrderNumberCell value={orderNumber} />
      </Badge>
    </div>
  );
}

function OrderStatusChip({ order }: { order: MeOrderDto }) {
  const { t } = useTranslation();
  return (
    <StatusBadge variant={orderStatusBadgeVariant(order.status)}>
      {orderStatusLabel(order.status, (key: string) => t(key as any))}
    </StatusBadge>
  );
}

function OrderViewLink({ order, compact = false }: { order: MeOrderDto; compact?: boolean }) {
  const { t } = useTranslation();
  if (compact) {
    return (
      <a
        href={getOrderDetailHref(order)}
        aria-label={t("dashboard.orders.viewOrder")}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
      </a>
    );
  }

  return (
    <a
      href={getOrderDetailHref(order)}
      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
    >
      {t("dashboard.orders.view")}
      <ArrowRight data-icon="inline-end" />
    </a>
  );
}

function OrderCompactCard({ order }: { order: MeOrderDto }) {
  const { t } = useTranslation();
  const imageUrl = getOrderPreviewImage(order);
  const itemCount = getOrderItemCount(order);
  const canView = order.status === "completed" || order.status === "processing";

  return (
    <div className={dashboardCompactRowClass}>
      <div className={dashboardCompactThumbClass}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="object-cover"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Package className="size-4 text-primary/40" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className={dashboardCompactBodyClass}>
        <p className={dashboardCompactTitleClass}>
          {t("dashboard.orders.orderPrefix")}
          <OrderNumberCell value={order.orderNumber} />
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {getOrderSummaryTitle(order, (key: string, p?: any) => t(key as any, p))}
        </p>
        <div className={dashboardCompactMetaClass}>
          <span>{formatOrderDate(order.createdAt)}</span>
          {itemCount > 0 ? (
            <span>
              {t("dashboard.tickets.totalTickets")}: {itemCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className={dashboardCompactAsideClass}>
        <OrderStatusChip order={order} />
        <PriceCell value={order.total} size="sm" />
        {canView ? <OrderViewLink order={order} compact /> : null}
      </div>
    </div>
  );
}

function OrderGridCard({ order }: { order: MeOrderDto }) {
  const { t } = useTranslation();
  const imageUrl = getOrderPreviewImage(order);
  const itemCount = getOrderItemCount(order);
  const canView = order.status === "completed" || order.status === "processing";

  const content = (
    <div className={dashboardGridTileClass}>
      <OrderThumbnail
        imageUrl={imageUrl}
        orderNumber={order.orderNumber}
        className={dashboardGridImageClass}
        badgeClassName="top-1 left-1"
      />
      <div className="absolute top-1.5 right-1.5">
        <PriceCell value={order.total} size="sm" />
      </div>

      <div className={dashboardGridFooterClass}>
        <div className="flex items-start justify-between gap-1.5">
          <p
            className="min-w-0 truncate text-xs font-semibold leading-tight"
            title={getOrderSummaryTitle(order, (key: string, p?: any) => t(key as any, p))}
          >
            {getOrderSummaryTitle(order, (key: string, p?: any) => t(key as any, p))}
          </p>
          <OrderStatusChip order={order} />
        </div>
        <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
          <span>{formatOrderDate(order.createdAt)}</span>
          {itemCount > 0 ? (
            <span>
              {itemCount} {t("dashboard.tickets.totalTickets").toLowerCase()}
            </span>
          ) : null}
        </div>
        {canView ? (
          <span className="text-[11px] font-medium text-gold transition-colors group-hover:text-gold/80">
            {t("dashboard.orders.viewOrder")} →
          </span>
        ) : null}
      </div>
    </div>
  );

  if (canView) {
    return (
      <a
        href={getOrderDetailHref(order)}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </a>
    );
  }

  return content;
}

function OrderDefaultCard({ order }: { order: MeOrderDto }) {
  const { t } = useTranslation();
  const imageUrl = getOrderPreviewImage(order);
  const itemCount = getOrderItemCount(order);
  const canView = order.status === "completed" || order.status === "processing";
  const items = order.items ?? [];

  return (
    <div className={dashboardCardRowClass}>
      <OrderThumbnail
        imageUrl={imageUrl}
        orderNumber={order.orderNumber}
        className={cn(dashboardCardImageClass, "h-full")}
      />

      <div className={dashboardCardBodyClass}>
        <div className={dashboardCardHeaderClass}>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {getOrderSummaryTitle(order, (key: string, p?: any) => t(key as any, p))}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatOrderDate(order.createdAt)}
              {itemCount > 0
                ? ` · ${itemCount} ${t("dashboard.tickets.totalTickets").toLowerCase()}`
                : ""}
            </p>
          </div>
          <PriceCell value={order.total} size="md" />
        </div>

        <ul className={cn(dashboardCardContentClass, "flex flex-col gap-1.5")}>
          {items.slice(0, 3).map((item) => {
            const title =
              typeof item.competitionId === "object"
                ? item.competitionId.title
                : t("dashboard.orders.competition");
            return (
              <li
                key={item._id}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                <span className="min-w-0 truncate">
                  {title ?? t("dashboard.orders.competition")}
                </span>
                <span className="shrink-0 tabular-nums">×{item.quantity}</span>
              </li>
            );
          })}
          {items.length > 3 ? (
            <li className="text-xs text-muted-foreground/80">
              {t("dashboard.orders.moreItems", { count: items.length - 3 })}
            </li>
          ) : null}
        </ul>

        <div className={dashboardCardFooterClass}>
          <OrderStatusChip order={order} />
          {canView ? <OrderViewLink order={order} /> : null}
        </div>
      </div>
    </div>
  );
}

export function OrderCard({ order, variant = "card" }: OrderCardProps) {
  switch (variant) {
    case "compact":
      return <OrderCompactCard order={order} />;
    case "grid":
      return <OrderGridCard order={order} />;
    default:
      return <OrderDefaultCard order={order} />;
  }
}
