import type { ApiResponse, ComplianceSettings } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export function useAdminComplianceSettings() {
  return useQuery<ApiResponse<ComplianceSettings>>({
    queryKey: queryKeys.admin.complianceSettings(),
    queryFn: () => api.get("/api/admin/compliance-settings"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useComplianceSettingsMutations() {
  const qc = useQueryClient();

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: Partial<ComplianceSettings>) =>
      api.put("/api/admin/compliance-settings", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.complianceSettings() });
      void qc.invalidateQueries({ queryKey: queryKeys.public.complianceSettings() });
    },
  });

  return { saveSettingsMutation };
}
