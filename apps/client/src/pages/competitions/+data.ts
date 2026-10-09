import type { Category, Competition } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";
  const searchObj = pageContext.urlParsed?.search as Record<string, string> | undefined;
  const searchCat = searchObj?.category;
  const searchStatus = searchObj?.status;
  const qs =
    searchCat || searchStatus
      ? `?${new URLSearchParams({ ...(searchCat && { category: searchCat }), ...(searchStatus && { status: searchStatus }) }).toString()}`
      : "";

  const [competitions, categories] = await Promise.all([
    jsonFetch<Competition[]>(`/api/competitions${qs}`, cookie),
    jsonFetch<Category[]>("/api/competitions/categories", ""),
  ]);

  return {
    competitions: competitions ?? [],
    categories: categories ?? [],
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
