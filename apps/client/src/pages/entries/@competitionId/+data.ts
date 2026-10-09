import type { PublicEntry } from "@oc/api-client";
import type { EntryCompetition } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";
  const competitionId = pageContext.routeParams.competitionId;

  if (!competitionId) {
    return { competition: null, entriesPage: null, meta: null };
  }

  const [compRes, entriesRes] = await Promise.all([
    serverFetch<EntryCompetition[]>("/api/entries/competitions", { cookieHeader: cookie }),
    serverFetch<PublicEntry[]>(
      `/api/entries?competitionId=${competitionId}&limit=50&sortDirection=1&cursor`,
      { cookieHeader: cookie }
    ),
  ]);

  const competition =
    compRes?.data?.find((c: any) => c._id === competitionId || c.id === competitionId) ?? null;

  return {
    competition,
    entriesPage: entriesRes ?? null,
    meta: entriesRes?.meta ?? null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
