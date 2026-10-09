import type { ApiResponse, Category } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { queryKeys } from "../../keys";

export function useCategories(options?: { initialData?: ApiResponse<Category[]> }) {
  return useQuery<ApiResponse<Category[]>>({
    queryKey: queryKeys.categories(),
    queryFn: () => api.get<Category[]>("/api/categories"),
    initialData: options?.initialData,
    staleTime: 300_000,
  });
}

export function useCompetitionCategories(options?: { initialData?: ApiResponse<Category[]> }) {
  return useQuery<ApiResponse<Category[]>>({
    queryKey: queryKeys.competitionCategories(),
    queryFn: () => api.get<Category[]>("/api/competitions/categories"),
    initialData: options?.initialData,
    staleTime: 300_000,
  });
}
