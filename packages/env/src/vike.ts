import type { EnvKey } from "./types";

const DEFAULTS: Partial<Record<EnvKey, string>> = {
  APP_URL: "https://staging.onlinecompetitions.co.uk",
  ADMIN_URL: "https://admin.staging.onlinecompetitions.co.uk",
  SENTRY_ENVIRONMENT: "development",
};

export function getEnv<T extends string = string>(key: EnvKey, fallback?: T): T {
  const viteKey = `VITE_${key}`;
  const publicKey = `PUBLIC_ENV__${key}`;
  const env = import.meta.env as Record<string, string | undefined>;
  const val = (env[viteKey] || env[publicKey] || fallback) ?? DEFAULTS[key] ?? "";
  return val as T;
}

export function getBool(key: EnvKey, fallback = false): boolean {
  const viteKey = `VITE_${key}`;
  const publicKey = `PUBLIC_ENV__${key}`;
  const env = import.meta.env as Record<string, string | undefined>;
  const val1 = env[viteKey];
  const val2 = env[publicKey];
  if (val1 === "true" || val1 === "1") return true;
  if (val2 === "true" || val2 === "1") return true;
  return fallback;
}

export function getNum(key: EnvKey, fallback?: number): number {
  const val = getEnv(key);
  if (!val && fallback !== undefined) return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? (fallback ?? 0) : parsed;
}

export type { EnvKey } from "./types";
