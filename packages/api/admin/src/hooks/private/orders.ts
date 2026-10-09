"use client";
import type {
  ApiResponse,
  Entry,
  MeOrderDetailDto,
  MeOrderDto,
  MyEntriesStats,
} from "@oc/types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";

export function useMyOrders(page = 1) {
  return useQuery<ApiResponse<MeOrderDto[]>>({
    queryKey: queryKeys.my.orders(page),
    queryFn: async () => {
      const res = await api.get<MeOrderDto[]>(`/api/me/orders`, { params: { page, limit: 10 } });
      return res;
    },
    staleTime: STALE_TIME_USER,
  });
}

export function useMyOrderDetail(
  orderId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  const enabled = (options?.enabled ?? true) && !!orderId;
  return useQuery<ApiResponse<MeOrderDetailDto>>({
    queryKey: [...queryKeys.my.ordersBase(), "detail", orderId] as const,
    queryFn: async () => {
      const res = await api.get<MeOrderDetailDto>(`/api/me/orders/${orderId}`);
      return res;
    },
    enabled,
    retry: 2,
    staleTime: STALE_TIME_USER,
  });
}

export function useMyEntriesStats(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useQuery<ApiResponse<MyEntriesStats>>({
    queryKey: queryKeys.my.entriesStats(),
    queryFn: () => api.get<MyEntriesStats>("/api/me/entries/stats"),
    enabled,
    staleTime: STALE_TIME_USER,
  });
}

export function useMyEntries(
  page = 1,
  limit = 100,
  options?: { initialData?: ApiResponse<Entry[]> }
) {
  return useQuery<ApiResponse<Entry[]>>({
    queryKey: queryKeys.my.entries(page, limit),
    queryFn: () => api.get<Entry[]>("/api/me/entries", { params: { page, limit } }),
    initialData: options?.initialData,
    staleTime: STALE_TIME_USER,
  });
}

export function useInfiniteMyEntries(limit = 100) {
  return useInfiniteQuery<ApiResponse<Entry[]>>({
    queryKey: queryKeys.my.entriesInfinite(limit),
    queryFn: ({ pageParam = 1 }) =>
      api.get<Entry[]>("/api/me/entries", { params: { page: pageParam as number, limit } }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore ? (lastPage.meta.page ?? 0) + 1 : undefined,
    staleTime: STALE_TIME_USER,
  });
}

function getEntryCompetitionId(entry: Entry): string | null {
  const { competitionId } = entry;
  if (!competitionId) return null;
  return typeof competitionId === "string" ? competitionId : (competitionId._id ?? null);
}

/** Sold ticket counts per competition for the signed-in user (fetches only page 1). */
export function useMyTicketCountsByCompetition(_options?: { enabled?: boolean }) {
  const query = useMyEntries(1, 200);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of query.data?.data ?? []) {
      const compId = getEntryCompetitionId(entry);
      if (!compId) continue;
      map[compId] = (map[compId] ?? 0) + (entry.quantity ?? 1);
    }
    return map;
  }, [query.data]);

  return {
    counts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}

export type PendingOrderResult = {
  orderId: string;
  mongoId: string;
  status: string;
  createdAt: string;
  items: Array<{
    _id: string;
    competitionId: string;
    competitionTitle?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    ticketNumbers?: number[];
    answerIndex?: number;
  }>;
  subtotal: number;
  total: number;
  discountAmount: number;
};

export function useGetPendingOrder() {
  return useQuery<ApiResponse<PendingOrderResult | null>>({
    queryKey: queryKeys.my.pendingOrder(),
    queryFn: () => api.get<PendingOrderResult | null>(`/api/orders/pending`),
    staleTime: 30_000,
    retry: false,
  });
}

export function useConvertToCardOrder() {
  const qc = useQueryClient();
  return useMutation<ApiResponse<{ orderId: string }>, Error, { orderId: string }>({
    mutationFn: ({ orderId }) =>
      api.post<{ orderId: string }>(`/api/orders/${orderId}/convert-to-card`, {}),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.my.pendingOrder() });
    },
  });
}
