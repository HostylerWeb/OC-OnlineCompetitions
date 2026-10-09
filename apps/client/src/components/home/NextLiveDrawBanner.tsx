"use client";

import { Timer } from "@oc/icons";
import type { Competition } from "@oc/types";
import type { TimeLeft } from "@oc/utils";
import { cn, getCompetitionImageUrl } from "@oc/utils";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/components/Link";
import { useCountdown } from "@/components/ui";
import { findNextLiveDrawGroup } from "@/lib/next-live-draw";
import { useTranslation } from "@/lib/i18n";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function CountdownBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center gap-1 sm:min-w-[4rem]">
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-lg border border-gold/35",
          "bg-gradient-to-b from-white/[0.1] to-black/45 px-2 py-2 sm:py-2.5",
          "font-bold tabular-nums text-xl text-gold sm:text-2xl",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.25)]"
        )}
        suppressHydrationWarning
      >
        {value}
      </div>
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-[0.65rem]">
        {label}
      </span>
    </div>
  );
}

function CountdownRow({
  timeLeft,
  ariaLabel,
  labels,
}: {
  timeLeft: TimeLeft;
  ariaLabel: string;
  labels: { days: string; hrs: string; mins: string; secs: string };
}) {
  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={ariaLabel}
      className="flex items-start justify-center gap-1.5 sm:gap-2"
    >
      <CountdownBlock value={pad2(timeLeft.days)} label={labels.days} />
      <span className="pt-2 text-lg font-bold text-gold/45 sm:text-xl" aria-hidden>:</span>
      <CountdownBlock value={pad2(timeLeft.hours)} label={labels.hrs} />
      <span className="pt-2 text-lg font-bold text-gold/45 sm:text-xl" aria-hidden>:</span>
      <CountdownBlock value={pad2(timeLeft.minutes)} label={labels.mins} />
      <span className="pt-2 text-lg font-bold text-gold/45 sm:text-xl" aria-hidden>:</span>
      <CountdownBlock value={pad2(timeLeft.seconds)} label={labels.secs} />
    </div>
  );
}

const ROTATE_MS = 2000;

export function NextLiveDrawBanner({ competitions }: { competitions: Competition[] }) {
  const { t } = useTranslation();
  const [hydrated, setHydrated] = useState(false);
  const [rotateIndex, setRotateIndex] = useState(0);

  const drawGroup = useMemo(() => findNextLiveDrawGroup(competitions), [competitions]);
  const timeLeft = useCountdown(drawGroup?.targetIso, Boolean(drawGroup));

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    setRotateIndex(0);
  }, [drawGroup?.targetIso, drawGroup?.competitions.length]);

  useEffect(() => {
    const pool = drawGroup?.competitions ?? [];
    if (pool.length <= 1) return;
    const interval = setInterval(() => {
      setRotateIndex((prev) => (prev + 1) % pool.length);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [drawGroup]);

  if (!drawGroup) return null;

  const pool = drawGroup.competitions;
  const competition = pool[rotateIndex % pool.length] ?? pool[0];
  const multipleEndingTogether = pool.length > 1;
  const slug = competition.slug ?? competition._id ?? competition.id ?? "";
  const href = slug ? `/competitions/${slug}` : "/competitions";
  const imageUrl = getCompetitionImageUrl({
    prizeImageUrl: competition.prizeImageUrl,
    imageUrl: competition.imageUrl,
    updatedAt: competition.updatedAt,
  });

  const placeholder: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const hasLiveCountdown = hydrated && timeLeft != null;
  const displayTime = hasLiveCountdown ? timeLeft : placeholder;
  const ended =
    hydrated &&
    !timeLeft &&
    new Date(drawGroup.targetIso).getTime() <= Date.now();
  const urgent = hasLiveCountdown && timeLeft.days === 0;

  const timerSummary = `${displayTime.days}d ${displayTime.hours}h ${displayTime.minutes}m ${displayTime.seconds}s`;

  return (
    <section className="relative pb-2 pt-6 sm:pb-4 sm:pt-8" aria-labelledby="next-live-draw-heading">
      <div className="oc-container-wide relative z-10">
        <div
          className={cn(
            "relative overflow-hidden border-0 border-b p-5 sm:p-6 lg:p-8",
            urgent
              ? "border-b border-red-500/30 bg-gradient-to-br from-red-500/10 via-card to-gold/5"
              : "border-b border-gold/25 bg-gradient-to-br from-gold/10 via-card to-background"
          )}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              {imageUrl ? (
                <Link
                  key={`img-${slug}`}
                  href={href}
                  className="relative hidden h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-gold/25 sm:block sm:h-20 sm:w-20 animate-fade-in"
                  data-umami-event="home:next-draw-image"
                >
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                </Link>
              ) : (
                <div
                  className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/20 sm:flex sm:h-20 sm:w-20"
                >
                  <Timer className="h-8 w-8 text-gold/70" />
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      urgent
                        ? "animate-pulse bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                        : "bg-gold"
                    )}
                    aria-hidden
                  />
                  <h2
                    id="next-live-draw-heading"
                    className="text-sm font-bold uppercase tracking-[0.18em] text-gold sm:text-base"
                  >
                    {t("home.nextLiveDrawIn")}
                  </h2>
                </div>
                <Link
                  key={`title-${slug}`}
                  href={href}
                  className="block truncate text-lg font-bold text-foreground transition-colors hover:text-gold sm:text-xl animate-fade-in"
                  data-umami-event="home:next-draw-title"
                >
                  {competition.title}
                </Link>
                {ended ? (
                  <p className="mt-1 text-sm text-muted-foreground">{t("home.countdown.ended")}</p>
                ) : multipleEndingTogether ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("home.nextLiveDrawMultiple", { count: pool.length })}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">{t("home.nextLiveDrawHint")}</p>
                )}
              </div>
            </div>

            {!ended ? (
              <CountdownRow
                timeLeft={displayTime}
                ariaLabel={`${t("home.nextLiveDrawIn")}: ${timerSummary}`}
                labels={{
                  days: t("home.countdown.days"),
                  hrs: t("home.countdown.hrs"),
                  mins: t("home.countdown.mins"),
                  secs: t("home.countdown.secs"),
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
