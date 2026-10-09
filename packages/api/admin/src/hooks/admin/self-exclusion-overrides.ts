import type { ApiResponse, SelfExcludedUser } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export function useSelfExcludedUsers() {
  return useQuery<ApiResponse<SelfExcludedUser[]>>({
    queryKey: queryKeys.admin.selfExcludedUsers(),
    queryFn: () => api.get("/api/admin/self-exclusion-overrides"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useSelfExclusionOverrideMutations() {
  const qc = useQueryClient();

  const processOverrideMutation = useMutation({
    mutationFn: ({
      userId,
      action,
      adminNote,
    }: {
      userId: string;
      action: "approve" | "reject";
      adminNote?: string;
    }) =>
      api.patch<{ processed: boolean; emailSent: boolean; emailError?: string }>(
        `/api/admin/self-exclusion-overrides/${userId}/process`,
        { action, adminNote }
      ),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.selfExcludedUsers() });
    },
  });

  const liftSelfExclusionMutation = useMutation({
    mutationFn: ({
      userId,
      reason,
      acknowledgePermanent,
    }: {
      userId: string;
      reason: string;
      acknowledgePermanent?: boolean;
    }) =>
      api.patch<{ lifted: boolean; emailSent: boolean; emailError?: string }>(
        `/api/admin/self-exclusion-overrides/${userId}/lift`,
        { reason, acknowledgePermanent }
      ),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.selfExcludedUsers() });
    },
  });

  return { processOverrideMutation, liftSelfExclusionMutation };
}
