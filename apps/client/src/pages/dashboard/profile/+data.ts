import type { Profile, PublicComplianceSettings } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const [profile, compliance] = await Promise.all([
    jsonFetch<Profile>("/api/me/profile", cookie),
    jsonFetch<PublicComplianceSettings>("/api/compliance-settings", cookie),
  ]);

  return {
    profile: profile ?? ({} as Profile),
    compliance: compliance ?? null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
