import type { ApiResponse, Category } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_PUBLIC } from "../../constants";
import { queryKeys } from "../../keys";

export function useCategories(options?: { initialData?: ApiResponse<Category[]> }) {
  return useQuery<ApiResponse<Category[]>>({
    queryKey: queryKeys.categories(),
    queryFn: () => api.get<Category[]>("/api/categories"),
    initialData: options?.initialData,
    staleTime: STALE_TIME_PUBLIC,
  });
}

export function useCompetitionCategories(options?: { initialData?: ApiResponse<Category[]> }) {
  return useQuery<ApiResponse<Category[]>>({
    queryKey: queryKeys.competitionCategories(),
    queryFn: () => api.get<Category[]>("/api/competitions/categories"),
    initialData: options?.initialData,
    staleTime: STALE_TIME_PUBLIC,
  });
}
