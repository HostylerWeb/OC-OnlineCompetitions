import { getEnv } from "@oc/env/next";

/** Client app URL for competition CTAs and server-side API calls to the main app. */
export function getClientAppUrl(): string {
  const env = process.env as Record<string, string | undefined>;
  const clientApp =
    env.NEXT_PUBLIC_CLIENT_APP_URL?.trim() || env.CLIENT_APP_URL?.trim() || "";
  if (clientApp) return clientApp.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3555";
  }
  const frontend = getEnv("FRONTEND_URL").trim();
  if (frontend) return frontend.replace(/\/+$/, "");
  return getEnv("APP_URL").replace(/\/+$/, "");
}

/** @deprecated Use getClientAppUrl — kept for existing imports */
export function getFrontendUrl(): string {
  return getClientAppUrl();
}

export function getCompetitionEntryUrl(slug: string): string {
  return `${getClientAppUrl()}/competitions/${slug}`;
}
