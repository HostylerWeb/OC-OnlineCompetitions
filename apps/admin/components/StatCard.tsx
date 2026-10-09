"use client";

import { Info } from "@oc/icons";
import type * as React from "react";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "./ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  description?: React.ReactNode;
  tooltip?: React.ReactNode;
  trend?: {
    value: string;
    direction?: "up" | "down" | "flat";
  };
  className?: string;
  accent?: "default" | "primary" | "success" | "warning";
}

const accentClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "",
  primary: "border-primary/30",
  success: "border-emerald-500/40",
  warning: "border-amber-500/40",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  tooltip,
  trend,
  className,
  accent = "default",
}: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden bg-card", accentClasses[accent], className)}>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
            {tooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`What ${label} means`}
                    className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Info className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-72 text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </span>
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          {description ? (
            <span className="text-xs text-muted-foreground">{description}</span>
          ) : null}
        </div>

        {trend ? (
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              trend.direction === "up" && "bg-emerald-500/10 text-emerald-500",
              trend.direction === "down" && "bg-red-500/10 text-red-500",
              (!trend.direction || trend.direction === "flat") && "bg-muted text-muted-foreground"
            )}
          >
            {trend.value}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
