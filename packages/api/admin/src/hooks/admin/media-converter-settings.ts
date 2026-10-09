import type {
  ApiResponse,
  MediaConverterBulkConvertResultItem,
  MediaConverterBulkPreview,
  MediaConverterBulkVerifyResultItem,
  MediaConverterSettings,
} from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export function useAdminMediaConverterSettings() {
  return useQuery<ApiResponse<MediaConverterSettings>>({
    queryKey: queryKeys.admin.mediaConverterSettings(),
    queryFn: () => api.get("/api/admin/media-converter-settings"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminMediaConverterSettingsMutations() {
  const qc = useQueryClient();

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: Partial<MediaConverterSettings>) =>
      api.put("/api/admin/media-converter-settings", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.mediaConverterSettings() });
    },
  });

  return { saveSettingsMutation };
}

export function useAdminMediaConverterBulkPreview(enabled: boolean) {
  void enabled;
  return useQuery<ApiResponse<MediaConverterBulkPreview>>({
    queryKey: queryKeys.admin.mediaConverterBulkPreview(),
    queryFn: () =>
      api.get("/api/admin/media-converter-settings/bulk/preview", {
        timeout: 600_000,
      }),
    enabled: false,
    staleTime: 0,
  });
}

export function useAdminMediaConverterBulkMutations() {
  const qc = useQueryClient();

  const scanPreviewMutation = useMutation({
    mutationFn: () =>
      api.get<MediaConverterBulkPreview>("/api/admin/media-converter-settings/bulk/preview", {
        timeout: 600_000,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.mediaConverterBulkPreview() });
    },
  });

  const convertBatchMutation = useMutation({
    mutationFn: (keys: string[]) =>
      api.post<{ results: MediaConverterBulkConvertResultItem[] }>(
        "/api/admin/media-converter-settings/bulk/convert",
        { keys },
        { timeout: 600_000 }
      ),
  });

  const verifyMutation = useMutation({
    mutationFn: (keys: string[]) =>
      api.post<{ ok: boolean; results: MediaConverterBulkVerifyResultItem[] }>(
        "/api/admin/media-converter-settings/bulk/verify",
        { keys },
        { timeout: 120_000 }
      ),
  });

  const deleteOriginalsMutation = useMutation({
    mutationFn: (keys: string[]) =>
      api.post<{ deleted: number; failed: string[] }>(
        "/api/admin/media-converter-settings/bulk/delete-originals",
        { keys },
        { timeout: 120_000 }
      ),
  });

  return { scanPreviewMutation, convertBatchMutation, verifyMutation, deleteOriginalsMutation };
}
