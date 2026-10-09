import type {
  ApiResponse,
  Competition,
  EntryCompetition,
  PublicBonusAwardEntry,
  PublicBonusAwardWinDTO,
  RawCompetitionResponse,
} from "@oc/types";
import {
  keepPreviousData,
  type QueryClient,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getSessionSnapshot } from "../../auth/session-snapshot";
import { api } from "../../client";
import { STALE_TIME_PUBLIC, STALE_TIME_STATIC } from "../../constants";
import { queryKeys } from "../../keys";
import { getOffsetNextPageParam } from "../../lib/pagination";
import type { CompetitionInstantPrizePublicDTO } from "../../types";
import { buildSearchParams } from "../../utils";

export type CompetitionAvailability = {
  available: number;
  maxPerUser: number;
  userOwned?: number;
  inCart?: number;
  remainingForUser?: number;
  maxPurchasable?: number;
};

export type CompetitionBuyingPower = {
  competitionId: string;
  available: number;
  maxPerUser: number;
  userOwned: number;
  inCart: number;
  remainingForUser: number;
  maxPurchasable: number;
  walletSpendable: number;
  isActive: boolean;
};

type CompetitionAvailabilityApiItem = CompetitionAvailability & {
  total?: number;
  sold?: number;
  held?: number;
  taken?: number;
  percentageSold?: number;
  percentageTaken?: number;
  isActive?: boolean;
};

function normalizeAvailability(item?: CompetitionAvailabilityApiItem): CompetitionAvailability {
  if (!item) return { available: 0, maxPerUser: 0 };
  return {
    available: item.available,
    maxPerUser: item.maxPerUser,
    userOwned: item.userOwned,
    inCart: item.inCart,
    remainingForUser: item.remainingForUser,
    maxPurchasable: item.maxPurchasable,
  };
}

async function fetchAvailabilityBatchFromApi(
  competitionIds: string[]
): Promise<Record<string, CompetitionAvailability>> {
  const uniqueIds = [...new Set(competitionIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const res = await api.get<Record<string, CompetitionAvailabilityApiItem>>(
    "/api/competitions/availability",
    { params: { ids: uniqueIds.join(",") } }
  );

  const availability: Record<string, CompetitionAvailability> = {};
  for (const id of uniqueIds) {
    availability[id] = normalizeAvailability(res.data[id]);
  }
  return availability;
}

function seedAvailabilityQueryCache(
  queryClient: QueryClient,
  availability: Record<string, CompetitionAvailability>
) {
  for (const [id, avail] of Object.entries(availability)) {
    queryClient.setQueryData(queryKeys.competitions.availability(id), { data: avail });
  }
}

export async function fetchCompetitionAvailability(competitionId: string) {
  return api.get<CompetitionAvailability>(`/api/competitions/${competitionId}/availability`);
}

export async function fetchCompetitionsAvailabilityBatch(
  queryClient: QueryClient,
  competitionIds: string[]
): Promise<Record<string, CompetitionAvailability>> {
  const availability = await fetchAvailabilityBatchFromApi(competitionIds);
  seedAvailabilityQueryCache(queryClient, availability);
  return availability;
}

async function fetchBuyingPowerBatchFromApi(
  competitionIds: string[]
): Promise<Record<string, CompetitionBuyingPower>> {
  const uniqueIds = [...new Set(competitionIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const res = await api.get<Record<string, CompetitionBuyingPower>>(
    "/api/competitions/buying-power-batch",
    { params: { ids: uniqueIds.join(",") } }
  );
  return res.data;
}

export function useCompetitionsBuyingPower(
  competitionIds: string[],
  options?: { initialData?: Record<string, CompetitionBuyingPower> }
) {
  const userId = getSessionSnapshot().user?.id ?? null;
  const uniqueIds = [...new Set(competitionIds.filter(Boolean))];
  const idsKey = uniqueIds.slice().sort().join(",");

  return useQuery({
    queryKey: [...queryKeys.competitions.buyingPowerBatch(idsKey), userId ?? "anon"],
    queryFn: () => fetchBuyingPowerBatchFromApi(uniqueIds),
    staleTime: 10_000,
    refetchInterval: 10_000,
    enabled: uniqueIds.length > 0,
    initialData: options?.initialData,
  });
}

export function useCompetitionsAvailability(competitionIds: string[]) {
  const uniqueIds = [...new Set(competitionIds.filter(Boolean))];
  const idsKey = uniqueIds.slice().sort().join(",");

  const query = useQuery({
    queryKey: queryKeys.competitions.availabilityBatch(idsKey),
    queryFn: () => fetchAvailabilityBatchFromApi(uniqueIds),
    staleTime: 10_000,
    refetchInterval: 10_000,
    enabled: uniqueIds.length > 0,
  });

  const availability: Record<string, number> = {};
  const availabilityByCompetition: Record<string, CompetitionAvailability> = {};
  for (const id of uniqueIds) {
    const avail = query.data?.[id];
    if (avail?.available !== undefined) {
      availability[id] = avail.available;
      availabilityByCompetition[id] = avail;
    }
  }

  return {
    availability,
    availabilityByCompetition,
    isFetching: query.isFetching,
    results: query,
  };
}

export function useCompetitions(
  params?: {
    status?: string;
    category?: string;
    limit?: number;
    page?: number;
    exclude?: string;
    enabled?: boolean;
  },
  options?: { initialData?: ApiResponse<Competition[]> }
) {
  const { enabled = true, ...queryParams } = params ?? {};
  return useQuery<ApiResponse<Competition[]>>({
    queryKey: queryKeys.competitions.all(queryParams),
    queryFn: () => api.get<Competition[]>(`/api/competitions${buildSearchParams(queryParams)}`),
    initialData: options?.initialData,
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_STATIC,
    refetchOnMount: false,
    enabled,
  });
}

export function useFeaturedCompetitions(options?: { initialData?: ApiResponse<Competition[]> }) {
  return useQuery<ApiResponse<Competition[]>>({
    queryKey: queryKeys.competitions.featured(),
    queryFn: () => api.get<Competition[]>("/api/competitions/featured"),
    initialData: options?.initialData,
    staleTime: STALE_TIME_STATIC,
    refetchOnMount: false,
  });
}

export function useCompetitionDetail(
  slug: string,
  options?: { initialData?: ApiResponse<RawCompetitionResponse> }
) {
  return useQuery<ApiResponse<RawCompetitionResponse>>({
    queryKey: queryKeys.competitions.detail(slug),
    queryFn: () => api.get<RawCompetitionResponse>(`/api/competitions/${slug}`),
    initialData: options?.initialData,
    staleTime: STALE_TIME_STATIC,
    refetchOnMount: false,
    enabled: !!slug,
  });
}

export function useAvailability(
  competitionId: string,
  options?: { initialData?: ApiResponse<CompetitionAvailability> }
) {
  const userId = getSessionSnapshot().user?.id ?? null;
  return useQuery<ApiResponse<CompetitionAvailability>>({
    queryKey: [...queryKeys.competitions.availability(competitionId), userId ?? "anon"],
    queryFn: () =>
      api.get<CompetitionAvailability>(`/api/competitions/${competitionId}/availability`),
    initialData: options?.initialData,
    staleTime: 10_000,
    refetchInterval: 10_000,
    enabled: !!competitionId,
  });
}

export function useBuyingPower(competitionId: string) {
  const userId = getSessionSnapshot().user?.id ?? null;
  const query = useQuery<ApiResponse<CompetitionBuyingPower>>({
    queryKey: [...queryKeys.competitions.buyingPower(competitionId), userId ?? "anon"],
    queryFn: () =>
      api.get<CompetitionBuyingPower>(`/api/competitions/${competitionId}/buying-power`),
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    enabled: !!competitionId,
  });
  return { ...query, isLoading: query.isLoading };
}

export function useEntryCompetitions(options?: { initialData?: ApiResponse<EntryCompetition[]> }) {
  return useQuery<ApiResponse<EntryCompetition[]>>({
    queryKey: queryKeys.entries.competitions(),
    queryFn: () => api.get<EntryCompetition[]>("/api/entries/competitions"),
    initialData: options?.initialData,
    staleTime: 10_000,
  });
}

export function useCompetitionInstantPrizes(
  competitionId: string,
  options?: { initialData?: ApiResponse<CompetitionInstantPrizePublicDTO[]> }
) {
  return useQuery<ApiResponse<CompetitionInstantPrizePublicDTO[]>>({
    queryKey: queryKeys.competitions.instantPrizes(competitionId),
    queryFn: () =>
      api.get<CompetitionInstantPrizePublicDTO[]>(
        `/api/competitions/${competitionId}/instant-prizes`
      ),
    initialData: options?.initialData,
    staleTime: STALE_TIME_PUBLIC,
    enabled: !!competitionId,
  });
}

export function useInfiniteCompetitionInstantPrizes(competitionId: string, limit = 50) {
  return useInfiniteQuery<ApiResponse<CompetitionInstantPrizePublicDTO[]>>({
    queryKey: queryKeys.competitions.instantPrizes(competitionId, "infinite"),
    queryFn: ({ pageParam = 1 }) =>
      api.get<CompetitionInstantPrizePublicDTO[]>(
        `/api/competitions/${competitionId}/instant-prizes`,
        { params: { page: pageParam as number, limit } }
      ),
    initialPageParam: 1,
    getNextPageParam: getOffsetNextPageParam,
    enabled: !!competitionId,
  });
}

export function useCompetitionBonusAwards<T = PublicBonusAwardEntry[]>(
  competitionId: string,
  opts?: { initialData?: T }
) {
  return useQuery<ApiResponse<T>>({
    queryKey: ["competitions", competitionId, "bonus-awards"],
    queryFn: () => api.get(`/api/competitions/${competitionId}/bonus-awards`),
    staleTime: 10_000,
    initialData: opts?.initialData as any,
  });
}

export function useCompetitionBonusAwardWins<T = PublicBonusAwardWinDTO[]>(
  competitionId: string,
  opts?: { initialData?: T }
) {
  return useQuery<ApiResponse<T>>({
    queryKey: ["competitions", competitionId, "bonus-awards", "wins"],
    queryFn: () => api.get(`/api/competitions/${competitionId}/bonus-awards/wins`),
    staleTime: 10_000,
    initialData: opts?.initialData as any,
  });
}

export function useCompetitionStream(competitionIds: string[]): void {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const invalidatingRef = useRef(false);
  const idSet = useRef(new Set<string>());
  const idsKey = competitionIds.join(",");

  idSet.current = new Set(competitionIds);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (competitionIds.length === 0) return;

    mountedRef.current = true;
    let reconnectDelay = 1_000;

    function connect() {
      if (!mountedRef.current) return;
      esRef.current?.close();

      const es = new EventSource("/api/competitions/stream", { withCredentials: true });
      esRef.current = es;

      es.addEventListener("competition-update", (e: Event) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as {
            competitionId: string;
            slug: string;
            ticketsSold: number;
            ticketsHeld: number;
            maxTickets: number;
            available: number;
          };

          if (!idSet.current.has(data.competitionId)) return;
          if (invalidatingRef.current) return;
          invalidatingRef.current = true;
          queueMicrotask(() => {
            invalidatingRef.current = false;
          });

          queryClient.invalidateQueries({ queryKey: ["competitions", data.slug] });

          queryClient.invalidateQueries({
            queryKey: ["competitions", data.competitionId, "availability"],
          });

          queryClient.invalidateQueries({ queryKey: ["competitions", "availability-batch"] });

          queryClient.invalidateQueries({
            queryKey: ["competitions"],
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && key[0] === "competitions" && typeof key[1] === "object";
            },
          });

          queryClient.invalidateQueries({
            queryKey: ["competitions", data.competitionId, "bonus-awards"],
          });
          queryClient.invalidateQueries({
            queryKey: ["competitions", data.competitionId, "bonus-awards", "wins"],
          });

          queryClient.invalidateQueries({
            queryKey: ["entries"],
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && key[0] === "entries";
            },
          });
        } catch {
          // ignore parse errors
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
        if (mountedRef.current) {
          retryRef.current = setTimeout(connect, reconnectDelay);
        }
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
}
