import type { AdminCategory, AdminCategoryPayload, ApiResponse } from "@oc/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiResponseError, api } from "../../client";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface AdminCategoriesParams {
  page?: number;
  limit?: number;
  search?: string;
  sortField?: string;
  sortDir?: string;
  groupBy?: string;
  showDeleted?: boolean;
}

const usePaginatedAdminCategories = createPaginatedAdminQuery<AdminCategory>({
  queryKey: (page, limit, search = "", showDeleted = "") =>
    [...queryKeys.admin.categories(page, limit, search), showDeleted] as const,
  endpoint: "/api/admin/categories",
  buildParams: (page, limit, search = "", showDeleted = "") => ({
    page,
    limit,
    ...(search ? { search } : {}),
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminCategories(options: AdminCategoriesParams = {}) {
  const { page = 1, limit = 20, search = "", sortField, sortDir, groupBy, showDeleted } = options;
  return usePaginatedAdminCategories({
    page,
    limit,
    sortField,
    sortDir,
    groupBy,
    args: [search, showDeleted ? "true" : ""],
  });
}

export function useAdminCategoryMutations() {
  const queryClient = useQueryClient();

  const invalidateCategories = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.competitionCategories() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.public.homepageLayoutSettings() });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/api/admin/categories/${id}`),
    onSuccess: invalidateCategories,
  });

  const createMutation = useMutation({
    mutationFn: (payload: AdminCategoryPayload) =>
      api.post<ApiResponse<AdminCategory>>("/api/admin/categories", payload),
    onSuccess: invalidateCategories,
    onError: (err) => {
      if (err instanceof ApiResponseError && err.status === 409) {
        invalidateCategories();
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminCategoryPayload }) =>
      api.put<ApiResponse<AdminCategory>>(`/api/admin/categories/${id}`, payload),
    onSuccess: invalidateCategories,
    onError: (err) => {
      if (err instanceof ApiResponseError && err.status === 409) {
        invalidateCategories();
      }
    },
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.put<ApiResponse<{ success: boolean }>>("/api/admin/categories/reorder", {
        orderedIds,
      }),
    onSuccess: invalidateCategories,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<{ success: boolean }>>(`/api/admin/categories/${id}/restore`),
    onSuccess: invalidateCategories,
  });

  return {
    deleteMutation,
    createMutation,
    updateMutation,
    reorderCategoriesMutation,
    restoreMutation,
  };
}
