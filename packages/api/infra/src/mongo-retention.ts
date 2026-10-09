import { getEnv } from "@oc/env/server";

const DAY_SECONDS = 24 * 60 * 60;

function parseDaysEnv(key:
  | "MONGODB_ORDER_COMPLETED_TTL_DAYS"
  | "MONGODB_ORDER_FAILED_TTL_DAYS"
  | "MONGODB_ORDER_PENDING_TTL_DAYS", defaultDays: number): number {
  const raw = getEnv(key);
  if (raw === undefined || raw === "") return defaultDays;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return defaultDays;
  return n;
}

/** 0 disables the TTL index (documents kept until manually removed). */
export function orderCompletedTtlSeconds(): number {
  const days = parseDaysEnv("MONGODB_ORDER_COMPLETED_TTL_DAYS", 2555);
  if (days <= 0) return 0;
  return days * DAY_SECONDS;
}

export function orderFailedTtlSeconds(): number {
  const days = parseDaysEnv("MONGODB_ORDER_FAILED_TTL_DAYS", 180);
  if (days <= 0) return 0;
  return days * DAY_SECONDS;
}

export function orderPendingTtlSeconds(): number {
  const days = parseDaysEnv("MONGODB_ORDER_PENDING_TTL_DAYS", 7);
  if (days <= 0) return 0;
  return days * DAY_SECONDS;
}

export function shouldSyncIndexesOnStartup(): boolean {
  const raw = getEnv("MONGODB_SYNC_INDEXES_ON_STARTUP");
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1";
}

export function mongoSlowQueryThresholdMs(): number {
  const raw = getEnv("MONGODB_LOG_SLOW_QUERIES_MS");
  if (raw === undefined || raw === "") return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

export function mongoSecondaryReadsEnabled(): boolean {
  const raw = getEnv("MONGODB_READ_SECONDARY");
  return raw === "true" || raw === "1";
}
