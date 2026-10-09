import type { ApiResponse, PublicComplianceSettings } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_PUBLIC } from "../../constants";
import { queryKeys } from "../../keys";

export function usePublicComplianceSettings(options?: {
  initialData?: ApiResponse<PublicComplianceSettings>;
}) {
  return useQuery<ApiResponse<PublicComplianceSettings>>({
    queryKey: queryKeys.public.complianceSettings(),
    queryFn: () => api.get("/api/compliance-settings"),
    staleTime: STALE_TIME_PUBLIC,
    initialData: options?.initialData,
  });
}
