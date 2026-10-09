import type {
  ApiResponse,
  SaferPlayState,
  SelfExcludeResponse,
  SelfExclusionDuration,
} from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";

export function useSaferPlay() {
  return useQuery<ApiResponse<SaferPlayState>>({
    queryKey: queryKeys.my.saferPlay(),
    queryFn: () => api.get("/api/me/safer-play"),
    staleTime: STALE_TIME_USER,
  });
}

export function useSaferPlayMutations() {
  const qc = useQueryClient();
  const saferPlayKey = () => queryKeys.my.saferPlay();
  const profileKey = () => queryKeys.my.profile();

  const updateSpendLimitMutation = useMutation({
    mutationFn: (monthlySpendLimit: number) => api.put("/api/me/safer-play", { monthlySpendLimit }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: saferPlayKey() });
      void qc.invalidateQueries({ queryKey: profileKey() });
    },
  });

  const selfExcludeMutation = useMutation({
    mutationFn: (duration: SelfExclusionDuration) =>
      api.post<SelfExcludeResponse>("/api/me/safer-play/self-exclude", {
        duration,
        confirm: true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: saferPlayKey() });
      void qc.invalidateQueries({ queryKey: profileKey() });
    },
  });

  return { updateSpendLimitMutation, selfExcludeMutation };
}
