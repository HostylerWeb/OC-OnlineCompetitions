import type {
  AiPersonalisationSettings,
  ApiResponse,
  OpenRouterModelListItem,
  OpenRouterModelPricingTier,
  PersonalisationPlannerRunStatus,
} from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export type AiPersonalisationSettingsUpdate = Partial<
  Omit<AiPersonalisationSettings, "_id">
>;

export function useAdminAiPersonalisationSettings() {
  return useQuery<ApiResponse<AiPersonalisationSettings>>({
    queryKey: queryKeys.admin.aiPersonalisationSettings(),
    queryFn: () => api.get("/api/admin/ai-personalisation-settings"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminAiPersonalisationSettingsMutations() {
  const qc = useQueryClient();

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: AiPersonalisationSettingsUpdate) =>
      api.put<AiPersonalisationSettings>("/api/admin/ai-personalisation-settings", payload),
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.admin.aiPersonalisationSettings(), res);
    },
  });

  return { saveSettingsMutation };
}

export type OpenRouterModelsScanResponse = {
  tier: OpenRouterModelPricingTier;
  models: OpenRouterModelListItem[];
  scannedAt: string;
};

export function useAdminOpenRouterModelsScan() {
  return useMutation({
    mutationFn: (payload: { tier: OpenRouterModelPricingTier; openRouterApiKey?: string }) =>
      api.post<OpenRouterModelsScanResponse>(
        "/api/admin/ai-personalisation-settings/models/scan",
        payload,
        { timeout: 60_000 }
      ),
  });
}

export type PersonalisationPlannerRunDto = {
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: PersonalisationPlannerRunStatus;
  usersEligible: number;
  usersPlanned: number;
  llmBatches: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  runErrors: string[];
  dryRun: boolean;
};

export function useAdminPersonalisationPlannerLatestRun() {
  return useQuery<ApiResponse<PersonalisationPlannerRunDto | null>>({
    queryKey: [...queryKeys.admin.aiPersonalisationSettings(), "planner-run-latest"] as const,
    queryFn: () => api.get("/api/admin/ai-personalisation-settings/planner-runs/latest"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export type OpenRouterImageModelsScanResponse = {
  models: OpenRouterModelListItem[];
  scannedAt: string;
};

export function useAdminOpenRouterImageModelsScan() {
  return useMutation({
    mutationFn: () =>
      api.post<OpenRouterImageModelsScanResponse>(
        "/api/admin/ai-personalisation-settings/models/scan-images",
        {},
        { timeout: 120_000 }
      ),
  });
}

export function useAdminCompetitionAiGenerateImage() {
  return useMutation({
    mutationFn: (payload: { title: string; description: string; slug?: string }) =>
      api.post<{ publicUrl: string }>(
        "/api/admin/ai-personalisation-settings/competition/generate-image",
        payload,
        { timeout: 180_000 }
      ),
  });
}

export function useAdminCompetitionAiEnhanceDescription() {
  return useMutation({
    mutationFn: (payload: { title: string; description: string }) =>
      api.post<{ description: string }>(
        "/api/admin/ai-personalisation-settings/competition/enhance-description",
        payload,
        { timeout: 90_000 }
      ),
  });
}

export function useAdminRunPersonalisationPlanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post("/api/admin/ai-personalisation-settings/planner/run", {}, { timeout: 600_000 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.aiPersonalisationSettings() });
      void qc.invalidateQueries({
        queryKey: [...queryKeys.admin.aiPersonalisationSettings(), "planner-run-latest"],
      });
    },
  });
}
