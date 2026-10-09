import type { AdminReferralPurchase, ApiResponse } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface AdminReferralsParams {
  page?: number;
  limit?: number;
  status?: string;
  groupBy?: string;
  sortField?: string;
  sortDir?: string;
  search?: string;
  columnSearch?: Record<string, string>;
  showDeleted?: boolean;
}

const usePaginatedAdminReferrals = createPaginatedAdminQuery<AdminReferralPurchase>({
  queryKey: (page, limit, status = "", showDeleted = "") =>
    [...queryKeys.admin.referrals(status, page, limit), showDeleted] as const,
  endpoint: "/api/admin/referral-purchases",
  buildParams: (page, limit, status = "", showDeleted = "") => ({
    page,
    limit,
    ...(status && { status }),
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminReferrals(options: AdminReferralsParams = {}) {
  const {
    page = 1,
    limit = 20,
    status = "",
    groupBy,
    sortField,
    sortDir,
    search,
    columnSearch,
    showDeleted,
  } = options;
  return usePaginatedAdminReferrals({
    page,
    limit,
    groupBy,
    sortField,
    sortDir,
    search,
    columnSearch,
    args: [status, showDeleted ? "true" : ""],
  });
}

export function useAdminReferralSettings() {
  return useQuery<ApiResponse<Record<string, unknown>>>({
    queryKey: queryKeys.admin.referralSettings(),
    queryFn: () => api.get("/api/admin/referral-settings"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminReferralMutations() {
  const qc = useQueryClient();
  const referralsKey = ["admin", "referral-purchases"] as const;
  const settingsKey = () => queryKeys.admin.referralSettings();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/referral-purchases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: referralsKey }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/referral-purchases/${id}/restore`),
    onSuccess: () => qc.invalidateQueries({ queryKey: referralsKey }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: unknown) => api.put("/api/admin/referral-settings", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKey() }),
  });

  return { deleteMutation, restoreMutation, saveSettingsMutation };
}
