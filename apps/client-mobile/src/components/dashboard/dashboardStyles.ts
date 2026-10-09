import { cn } from "@oc/utils";

export const dashboardCardShellClass = "gap-0 border-border/70 py-0 shadow-sm";

export const dashboardCardHeaderClass = "px-5 pt-5 pb-3";
export const dashboardCardContentClass = "px-5 pb-5";
export const dashboardCardFooterClass = "px-5 py-4 border-t";

export function dashboardCardClass(extra?: string) {
  return cn(dashboardCardShellClass, extra);
}

export const dashboardStatsRowClass =
  "flex w-full min-w-0 flex-nowrap items-stretch gap-2 sm:gap-2.5";

export const dashboardStatsItemClass = "min-w-0 flex-1 basis-0";
