import type { AdminReferralPurchase, ApiResponse } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export interface AdminReferralPurchasesParams {
  status?: "approved" | "rejected" | "pending" | "all";
  referrerId?: string;
  groupBy?: string;
  sortField?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
  search?: string;
}

export function useAdminReferralPurchases(options: AdminReferralPurchasesParams = {}) {
  const {
    status = "all",
    referrerId,
    groupBy,
    sortField,
    sortDir,
    page = 1,
    limit = 20,
    search,
  } = options;

  return useQuery<ApiResponse<AdminReferralPurchase[]>>({
    queryKey: [
      ...queryKeys.admin.referralPurchases(status, referrerId ?? "", page, limit),
      groupBy ?? "",
      sortField ?? "",
      sortDir ?? "",
      search ?? "",
    ],
    queryFn: () =>
      api.get<AdminReferralPurchase[]>("/api/admin/referral-purchases", {
        params: {
          page,
          limit,
          status,
          ...(referrerId ? { referredBy: referrerId } : {}),
          ...(groupBy ? { groupBy } : {}),
          ...(sortField ? { sortField, sortDir: sortDir ?? "desc" } : {}),
          ...(search ? { search } : {}),
        },
      }),
    staleTime: STALE_TIME_ADMIN,
  });
}
