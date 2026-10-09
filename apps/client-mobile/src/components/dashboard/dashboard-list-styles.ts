import { cn } from "@oc/utils";
import type { CSSProperties } from "react";

export const dashboardListShellClass =
  "overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-gold/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(212,175,55,0.07)]";

export const dashboardListScrollClass =
  "scrollbar-gutter-stable scrollbar-thin scrollbar-thumb-gold/30 scrollbar-track-transparent";

export const dashboardCompactRowClass = cn(
  dashboardListShellClass,
  "flex h-[var(--dashboard-compact-h)] items-center gap-3 px-3"
);

export const dashboardCompactThumbClass =
  "relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted/40 ring-1 ring-inset ring-border/40";

export const dashboardCompactBodyClass = "min-w-0 flex-1";
export const dashboardCompactTitleClass =
  "truncate text-sm font-semibold leading-tight text-foreground";
export const dashboardCompactMetaClass =
  "mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0 text-xs text-muted-foreground";
export const dashboardCompactAsideClass = "flex shrink-0 items-center gap-2";

export const dashboardGridTileClass = cn(
  dashboardListShellClass,
  "group relative flex aspect-square flex-col overflow-hidden"
);

export const dashboardGridImageClass = "relative min-h-0 flex-1 bg-muted/30";
export const dashboardGridFooterClass =
  "flex shrink-0 flex-col gap-1 border-t border-border/50 bg-muted/15 p-2.5";

export const dashboardCardRowClass = cn(
  dashboardListShellClass,
  "flex h-[var(--dashboard-card-h)] overflow-hidden"
);

export const dashboardCardImageClass = "relative w-[7.5rem] shrink-0 bg-muted/30 sm:w-36";

export const dashboardCardBodyClass = "flex min-w-0 flex-1 flex-col";
export const dashboardCardHeaderClass =
  "flex items-start justify-between gap-3 border-b border-border/40 px-4 py-3";
export const dashboardCardContentClass = "min-h-0 flex-1 overflow-hidden px-4 py-2.5";
export const dashboardCardFooterClass =
  "flex shrink-0 items-center justify-between gap-3 border-t border-border/40 bg-muted/15 px-4 py-2.5";

export function dashboardListCssVars(compactH: number, cardH: number): CSSProperties {
  return {
    ["--dashboard-compact-h" as string]: `${compactH}px`,
    ["--dashboard-card-h" as string]: `${cardH}px`,
  };
}
