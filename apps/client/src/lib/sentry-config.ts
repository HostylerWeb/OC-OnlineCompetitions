import { getEnv } from "@oc/env/vike";

export function resolveSentryRelease(): string | undefined {
  const release = getEnv("SENTRY_RELEASE").trim();
  return release || undefined;
}

export function resolveSentryEnvironment(): string {
  return getEnv("SENTRY_ENVIRONMENT") || import.meta.env.MODE || "development";
}
