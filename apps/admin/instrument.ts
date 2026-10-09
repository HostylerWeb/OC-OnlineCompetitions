import { getEnv } from "@oc/env/next";

const dsn = (getEnv("SENTRY_DSN") || "").trim();

export const isSentryEnabled = (): boolean => Boolean(dsn);

export function captureSentryTestError(): void {
  if (!dsn) return;
  // Dynamic import avoids bundling Sentry when DSN is not set
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require("@sentry/react");
  Sentry.captureException(new Error("Sentry test error (admin)"));
}
