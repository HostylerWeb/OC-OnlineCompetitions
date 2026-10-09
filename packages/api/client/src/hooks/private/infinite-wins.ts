import type { ApiResponse, MyBonusAwardWinDto, MyInstantPrizeWinDto, Winner } from "@oc/types";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";
import { getOffsetNextPageParam } from "../../lib/pagination";

export function useInfiniteMyWins(
  limit = 20,
  options?: { initialData?: InfiniteData<ApiResponse<Winner[]>> }
) {
  return useInfiniteQuery<ApiResponse<Winner[]>>({
    queryKey: queryKeys.my.winsInfinite(limit),
    queryFn: ({ pageParam = 1 }) =>
      api.get<Winner[]>("/api/me/profile/wins", {
        params: { page: pageParam as number, limit },
      }),
    initialPageParam: 1,
    getNextPageParam: getOffsetNextPageParam,
    staleTime: STALE_TIME_USER,
    initialData: options?.initialData,
  });
}

export function useInfiniteMyInstantPrizeWins(
  limit = 20,
  options?: { enabled?: boolean; initialData?: InfiniteData<ApiResponse<MyInstantPrizeWinDto[]>> }
) {
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
    initialData: options?.initialData,
  });
}

export function useInfiniteMyBonusAwardWins(
  limit = 20,
  options?: { enabled?: boolean; initialData?: InfiniteData<ApiResponse<MyBonusAwardWinDto[]>> }
) {
  const enabled = options?.enabled ?? true;
  return useInfiniteQuery<ApiResponse<MyBonusAwardWinDto[]>>({
    queryKey: queryKeys.my.bonusAwardWinsInfinite(limit),
    queryFn: ({ pageParam = 1 }) =>
      api.get<MyBonusAwardWinDto[]>("/api/me/bonus-award-wins", {
        params: { page: pageParam as number, limit },
      }),
    initialPageParam: 1,
    getNextPageParam: getOffsetNextPageParam,
    staleTime: STALE_TIME_USER,
    enabled,
    initialData: options?.initialData,
  });
}
