import type { Entry, MyEntriesStats } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const [entriesStats, entriesPage1] = await Promise.all([
    jsonFetch<MyEntriesStats>("/api/me/entries/stats", cookie),
    jsonFetch<Entry[]>("/api/me/entries?page=1&limit=100", cookie),
  ]);

  return {
    entriesStats: entriesStats ?? null,
    entriesPage1: entriesPage1 ?? [],
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
