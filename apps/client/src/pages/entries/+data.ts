import type { EntryCompetition } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const entryRes = await serverFetch<EntryCompetition[]>("/api/entries/competitions", {
    cookieHeader: cookie,
  });

  return entryRes ? { data: entryRes.data, meta: entryRes.meta } : null;
}

export type Data = Awaited<ReturnType<typeof data>>;
