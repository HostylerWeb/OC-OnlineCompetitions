import type { EmailSettings } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export function useAdminEmailSettings() {
  return useQuery({
    queryKey: queryKeys.admin.emailSettings(),
    queryFn: () => api.get("/api/admin/email-settings"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminEmailSettingsMutations() {
  const qc = useQueryClient();
  return {
    saveSettingsMutation: useMutation({
      mutationFn: (payload: Partial<EmailSettings>) =>
        api.put("/api/admin/email-settings", payload),
      onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.emailSettings() }),
    }),
  };
}
