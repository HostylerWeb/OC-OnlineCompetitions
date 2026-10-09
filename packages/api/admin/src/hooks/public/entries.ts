import type { ApiResponse } from "@oc/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_PUBLIC } from "../../constants";
import { queryKeys } from "../../keys";

export interface PublicEntry {
  id: string;
  ticketNumber: number;
  firstName: string;
  displayName: string;
  city: string | null;
  orderNumber: number | null;
  createdAt: string;
}

export function useInfiniteEntries(
  competitionId: string,
  options?: { limit?: number; search?: string }
) {
  const limit = options?.limit ?? 50;
  const search = options?.search?.trim() || undefined;

  return useInfiniteQuery<ApiResponse<PublicEntry[]>>({
    queryKey: queryKeys.entries.infinite(competitionId, limit, search),
    queryFn: ({ pageParam }) => {
      const params: Record<string, string | number> = {
        competitionId,
        limit,
        cursor: (pageParam as string) ?? "",
        sortDirection: "1",
      };
      if (search) params.search = search;
      return api.get<PublicEntry[]>("/api/entries", { params });
    },
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore ? (lastPage.meta.nextCursor ?? undefined) : undefined,
    enabled: !!competitionId,
    staleTime: STALE_TIME_PUBLIC,
  });
}
