"use client";

import type { TimeLeft } from "@oc/utils";
import { cn } from "@oc/utils";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

interface CompetitionCardCountdownProps {
  timeLeft: TimeLeft | null;
  endDate?: string | null;
  className?: string;
}

const PLACEHOLDER: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-md border border-gold/30",
          "bg-gradient-to-b from-white/[0.08] to-black/50",
          "px-0.5 py-0.5 @sm/card:py-1 @lg/card:py-1.5",
          "font-bold tabular-nums leading-none text-gold",
          "text-[11px] @sm/card:text-sm @lg/card:text-lg",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.35)]"
        )}
        suppressHydrationWarning
      >
        {value}
      </div>
      <span className="text-[7px] @sm/card:text-[8px] @lg/card:text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/90">
        {label}
      </span>
    </div>
  );
}

function CountdownSeparator() {
  return (
    <span
      className="comp-card-countdown-sep pb-3 text-xs font-bold tabular-nums text-gold/50 @sm/card:text-sm @lg/card:text-base"
      aria-hidden="true"
    >
      :
    </span>
  );
}

function CountdownFace({
  timeLeft,
  headerKey,
  t,
  className,
  urgent,
}: {
  timeLeft: TimeLeft;
  headerKey: string;
  t: (key: string) => string;
  className?: string;
  urgent: boolean;
}) {
  const summary = `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`;

  return (
    <div
      className={cn(
        "rounded-lg border border-gold/15 bg-black/25 p-1.5 @sm/card:p-2 @lg/card:p-2.5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className
      )}
    >
      <div className="mb-1.5 flex items-center justify-center gap-1.5">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            urgent ? "animate-pulse bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" : "bg-gold/80"
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "text-[9px] @sm/card:text-[10px] font-bold uppercase tracking-[0.14em]",
            urgent ? "text-red-400/95" : "text-gold/90"
          )}
        >
          {t(headerKey)}
        </span>
      </div>

      <div
        role="timer"
        aria-label={`${t("home.endsIn")}: ${summary}`}
        aria-live="off"
        className="comp-card-countdown-row flex items-start justify-center gap-0.5 @sm/card:gap-1"
      >
        <CountdownUnit value={pad2(timeLeft.days)} label={t("home.countdown.days")} />
        <CountdownSeparator />
        <CountdownUnit value={pad2(timeLeft.hours)} label={t("home.countdown.hrs")} />
        <CountdownSeparator />
        <CountdownUnit value={pad2(timeLeft.minutes)} label={t("home.countdown.mins")} />
        <CountdownSeparator />
        <CountdownUnit value={pad2(timeLeft.seconds)} label={t("home.countdown.secs")} />
      </div>
    </div>
  );
}

export function CompetitionCardCountdown({
  timeLeft,
  endDate,
  className,
}: CompetitionCardCountdownProps) {
  const { t } = useTranslation();
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLive(true);
  }, []);

  if (!endDate) return null;

  if (!live) {
    return (
      <CountdownFace
        timeLeft={PLACEHOLDER}
        headerKey="home.countdown.endsIn"
        t={t}
        urgent={false}
        className={cn(className, "opacity-90")}
      />
    );
  }

  if (!timeLeft) {
    return (
      <p className={cn("text-center text-xs font-semibold text-muted-foreground", className)}>
        {t("home.countdown.ended")}
      </p>
    );
  }

  const urgent = timeLeft.days === 0;
  const headerKey = urgent
    ? timeLeft.hours < 6
      ? "home.countdown.endingSoon"
      : "home.countdown.endingToday"
    : "home.countdown.endsIn";

  return (
    <CountdownFace
      timeLeft={timeLeft}
      headerKey={headerKey}
      t={t}
      urgent={urgent}
      className={className}
    />
  );
}
