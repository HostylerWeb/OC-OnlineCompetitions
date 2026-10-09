"use client";

import type { LucideIcon } from "@oc/icons";
import { cn, formatDate } from "@oc/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, useTranslation } from "@/lib/i18n";
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
import type { WinViewMode } from "./win-view-mode";

interface WinCardProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  value?: number;
  ticketNumber?: number;
  date: string;
  claimed: boolean;
  icon: LucideIcon;
  variant?: WinViewMode;
}

function formatWinDate(date: string) {
  return formatDate(date);
}

function WinThumbnail({
  imageUrl,
  icon: Icon,
  className,
}: {
  imageUrl?: string;
  icon: LucideIcon;
  className?: string;
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
          <Icon className="size-6 text-primary/35 sm:size-7" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function WinCompactCard({
  title,
  subtitle,
  imageUrl,
  value,
  ticketNumber,
  date,
  claimed,
  icon: Icon,
}: WinCardProps) {
  const { t, locale } = useTranslation();
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
            <Icon className="size-4 text-primary/40" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className={dashboardCompactBodyClass}>
        <p className={dashboardCompactTitleClass}>{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        <div className={dashboardCompactMetaClass}>
          {ticketNumber != null ? (
            <span>
              {t("dashboard.wins.ticketPrefix")}
              <span className="font-mono text-primary">{ticketNumber}</span>
            </span>
          ) : null}
          <span>{formatWinDate(date)}</span>
          {value != null && value > 0 ? (
            <span className="font-medium text-foreground">{formatCurrency(value, locale)}</span>
          ) : null}
        </div>
      </div>

      <div className={dashboardCompactAsideClass}>
        {claimed ? (
          <StatusBadge variant="success">{t("dashboard.wins.statuses.claimed")}</StatusBadge>
        ) : (
          <StatusBadge variant="pending">{t("dashboard.wins.statuses.pending")}</StatusBadge>
        )}
      </div>
    </div>
  );
}

function WinGridCard({
  title,
  subtitle,
  imageUrl,
  value,
  ticketNumber,
  date,
  claimed,
  icon: Icon,
}: WinCardProps) {
  const { t, locale } = useTranslation();
  return (
    <div className={dashboardGridTileClass}>
      <WinThumbnail imageUrl={imageUrl} icon={Icon} className={dashboardGridImageClass} />
      {value != null && value > 0 ? (
        <Badge className="absolute top-1.5 right-1.5 text-[10px]">
          {formatCurrency(value, locale)}
        </Badge>
      ) : null}
      {!claimed ? (
        <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px]">
          {t("dashboard.wins.statuses.pending")}
        </Badge>
      ) : null}

      <div className={dashboardGridFooterClass}>
        <p className="truncate text-xs font-semibold leading-tight" title={title}>
          {title}
        </p>
        {subtitle ? (
          <p className="truncate text-[11px] text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
          <span className="truncate">{formatWinDate(date)}</span>
          {ticketNumber != null ? (
            <span className="shrink-0 font-mono text-primary">#{ticketNumber}</span>
          ) : null}
        </div>
        {claimed ? (
          <StatusBadge variant="success" className="w-fit text-[10px]">
            {t("dashboard.wins.statuses.claimed")}
          </StatusBadge>
        ) : null}
      </div>
    </div>
  );
}

function WinDefaultCard({
  title,
  subtitle,
  imageUrl,
  value,
  ticketNumber,
  date,
  claimed,
  icon: Icon,
}: WinCardProps) {
  const { t, locale } = useTranslation();
  return (
    <div className={dashboardCardRowClass}>
      <div className={cn(dashboardCardImageClass, "relative h-full")}>
        <WinThumbnail imageUrl={imageUrl} icon={Icon} className="size-full" />
        {value != null && value > 0 ? (
          <Badge className="absolute top-2 right-2">{formatCurrency(value, locale)}</Badge>
        ) : null}
      </div>

      <div className={dashboardCardBodyClass}>
        <div className={dashboardCardHeaderClass}>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            dashboardCardContentClass,
            "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
          )}
        >
          {ticketNumber != null ? (
            <span>
              {t("dashboard.wins.ticketPrefix")}
              <span className="font-mono text-primary">{ticketNumber}</span>
            </span>
          ) : null}
          <span>{formatWinDate(date)}</span>
        </div>

        <div className={dashboardCardFooterClass}>
          {claimed ? (
            <StatusBadge variant="success">{t("dashboard.wins.statuses.claimed")}</StatusBadge>
          ) : (
            <StatusBadge variant="pending">{t("dashboard.wins.statuses.pending")}</StatusBadge>
          )}
        </div>
      </div>
    </div>
  );
}

export function WinCard({ variant = "card", ...props }: WinCardProps) {
  switch (variant) {
    case "compact":
      return <WinCompactCard {...props} />;
    case "grid":
      return <WinGridCard {...props} />;
    default:
      return <WinDefaultCard {...props} />;
  }
}
