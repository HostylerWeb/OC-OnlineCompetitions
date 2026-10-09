// Barrel for dashboard-ui components.
// Simplified stubs  -  no react-window or @oc/icons dependencies.
// Replace with full implementations from onlinecompetitions-web/packages/ui when needed.

import type { ReactNode } from "react";

// --- VirtualList (flexible stub) ---
export function VirtualList({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={className}>{children}</div>;
}

export function VirtualGrid({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={className}>{children}</div>;
}

import { cn } from "@oc/utils";
import { Card } from "@/components/ui/card";
import { formatCurrency, useTranslation } from "@/lib/i18n";

// --- DashboardHeader ---
interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function DashboardHeader({ title, subtitle, action, className }: DashboardHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

// --- DashboardStatCard ---
interface DashboardStatCardProps {
  title?: string;
  value?: string | number;
  subtitle?: string;
  subValue?: string;
  icon?: React.ElementType;
  variant?: "gold" | "emerald" | "purple";
  isLoading?: boolean;
  isHero?: boolean;
  compact?: boolean;
}

export function DashboardStatCard({
  title,
  value,
  subtitle,
  subValue,
  icon: Icon,
  isLoading = false,
}: DashboardStatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {title ? <p className="text-xs font-medium text-muted-foreground">{title}</p> : null}
          {isLoading ? (
            <div className="mt-1 h-6 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value ?? " - "}</p>
          )}
        </div>
        {Icon ? <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </div>
      {subtitle ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {subValue ? <span className="font-medium text-foreground">{subValue} </span> : null}
          {subtitle}
        </p>
      ) : null}
    </Card>
  );
}

// --- EmptyState ---
interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  variant?: "default" | "embedded";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "embedded" ? "py-8" : "py-12",
        className
      )}
    >
      {Icon ? <Icon className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden /> : null}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        <button
          onClick={action.onClick}
          className="mt-3 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

// --- PriceCell ---
interface PriceCellProps {
  value: number | null | undefined;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PriceCell({ value, className }: PriceCellProps) {
  const { locale } = useTranslation();
  if (value == null) {
    return (
      <span className={cn("text-muted-foreground font-medium tabular-nums", className)}>--</span>
    );
  }
  const formatted = formatCurrency(value, locale);
  return <span className={cn("font-medium tabular-nums", className)}>{formatted}</span>;
}

// --- StatusBadge ---
export type StatusVariant = string;

export { StatusBadge } from "@/components/StatusBadge";
