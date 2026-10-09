import type { ApiResponse, EndingSoonSettings } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { queryKeys } from "../../keys";

export function useEndingSoonSettings(options?: { initialData?: ApiResponse<EndingSoonSettings> }) {
  return useQuery<ApiResponse<EndingSoonSettings>>({
    queryKey: queryKeys.public.endingSoonSettings(),
    queryFn: () => api.get("/api/ending-soon-settings"),
    initialData: options?.initialData,
    staleTime: 300_000,
  });
}
