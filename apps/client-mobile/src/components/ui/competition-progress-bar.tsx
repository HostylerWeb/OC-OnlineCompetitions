"use client";

import type { Competition, PublicBonusAwardEntry } from "@oc/types";
import { Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ProgressVariant = "detail" | "card" | "compact" | "compact-meta" | "entries";

export interface CompetitionProgressBarProps {
  competition: Pick<Competition, "_id" | "ticketsSold" | "maxTickets">;
  bonusAwards?: PublicBonusAwardEntry[];
  variant?: ProgressVariant;
  className?: string;
  showLabel?: boolean;
  countdownLabel?: string;
  percentageBelow?: boolean;
}

type MilestoneState = "passed" | "current" | "upcoming";

interface Milestone {
  pct: number;
  state: MilestoneState;
  label: string;
  value?: number;
  wonCount: number;
  quantity: number;
  ticketsToGo: number;
}

function computeProgress(competition: CompetitionProgressBarProps["competition"]): number {
  if (!competition.maxTickets || competition.maxTickets <= 0) return 0;
  return ((competition.ticketsSold ?? 0) / competition.maxTickets) * 100;
}

function resolveMilestones(
  bonusAwards: PublicBonusAwardEntry[],
  ticketsSold: number,
  maxTickets: number
): Milestone[] {
  const unfired = bonusAwards
    .filter((a) => !a.assignment.firedAt)
    .sort((x, y) => x.assignment.milestonePct - y.assignment.milestonePct);
  const currentId = unfired[0]?.assignment._id;

  return bonusAwards.map((a) => {
    const fired = !!a.assignment.firedAt;
    const threshold = Math.floor((maxTickets * a.assignment.milestonePct) / 100);
    const passed = fired || threshold <= ticketsSold;
    const isCurrent = !fired && !passed && a.assignment._id === currentId;
    return {
      pct: a.assignment.milestonePct,
      state: passed ? "passed" : isCurrent ? "current" : "upcoming",
      label: a.bonusAward.title,
      value: a.bonusAward.value,
      wonCount: a.assignment.wonCount ?? 0,
      quantity: a.assignment.quantity,
      ticketsToGo: Math.max(0, threshold - ticketsSold),
    } satisfies Milestone;
  });
}

interface BarVisualProps {
  pct: number;
  height: string;
  textSize: string;
  showInlineLabel: boolean;
  ariaLabel: string;
  shape?: "rounded-full" | "rounded-md";
  fillClass?: string;
  borderClass?: string;
  milestones?: Milestone[];
  t: (key: string, params?: Record<string, string | number>) => string;
}

function MilestoneTooltipContent({
  milestone,
  t,
}: {
  milestone: Milestone;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const isPassed = milestone.state === "passed";
  const isCurrent = milestone.state === "current";
  return (
    <div className="space-y-1.5 text-left">
      <div className="flex items-center gap-1.5">
        <Star className="size-3 fill-gold text-gold" />
        <span className="font-bold text-gold">
          {t("progressBar.pctMilestone", { pct: milestone.pct })}
        </span>
      </div>
      <div className="space-y-0.5">
        <p className="font-semibold text-background">{milestone.label}</p>
        {milestone.value != null && milestone.value > 0 ? (
          <p className="text-xs text-background/80">
            {t("progressBar.prizeAmount", { value: milestone.value.toLocaleString() })}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 border-t border-background/20 pt-1.5 text-xs">
        {isPassed ? (
          <span className="inline-flex items-center gap-1 text-background/90">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {t("progressBar.wonCount", {
              won: milestone.wonCount,
              total: milestone.quantity,
            })}
          </span>
        ) : isCurrent ? (
          <span className="inline-flex items-center gap-1 text-background/90">
            <Sparkles className="size-2.5" />
            {milestone.ticketsToGo > 0
              ? t("progressBar.ticketsToGo", { count: milestone.ticketsToGo })
              : t("progressBar.activatingNow")}
          </span>
        ) : (
          <span className="text-background/70">
            {t("progressBar.activatesAt", { pct: milestone.pct })}
          </span>
        )}
      </div>
    </div>
  );
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

function ProgressBarVisual({
  pct,
  height,
  textSize,
  showInlineLabel,
  ariaLabel,
  shape = "rounded-md",
  fillClass,
  borderClass = "border-gold/20",
  milestones,
  t,
}: BarVisualProps) {
  const mounted = useMounted();

  const fillBase =
    fillClass ?? "absolute inset-y-0 left-0 bg-gradient-to-r from-gold-light to-gold";

  const clipRight = Math.max(0, 100 - pct);

  return (
    <div
      className={cn("relative w-full overflow-hidden border bg-border", shape, borderClass, height)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={ariaLabel}
    >
      <div
        className={cn(fillBase, shape, mounted && "transition-all duration-500")}
        style={{ width: `${pct}%` }}
      />

      {milestones?.length ? (
        <TooltipProvider delayDuration={150}>
          <div className="absolute inset-0 z-10">
            {milestones.map((m, i) => (
              <Tooltip key={`gold-${m.pct}-${i}`}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 cursor-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22><text x=%2212%22 y=%2218%22 text-anchor=%22middle%22 font-size=%2220%22>%F0%9F%8C%9F</text></svg>')_12_12,_pointer]"
                    style={{ left: `calc(${m.pct}% - 6px)` }}
                  >
                    <Star className="size-3 fill-gold text-gold sm:size-3.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px]">
                  <MilestoneTooltipContent milestone={m} t={t} />
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{ clipPath: `inset(0 ${clipRight}% 0 0)` }}
          >
            {milestones.map((m, i) => (
              <div
                key={`black-${m.pct}-${i}`}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `calc(${m.pct}% - 6px)` }}
              >
                <Star className="size-3 fill-black text-black sm:size-3.5" />
              </div>
            ))}
          </div>
        </TooltipProvider>
      ) : null}

      {showInlineLabel ? (
        <>
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center font-bold tabular-nums text-gold",
              textSize
            )}
          >
            {pct >= 100
              ? t("progressBar.soldOut")
              : t("progressBar.pctSold", { pct: Math.round(pct) })}
          </div>
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center font-bold tabular-nums text-black",
              textSize,
              mounted && "transition-all duration-500"
            )}
            style={{ clipPath: `inset(0 ${clipRight}% 0 0)` }}
          >
            {pct >= 100
              ? t("progressBar.soldOut")
              : t("progressBar.pctSold", { pct: Math.round(pct) })}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function CompetitionProgressBar({
  competition,
  bonusAwards,
  variant = "card",
  className,
  showLabel,
  countdownLabel,
  percentageBelow = false,
}: CompetitionProgressBarProps) {
  const { t: tRaw } = useTranslation();
  const t = tRaw as (key: string, params?: Record<string, string | number>) => string;
  const mounted = useMounted();
  const pct = Math.max(0, Math.min(100, computeProgress(competition)));
  const ticketsSold = competition.ticketsSold ?? 0;
  const maxTickets = competition.maxTickets ?? 0;
  const ticketsLeft = Math.max(0, maxTickets - ticketsSold);

  const milestones = bonusAwards?.length
    ? resolveMilestones(bonusAwards, ticketsSold, maxTickets)
    : undefined;

  const hasMilestones = !!milestones?.length;
  const ariaLabel = `${Math.round(pct)}% ${t("progressBar.pctSold", { pct: Math.round(pct) })}, ${ticketsSold.toLocaleString()} of ${maxTickets.toLocaleString()} tickets`;

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div
          className="relative h-1.5 flex-1 overflow-hidden rounded-full border border-gold/15 bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label={ariaLabel}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 h-full rounded-full bg-gradient-to-r from-gold-light to-gold",
              mounted && "transition-all duration-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-gold">
          {Math.round(pct)}%
        </span>
      </div>
    );
  }

  if (variant === "compact-meta") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-foreground">{t("progressBar.ticketsSold")}</span>
          <span className="font-semibold tabular-nums text-foreground">{Math.round(pct)}%</span>
        </div>
        <ProgressBarVisual
          pct={pct}
          height="h-2.5"
          textSize="text-[9px]"
          showInlineLabel={true}
          shape="rounded-full"
          borderClass="border-gold/15"
          ariaLabel={ariaLabel}
          t={t}
        />
      </div>
    );
  }

  const isDetail = variant === "detail";
  const isEntries = variant === "entries";

  const heightClass = isDetail || isEntries ? "h-8 sm:h-9 lg:h-10" : "h-7 @lg/card:h-8";
  const textSizeClass = isDetail || isEntries ? "text-sm lg:text-base" : "text-xs @lg/card:text-sm";

  const inlineLabel = percentageBelow
    ? false
    : isDetail && hasMilestones
      ? false
      : (showLabel ?? true);

  return (
    <div className={cn("space-y-2", className)}>
      {(isDetail || isEntries) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-bold text-foreground text-[15px]">
              {t("progressBar.ticketsSold")}
            </span>
            <span
              className={cn(
                "text-xs tabular-nums",
                isDetail ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {ticketsSold.toLocaleString()} / {maxTickets.toLocaleString()}
              {isDetail ? (
                <>
                  {" "}
                  (
                  {pct >= 100
                    ? t("progressBar.soldOut")
                    : t("progressBar.pctSold", { pct: Math.round(pct) })}
                  )
                </>
              ) : null}
            </span>
          </div>
          {countdownLabel ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              {countdownLabel}
            </span>
          ) : null}
        </div>
      )}

      <ProgressBarVisual
        pct={pct}
        height={heightClass}
        textSize={textSizeClass}
        showInlineLabel={inlineLabel}
        ariaLabel={ariaLabel}
        milestones={isDetail && hasMilestones ? milestones : undefined}
        t={t}
      />

      {percentageBelow && !isDetail ? (
        <div className="flex justify-center">
          <span className="text-lg font-bold tabular-nums text-gold">
            {pct >= 100
              ? t("progressBar.soldOut")
              : t("progressBar.pctSold", { pct: Math.round(pct) })}
          </span>
        </div>
      ) : null}

      {!isDetail && !isEntries && !percentageBelow ? (
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {ticketsLeft > 0
            ? t("progressBar.remaining", { count: ticketsLeft.toLocaleString() })
            : "\u00A0"}
        </p>
      ) : null}
    </div>
  );
}
