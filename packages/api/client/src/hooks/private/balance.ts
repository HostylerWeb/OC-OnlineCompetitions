import type { ApiResponse, Balance, BalanceTransaction } from "@oc/types";
import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";

export function useBalance(
  options?: Pick<UseQueryOptions<ApiResponse<Balance>>, "enabled" | "initialData">
) {
  return useQuery<ApiResponse<Balance>>({
    queryKey: queryKeys.my.balance(),
    queryFn: () => api.get<Balance>("/api/balance"),
    staleTime: STALE_TIME_USER,
    ...options,
  });
}

export function useBalanceTransactions(page = 1) {
  return useQuery<ApiResponse<BalanceTransaction[]>>({
    queryKey: queryKeys.my.balanceTransactions(page),
    queryFn: () =>
      api.get<BalanceTransaction[]>("/api/balance/transactions", { params: { page, limit: 20 } }),
    staleTime: STALE_TIME_USER,
  });
}
