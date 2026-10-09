"use client";

import { Clock } from "@oc/icons";
import { formatDateTime } from "@oc/utils";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

const COUNTDOWN_TICK_MS = 1000;

interface Segment {
  value: number;
  label: string;
}

const SEGMENT_CELL_CLASSES =
  "flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black/40 px-2 py-3 sm:px-4 sm:py-4";

const SEGMENT_VALUE_CLASSES = "text-2xl font-bold tabular-nums text-gold sm:text-3xl lg:text-4xl";

const SEGMENT_LABEL_CLASSES = "mt-1 text-xs text-muted-foreground";

const SEGMENT_GRID_CLASSES = "grid w-full grid-cols-4 gap-2 sm:gap-3";

export function CountdownTimer({
  targetDate,
  initialNow,
}: {
  targetDate: string;
  /** SSR snapshot — must match server render so hydration agrees with the first client paint. */
  initialNow?: number;
}) {
  const { t } = useTranslation();
  const target = new Date(targetDate).getTime();
  const [now, setNow] = useState(() => initialNow ?? Date.now());

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const drawDateLine = (
    <p className="text-sm text-muted-foreground">
      {t("competitions.detail.drawOn", { date: formatDateTime(targetDate) })}
    </p>
  );

  const header = (
    <div className="flex w-full items-center gap-2">
      <Clock className="size-5 text-gold" />
      <span className="font-medium text-foreground">{t("competitions.detail.drawCountdown")}</span>
    </div>
  );

  const diff = target - now;
  const segments: Segment[] =
    diff <= 0
      ? [
          { value: 0, label: t("competitions.detail.days") },
          { value: 0, label: t("competitions.detail.hours") },
          { value: 0, label: t("competitions.detail.minutes") },
          { value: 0, label: t("competitions.detail.seconds") },
        ]
      : [
          { value: Math.floor(diff / 86400000), label: t("competitions.detail.days") },
          { value: Math.floor((diff % 86400000) / 3600000), label: t("competitions.detail.hours") },
          { value: Math.floor((diff % 3600000) / 60000), label: t("competitions.detail.minutes") },
          { value: Math.floor((diff % 60000) / 1000), label: t("competitions.detail.seconds") },
        ];

  const firstChars = segments.map((s) => s.label[0]?.toLowerCase() ?? "");
  const summary = segments.map((s, i) => `${s.value}${firstChars[i]}`).join(" ");
  const ariaLabel =
    diff <= 0
      ? t("competitions.detail.drawEnded")
      : t("competitions.detail.timeUntilDraw", { summary });
  const drawLabel = `${t("competitions.detail.drawOn", { date: formatDateTime(targetDate) })}`;
  const timerLabel = diff <= 0 ? drawLabel : `${drawLabel} (${ariaLabel})`;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {header}
      <div role="timer" aria-label={timerLabel} className={SEGMENT_GRID_CLASSES}>
        {segments.map((segment) => (
          <div key={segment.label} className={SEGMENT_CELL_CLASSES}>
            <span className={SEGMENT_VALUE_CLASSES} suppressHydrationWarning>
              {String(segment.value).padStart(2, "0")}
            </span>
            <span className={SEGMENT_LABEL_CLASSES}>{segment.label}</span>
          </div>
        ))}
      </div>
      {drawDateLine}
    </div>
  );
}
