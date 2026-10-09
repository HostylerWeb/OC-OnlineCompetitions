import { getEnv } from "@oc/env/server";
import { secretsEqual } from "./secret-compare";

export const CRON_JOBS_SECRET_HEADER = "x-cron-jobs-secret";

export function getCronJobsSecretHeaderName(): string {
  return CRON_JOBS_SECRET_HEADER;
}

function getConfiguredCronJobsSecret(): string | null {
  const secret = getEnv("CRON_JOBS_SECRET")?.trim();
  return secret || null;
}

/** Cron/job triggers must use CRON_JOBS_SECRET (never the admin emergency UI secret). */
export function validateCronJobsSecret(headerValue: string | undefined): boolean {
  const secret = getConfiguredCronJobsSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return secretsEqual(headerValue, secret);
}
