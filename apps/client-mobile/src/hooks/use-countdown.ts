"use client";

import { formatTimeLeft } from "@oc/utils";
import { useEffect, useState } from "react";

const COUNTDOWN_TICK_MS = 1000;

export function useCountdown(
  endDate: string | Date | null | undefined,
  enabled: boolean
): ReturnType<typeof formatTimeLeft> | null {
  const target = endDate instanceof Date ? endDate.toISOString() : endDate;
  const initial = enabled && target ? formatTimeLeft(target) : null;
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof formatTimeLeft> | null>(initial);

  useEffect(() => {
    if (!enabled || !endDate) {
      setTimeLeft(null);
      return;
    }
    const update = () => setTimeLeft(formatTimeLeft(target));
    update();
    const interval = setInterval(update, COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [enabled, endDate]);

  return timeLeft;
}
