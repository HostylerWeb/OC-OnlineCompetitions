import dotenv from "dotenv";
import type { EnvKey } from "./types";

dotenv.config();

const DEFAULTS: Partial<Record<EnvKey, string>> = {
  APP_URL: "http://localhost:3000",
  ADMIN_URL: "http://localhost:3222",
  FRONTEND_URL: "http://localhost:3111",
  SHOP_URL: "http://localhost:3444",
  LOGIN_URL: "/auth/login",
  SENTRY_ENVIRONMENT: "development",
  REDIS_URL: "redis://localhost:6379",
  REDIS_NAMESPACE: "onlinecompetitions",
  REDIS_TTL_DEFAULT: "60",
  REDIS_ENABLED: "true",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  S3_ENDPOINT: "http://localhost:9000",
  S3_BUCKET: "onlinecompetitions-assets",
  AWS_REGION: "us-east-1",
  S3_FORCE_PATH_STYLE: "true",
  PAYTRIOT_ENVIRONMENT: "sandbox",
  PAYTRIOT_CURRENCY: "GBP",
  STRIPE_ENVIRONMENT: "test",
  STRIPE_CURRENCY: "GBP",
  STRIPE_HTTP_TIMEOUT_MS: "15000",
  STRIPE_HTTP_RETRIES: "2",
  LOCAL_CURRENCY: "EUR",
  LOCAL_PAYMENT_ENVIRONMENT: "sandbox",
  S3_OBJECT_ACL: "private",
  CACHING_ENABLED: "false",
  INTERNAL_JOB_LOCK_TTL_MS: "30000",
  TICKETING_ANOMALY_CLAIMED_COUNT_SAMPLE_LIMIT: "100",
  TICKETING_ANOMALY_STUCK_ORDER_SAMPLE_LIMIT: "100",
  TICKETING_ANOMALY_SOLD_MISMATCH_SAMPLE_LIMIT: "100",
  TICKETING_ANOMALY_STUCK_PROCESSING_THRESHOLD_MS: "300000",
};

function _raw(key: EnvKey): string | undefined {
  if (key === "BETTER_AUTH_URL") {
    return (
      process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      process.env.PUBLIC_ENV__APP_URL
    );
  }
  if (key === "APP_URL") {
    return (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.PUBLIC_ENV__APP_URL
    );
  }
  const prefixed = `PUBLIC_ENV__${key}`;
  return process.env[prefixed] || process.env[key];
}

export function getEnv<T extends string = string>(key: EnvKey, fallback?: T): T {
  const val = (_raw(key) || fallback) ?? DEFAULTS[key] ?? "";
  return val as T;
}

export function getBool(key: EnvKey, fallback = false): boolean {
  const val = _raw(key);
  if (!val) return fallback;
  return val === "true" || val === "1";
}

export function getNum(key: EnvKey, fallback?: number): number {
  const val = _raw(key);
  if (!val && fallback !== undefined) return fallback;
  const parsed = parseInt(val ?? "", 10);
  return Number.isNaN(parsed) ? (fallback ?? 0) : parsed;
}

export function validateEnv(): string[] {
  const required: EnvKey[] = ["DATABASE_URL", "BETTER_AUTH_SECRET"];
  const missing = required.filter((k) => !_raw(k));
  if (missing.length > 0) {
    console.error(`[env] Missing required vars: ${missing.join(", ")}`);
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env vars: ${missing.join(", ")}`);
    }
  }
  return missing;
}

export type { EnvKey } from "./types";
export * from "./csp.ts";
