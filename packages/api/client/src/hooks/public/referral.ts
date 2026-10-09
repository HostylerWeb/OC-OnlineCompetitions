import type { ApiResponse } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_PUBLIC } from "../../constants";
import { queryKeys } from "../../keys";

export function usePublicReferralSettings(options?: {
  initialData?: ApiResponse<Record<string, unknown>>;
}) {
  return useQuery<ApiResponse<Record<string, unknown>>>({
    queryKey: queryKeys.public.referralSettings(),
    queryFn: () => api.get("/api/referral-settings"),
    staleTime: STALE_TIME_PUBLIC,
    initialData: options?.initialData,
  });
}
