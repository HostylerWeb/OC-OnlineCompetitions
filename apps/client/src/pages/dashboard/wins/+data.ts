import type { MyBonusAwardWinDto, MyInstantPrizeWinDto, Winner } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const [winsPage1, instantWinsPage1, bonusWinsPage1] = await Promise.all([
    jsonFetch<Winner[]>("/api/me/profile/wins?page=1&limit=20", cookie),
    jsonFetch<MyInstantPrizeWinDto[]>("/api/me/instant-prize-wins?page=1&limit=20", cookie),
    jsonFetch<MyBonusAwardWinDto[]>("/api/me/bonus-award-wins?page=1&limit=20", cookie),
  ]);

  return {
    winsPage1: winsPage1 ?? [],
    instantWinsPage1: instantWinsPage1 ?? [],
    bonusWinsPage1: bonusWinsPage1 ?? [],
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
