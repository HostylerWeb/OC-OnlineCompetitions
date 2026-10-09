import type { AdminReferralPurchase, ApiResponse } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useAdminReferralPurchase(id: string) {
  return useQuery<ApiResponse<AdminReferralPurchase>>({
    queryKey: [...queryKeys.admin.referralPurchases(), id],
    queryFn: () => api.get<AdminReferralPurchase>(`/api/admin/referral-purchases/${id}`),
    staleTime: STALE_TIME_ADMIN,
    enabled: !!id,
  });
}

export function useAdminUserReferralPurchases(userId: string) {
  return useQuery<ApiResponse<AdminReferralPurchase[]>>({
    queryKey: [...queryKeys.admin.referralPurchases(), "user", userId],
    queryFn: () =>
      api.get<AdminReferralPurchase[]>("/api/admin/referral-purchases", {
        params: { referredBy: userId },
      }),
    staleTime: STALE_TIME_ADMIN,
    enabled: !!userId,
  });
}

export function useAdminUserReferralMutation() {
  const qc = useQueryClient();

  return useMutation<
    ApiResponse<{ referredByCode: string | null; referredBySignupCode: string | null }>,
    Error,
    { userId: string; referralCode?: string; action?: "clear" }
  >({
    mutationFn: (payload) => api.put("/api/admin/users", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "user"] });
      qc.invalidateQueries({ queryKey: ["admin", "user-referral-stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "referral-purchases"] });
    },
  });
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
