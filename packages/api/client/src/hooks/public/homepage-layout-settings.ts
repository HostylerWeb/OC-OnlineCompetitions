import type { ApiResponse, HomepageLayoutSettings } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { queryKeys } from "../../keys";

export function useHomepageLayoutSettings(options?: {
  initialData?: ApiResponse<HomepageLayoutSettings>;
}) {
  return useQuery<ApiResponse<HomepageLayoutSettings>>({
    queryKey: queryKeys.public.homepageLayoutSettings(),
    queryFn: () => api.get("/api/homepage-layout-settings"),
    initialData: options?.initialData,
    staleTime: 300_000,
  });
}
