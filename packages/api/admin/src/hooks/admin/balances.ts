import type { ApiResponse, Balance } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export function useAdminUserBalance(userId: string, options?: { enabled?: boolean }) {
  return useQuery<ApiResponse<Balance>>({
    queryKey: queryKeys.admin.userBalance(userId),
    queryFn: () => api.get<Balance>(`/api/admin/balances/${userId}`),
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: STALE_TIME_ADMIN,
  });
}
