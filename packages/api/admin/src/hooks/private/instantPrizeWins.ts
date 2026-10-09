"use client";
import type { ApiResponse, MyInstantPrizeWinDto } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";

export type InstantPrizeWin = MyInstantPrizeWinDto;

const INSTANT_WIN_IDS_CHUNK_SIZE = 100;

function chunkSortedIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += INSTANT_WIN_IDS_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + INSTANT_WIN_IDS_CHUNK_SIZE));
  }
  return chunks;
}

/** @deprecated Prefer useMyInstantPrizeWinsByIds or useInfiniteMyInstantPrizeWins for bounded fetches. */
export function useMyInstantPrizeWins() {
  return useQuery<ApiResponse<InstantPrizeWin[]>>({
    queryKey: queryKeys.my.instantPrizeWins(),
    queryFn: () => api.get<InstantPrizeWin[]>("/api/me/instant-prize-wins"),
    staleTime: STALE_TIME_USER,
  });
}

export function useMyInstantPrizeWinsByIds(winIds: string[]) {
  const sortedIds = useMemo(() => [...new Set(winIds.filter(Boolean))].sort(), [winIds]);
  const idsKey = sortedIds.join(",");

  return useQuery<ApiResponse<InstantPrizeWin[]>>({
    queryKey: queryKeys.my.instantPrizeWinsByIds(idsKey),
    queryFn: async () => {
      const chunks = chunkSortedIds(sortedIds);
      if (chunks.length === 0) {
        return { data: [] };
      }

      const responses = await Promise.all(
        chunks.map((chunk) =>
          api.get<InstantPrizeWin[]>("/api/me/instant-prize-wins", {
            params: { ids: chunk.join(",") },
          })
        )
      );

      const merged = responses.flatMap((response) => response.data ?? []);
      return { ...responses[0]!, data: merged };
    },
    enabled: sortedIds.length > 0,
    staleTime: STALE_TIME_USER,
  });
}
