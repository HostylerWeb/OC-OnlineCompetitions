import type { MeOrderDto } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";
  const ordersPage1 = await jsonFetch<MeOrderDto[]>("/api/me/orders?page=1&limit=20", cookie);

  return {
    ordersPage1: ordersPage1 ?? [],
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
