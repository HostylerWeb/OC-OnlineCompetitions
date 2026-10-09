"use client";

import type { LucideIcon } from "@oc/icons";
import { cn } from "@oc/utils";
import type { ReactNode } from "react";

interface DashboardSectionProps {
  title: string;
  icon?: LucideIcon;
  count?: number;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  icon: Icon,
  count,
  toolbar,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        {Icon ? (
          <span className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
            <Icon className="size-3.5 text-gold" aria-hidden="true" />
          </span>
        ) : null}
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {count != null ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {toolbar}
      {children}
    </section>
  );
}
