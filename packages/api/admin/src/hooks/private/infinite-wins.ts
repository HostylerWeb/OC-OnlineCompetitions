import type { ApiResponse, MyInstantPrizeWinDto, Winner } from "@oc/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";
import { getOffsetNextPageParam } from "../../lib/pagination";

export function useInfiniteMyWins(limit = 20) {
  return useInfiniteQuery<ApiResponse<Winner[]>>({
    queryKey: queryKeys.my.winsInfinite(limit),
    queryFn: ({ pageParam = 1 }) =>
      api.get<Winner[]>("/api/me/profile/wins", {
        params: { page: pageParam as number, limit },
      }),
    initialPageParam: 1,
    getNextPageParam: getOffsetNextPageParam,
    staleTime: STALE_TIME_USER,
  });
}

export function useInfiniteMyInstantPrizeWins(limit = 20, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useInfiniteQuery<ApiResponse<MyInstantPrizeWinDto[]>>({
    queryKey: queryKeys.my.instantPrizeWinsInfinite(limit),
    queryFn: ({ pageParam = 1 }) =>
      api.get<MyInstantPrizeWinDto[]>("/api/me/instant-prize-wins", {
        params: { page: pageParam as number, limit },
      }),
    initialPageParam: 1,
    getNextPageParam: getOffsetNextPageParam,
    staleTime: STALE_TIME_USER,
    enabled,
  });
}
