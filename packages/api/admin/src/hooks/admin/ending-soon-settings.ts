import type { ApiResponse, EndingSoonSettings } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export function useAdminEndingSoonSettings() {
  return useQuery<ApiResponse<EndingSoonSettings>>({
    queryKey: queryKeys.admin.endingSoonSettings(),
    queryFn: () => api.get("/api/admin/ending-soon-settings"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useEndingSoonSettingsMutations() {
  const qc = useQueryClient();
  const settingsKey = () => queryKeys.admin.endingSoonSettings();

  return {
    saveSettingsMutation: useMutation({
      mutationFn: (payload: Partial<EndingSoonSettings>) =>
        api.put("/api/admin/ending-soon-settings", payload),
      onSuccess: () => {
        // Bust the admin view AND the public read (used by the homepage
        // hero "ending soon" rail and the competitions list filter).
        void qc.invalidateQueries({ queryKey: settingsKey() });
        void qc.invalidateQueries({ queryKey: ["public", "ending-soon-settings"] });
      },
    }),
  };
}
