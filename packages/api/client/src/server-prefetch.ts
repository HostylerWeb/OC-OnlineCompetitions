import type { ApiResponse, Competition, Profile } from "@oc/types";
import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "./keys";
import { serverFetch } from "./server-fetch";

/**
 * Server-side prefetch helpers for the composed hooks that bundle multiple
 * queries. These mirror the client-side `useHomepageSections` and
 * `useDashboardData` hooks so the same data is in the cache for both the
 * server render and the client hydration.
 *
 * Marked `import "server-only"` — never import from a client component.
 */

export interface PrefetchSectionsInput {
  queryClient: QueryClient;
  cookieHeader: string;
  /** Forwarded to `useCompetitions({ limit })` — defaults to 24 to match the client. */
  competitionsLimit?: number;
  /** Optional `ending-soon` filter. Defaults to enabled. */
  endingSoonEnabled?: boolean;
}

/**
 * Prefetch all homepage queries that `useHomepageSections`, `HeroSection`,
 * and `WinnersSection` compose:
 *   1. Homepage layout settings
 *   2. Competition categories
 *   3. Competitions (paginated, default limit 24)
 *   4. Ending-soon competitions (limit 100)
 *   5. Featured competitions
 *   6. Recent winners (limit 5)
 *
 * All six run in parallel and populate the per-request QueryClient. The
 * dehydrated cache is then passed to client components via HydrationBoundary
 * so they render immediately with the prefetched data.
 *
 * Each fetch uses `cache: "public"` with explicit `next.tags` and `revalidate`
 * so the response is shareable at the Next.js Data Cache layer.
 */
export async function prefetchHomepageSections(input: PrefetchSectionsInput): Promise<void> {
  const { queryClient, competitionsLimit = 24, endingSoonEnabled = true } = input;
  // The cookie is forwarded for session-aware reads on the dashboard. For
  // the homepage sections, all fetches are public reads — we deliberately
  // pass an empty cookieHeader to serverFetch so the request is shareable
  // at the Next.js Data Cache layer. The Hono Redis layer handles
  // cross-deploy caching.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.public.homepageLayoutSettings(),
      queryFn: () =>
        serverFetch<unknown>("/api/homepage-layout-settings", {
          cookieHeader: "",
          cache: "public",
        }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.competitionCategories(),
      queryFn: () =>
        serverFetch<unknown>("/api/competitions/categories", {
          cookieHeader: "",
          cache: "public",
        }),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.competitions.all({ limit: competitionsLimit, enabled: true }),
      queryFn: () =>
        serverFetch<Competition[]>(`/api/competitions?limit=${competitionsLimit}`, {
          cookieHeader: "",
          cache: "public",
        }),
    }),
    // Match the client's useEndingSoonCompetitions key exactly: it calls
    // useCompetitions({ limit: 100, enabled }) and filters client-side
    // via filterEndingSoonCompetitions. Prefetching with the same key
    // hydrates the client cache on mount.
    queryClient.prefetchQuery({
      queryKey: queryKeys.competitions.all({ limit: 100, enabled: endingSoonEnabled }),
      queryFn: () =>
        serverFetch<Competition[]>("/api/competitions?limit=100", {
          cookieHeader: "",
          cache: "public",
        }),
    }),
    // Featured competitions — consumed by HeroSection via useFeaturedCompetitions
    queryClient.prefetchQuery({
      queryKey: queryKeys.competitions.featured(),
      queryFn: () =>
        serverFetch<Competition[]>("/api/competitions/featured", {
          cookieHeader: "",
          cache: "public",
        }),
    }),
    // Recent winners — homepage shows up to 6
    queryClient.prefetchQuery({
      queryKey: queryKeys.winners.recent(6),
      queryFn: () =>
        serverFetch<unknown>("/api/winners?limit=6", {
          cookieHeader: "",
          cache: "public",
        }),
    }),
  ]);
}

/**
 * Prefetch `useDashboardData` — the 6 parallel calls (stats, entries,
 * orders, competitions, profile, referrals) are wrapped into one key by
 * the client hook, so we just prefetch that key. This warms the cache and
 * the hook on the client will return data immediately.
 */
export async function prefetchDashboardData(input: {
  queryClient: QueryClient;
  cookieHeader: string;
}): Promise<void> {
  const { queryClient, cookieHeader } = input;
  await queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.all(),
    queryFn: async (): Promise<ApiResponse<unknown>> => {
      const [stats, entries, orders, competitions, profile, referrals] = await Promise.all([
        serverFetch<unknown>("/api/me/profile/stats", { cookieHeader }),
        serverFetch<unknown>("/api/me/entries?page=1&limit=100", { cookieHeader }),
        serverFetch<unknown>("/api/me/orders?page=1&limit=10", { cookieHeader }),
        serverFetch<unknown>("/api/competitions?status=active", { cookieHeader }),
        serverFetch<Profile>("/api/me/profile", { cookieHeader }),
        serverFetch<unknown>("/api/me/referrals", { cookieHeader }),
      ]);

      const payload = {
        stats: stats?.data,
        entries: entries?.data ?? [],
        orders: orders?.data ?? [],
        activeCompetitions: competitions?.data ?? [],
        profile: profile?.data,
        referrals: referrals?.data,
      };

      return { data: payload } as ApiResponse<unknown>;
    },
  });
}
