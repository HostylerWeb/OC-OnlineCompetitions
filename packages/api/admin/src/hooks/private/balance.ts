import type { ApiResponse, Balance, BalanceTransaction } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";

export function useBalance() {
  return useQuery<ApiResponse<Balance>>({
    queryKey: queryKeys.my.balance(),
    queryFn: () => api.get<Balance>("/api/balance"),
    staleTime: STALE_TIME_USER,
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
