import type { ApiResponse, Winner } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_STATIC } from "../../constants";
import { queryKeys } from "../../keys";

export function useWinners(limit = 10, options?: { initialData?: ApiResponse<Winner[]> }) {
  return useQuery<ApiResponse<Winner[]>>({
    queryKey: queryKeys.winners.recent(limit),
    queryFn: () =>
      api.get<Winner[]>("/api/winners", {
        params: { limit },
      }),
    initialData: options?.initialData,
    staleTime: 60_000,
  });
}

export function useWinnersStats(options?: {
  initialData?: ApiResponse<{
    totalWinners: number;
    totalPrizeValue: number;
    totalWinnersAllTime: number;
  }>;
}) {
  return useQuery<
    ApiResponse<{ totalWinners: number; totalPrizeValue: number; totalWinnersAllTime: number }>
  >({
    queryKey: queryKeys.winners.stats(),
    queryFn: () =>
      api.get<{ totalWinners: number; totalPrizeValue: number; totalWinnersAllTime: number }>(
        "/api/winners/stats"
      ),
    initialData: options?.initialData,
    staleTime: STALE_TIME_STATIC,
  });
}
