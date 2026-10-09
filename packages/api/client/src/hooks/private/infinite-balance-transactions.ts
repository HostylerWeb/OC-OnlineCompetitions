import type { ApiResponse, BalanceTransaction } from "@oc/types";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";
import { getOffsetNextPageParam } from "../../lib/pagination";

export function useInfiniteMyBalanceTransactions(
  limit = 20,
  options?: { initialData?: InfiniteData<ApiResponse<BalanceTransaction[]>> }
) {
  return useInfiniteQuery<ApiResponse<BalanceTransaction[]>>({
    queryKey: [...queryKeys.my.balanceTransactions(), "infinite", limit] as const,
    queryFn: ({ pageParam = 1 }) =>
      api.get<BalanceTransaction[]>("/api/balance/transactions", {
        params: { page: pageParam as number, limit },
      }),
    initialPageParam: 1,
    getNextPageParam: getOffsetNextPageParam,
    staleTime: STALE_TIME_USER,
    initialData: options?.initialData,
  });
}
