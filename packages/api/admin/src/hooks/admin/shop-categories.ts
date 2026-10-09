import type { ApiResponse } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface ShopCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface AdminShopCategoriesParams {
  page?: number;
  limit?: number;
  search?: string;
  sortField?: string;
  sortDir?: string;
  showDeleted?: boolean;
}

const usePaginatedAdminShopCategories = createPaginatedAdminQuery<ShopCategory>({
  queryKey: (page, limit, showDeleted = "") =>
    [...queryKeys.admin.shopCategories(page, limit), showDeleted] as const,
  endpoint: "/api/admin/shop/categories",
  buildParams: (page, limit, showDeleted = "") => ({
    page,
    limit,
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminShopCategories(options: AdminShopCategoriesParams = {}) {
  const { page = 1, limit = 20, search = "", sortField, sortDir, showDeleted } = options;
  return usePaginatedAdminShopCategories({
    page,
    limit,
    sortField,
    sortDir,
    search,
    args: [showDeleted ? "true" : ""],
  });
}

export function useAdminShopCategory(id: string) {
  return useQuery<ApiResponse<ShopCategory>>({
    queryKey: queryKeys.admin.shopCategory(id),
    queryFn: () => api.get<ShopCategory>(`/api/admin/shop/categories/${id}`),
    enabled: !!id,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminShopCategoryMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "shop", "categories"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<ApiResponse<ShopCategory>>("/api/admin/shop/categories", payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.put<ApiResponse<ShopCategory>>(`/api/admin/shop/categories/${id}`, payload),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/api/admin/shop/categories/${id}`),
    onSuccess: invalidate,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<{ success: boolean }>>(`/api/admin/shop/categories/${id}/restore`),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deleteMutation, restoreMutation };
}
