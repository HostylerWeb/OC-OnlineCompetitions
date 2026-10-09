"use client";

import { cn } from "@oc/utils";
import type { ReactNode } from "react";

interface DashboardListToolbarProps {
  filters: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DashboardListToolbar({ filters, actions, className }: DashboardListToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border/60 bg-muted/15 p-2 sm:gap-3 sm:p-2.5",
        className
      )}
    >
      <div className="min-w-0 flex-1">{filters}</div>
      {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
    </div>
  );
}
