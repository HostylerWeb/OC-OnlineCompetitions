import type { PublicComplianceSettings, SaferPlayState } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";
  const [saferPlay, compliance] = await Promise.all([
    jsonFetch<SaferPlayState>("/api/me/safer-play", cookie),
    jsonFetch<PublicComplianceSettings>("/api/compliance-settings", cookie),
  ]);

  return {
    saferPlay: saferPlay ?? null,
    compliance: compliance ?? null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
