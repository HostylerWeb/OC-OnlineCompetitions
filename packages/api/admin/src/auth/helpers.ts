import { getEnv } from "@oc/env/next";

export function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return getEnv("APP_URL").trim() || "";
}

export function buildCallbackUrl(returnTo?: string, fallback = "/dashboard"): string {
  return returnTo ? returnTo : `${getOrigin()}${fallback}`;
}
