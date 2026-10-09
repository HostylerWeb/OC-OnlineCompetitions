import type { Winner } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const [winners, winnerStats] = await Promise.all([
    jsonFetch<Winner[]>("/api/winners?limit=50", cookie),
    jsonFetch<{
      totalWinners: number;
      totalPrizeValue: number;
      totalWinnersAllTime: number;
    }>("/api/winners/stats", ""),
  ]);

  return {
    winners: winners ?? [],
    winnerStats: winnerStats ?? null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
