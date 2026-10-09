import type { Category, Competition } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const [featured, categories] = await Promise.all([
    jsonFetch<Competition[]>("/api/competitions/featured", cookie),
    jsonFetch<Category[]>("/api/competitions/categories", cookie),
  ]);

  return {
    featuredCompetitions: featured ?? [],
    categories: categories ?? [],
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
