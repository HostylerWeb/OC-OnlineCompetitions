"use client";

import { cn } from "@oc/utils";
import { useTranslation } from "@/lib/i18n";
import { DASHBOARD_LIST_VIEW_MODES, type DashboardListViewMode } from "./dashboard-list-view-mode";

interface DashboardListViewModeToggleProps {
  value: DashboardListViewMode;
  onChange: (mode: DashboardListViewMode) => void;
  ariaLabel?: string;
  className?: string;
  umamiEvent?: string;
}

export function DashboardListViewModeToggle({
  value,
  onChange,
  ariaLabel = "List layout",
  className,
  umamiEvent,
}: DashboardListViewModeToggleProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-background/80 p-0.5 shadow-sm",
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {DASHBOARD_LIST_VIEW_MODES.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          title={t("common.view")}
          aria-pressed={value === id}
          data-umami-event={umamiEvent}
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-xs transition-colors",
            value === id
              ? "bg-gold/15 text-gold shadow-sm ring-1 ring-gold/25"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
