import type {
  AdminComplianceOverrideRequest,
  AdminUserComplianceState,
  AdminUserProfilePatch,
  ApiResponse,
  ComplianceAuditEntry,
} from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export function useAdminUserCompliance(userId: string) {
  return useQuery<ApiResponse<AdminUserComplianceState>>({
    queryKey: queryKeys.admin.userCompliance(userId),
    queryFn: () => api.get<AdminUserComplianceState>(`/api/admin/users/${userId}/compliance`),
    enabled: !!userId,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminComplianceAudit(userId: string, limit = 50) {
  return useQuery<ApiResponse<ComplianceAuditEntry[]>>({
    queryKey: queryKeys.admin.userComplianceAudit(userId, limit),
    queryFn: () =>
      api.get<ComplianceAuditEntry[]>(`/api/admin/users/${userId}/compliance/audit?limit=${limit}`),
    enabled: !!userId,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminUserComplianceMutations(userId: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.admin.userCompliance(userId) });
    void qc.invalidateQueries({ queryKey: queryKeys.admin.userComplianceAudit(userId) });
    void qc.invalidateQueries({ queryKey: queryKeys.admin.user(userId) });
  };

  const overrideMutation = useMutation({
    mutationFn: (payload: AdminComplianceOverrideRequest) =>
      api.patch<AdminUserComplianceState>(`/api/admin/users/${userId}/compliance`, payload),
    onSettled: invalidate,
  });

  const profilePatchMutation = useMutation({
    mutationFn: (payload: AdminUserProfilePatch) =>
      api.patch(`/api/admin/users/${userId}/profile`, payload),
    onSettled: invalidate,
  });

  const balanceAdjustMutation = useMutation({
    mutationFn: (payload: { amount: number; note: string }) =>
      api.post(`/api/admin/balances/adjust`, { userId, ...payload }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.userBalance(userId) });
    },
  });

  return {
    overrideMutation,
    profilePatchMutation,
    balanceAdjustMutation,
  };
}
