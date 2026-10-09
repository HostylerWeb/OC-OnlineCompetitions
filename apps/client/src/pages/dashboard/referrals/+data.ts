import type { MyReferralsResponse } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const [referrals, settings, tickets] = await Promise.all([
    jsonFetch<MyReferralsResponse>("/api/me/referrals", cookie),
    jsonFetch<Record<string, unknown>>("/api/referral-settings", cookie),
    jsonFetch<unknown>("/api/me/tickets", cookie),
  ]);

  return {
    referrals: referrals ?? null,
    settings: settings ?? null,
    tickets: tickets ?? null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
