import type { ApiResponse, HomepageLayoutSettings } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export function useAdminHomepageLayoutSettings() {
  return useQuery<ApiResponse<HomepageLayoutSettings>>({
    queryKey: queryKeys.admin.homepageLayoutSettings(),
    queryFn: () => api.get("/api/admin/homepage-layout-settings"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useHomepageLayoutMutations() {
  const qc = useQueryClient();

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: Pick<HomepageLayoutSettings, "sections">) =>
      api.put("/api/admin/homepage-layout-settings", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.homepageLayoutSettings() });
      void qc.invalidateQueries({ queryKey: queryKeys.public.homepageLayoutSettings() });
    },
  });

  return { saveSettingsMutation };
}
