import type { ApiResponse } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiResponseError, api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface ShopProductOptionValue {
  value: string;
  metadata?: Record<string, unknown>;
}

export interface ShopProductOption {
  name: string;
  values: ShopProductOptionValue[];
}

export interface ShopProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  sku: string;
  inventory: number;
  inventoryTracked: boolean;
  categoryId?: string;
  images: string[];
  options?: ShopProductOption[];
  lowStockThreshold?: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ShopProductVariant {
  _id: string;
  productId: string;
  name: string;
  sku: string;
  price?: number;
  compareAtPrice?: number;
  inventory: number;
  inventoryTracked: boolean;
  images: string[];
  optionValues: { optionName: string; value: string }[];
  isActive: boolean;
  sortOrder: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OptionsSyncResult {
  disabledVariants: number;
  createdVariants: Array<{ name: string; sku: string; id: string }>;
  skipped: string[];
  errors: Array<{ name: string; error: string }>;
  totalActiveVariants: number;
}

export interface AdminShopProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortField?: string;
  sortDir?: string;
  showDeleted?: boolean;
  categoryId?: string;
  isActive?: boolean;
}

const usePaginatedAdminShopProducts = createPaginatedAdminQuery<ShopProduct>({
  queryKey: (page, limit, showDeleted = "", categoryId = "", isActive = "") =>
    [...queryKeys.admin.shopProducts(page, limit), showDeleted, categoryId, isActive] as const,
  endpoint: "/api/admin/shop/products",
  buildParams: (page, limit, showDeleted = "", categoryId = "", isActive = "") => ({
    page,
    limit,
    ...(showDeleted ? { showDeleted: "true" } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(isActive ? { isActive } : {}),
  }),
});

export function useAdminShopProducts(options: AdminShopProductsParams = {}) {
  const {
    page = 1,
    limit = 20,
    search = "",
    sortField,
    sortDir,
    showDeleted,
    categoryId,
    isActive,
  } = options;
  return usePaginatedAdminShopProducts({
    page,
    limit,
    sortField,
    sortDir,
    search,
    args: [showDeleted ? "true" : "", categoryId ?? "", isActive ? "true" : ""],
  });
}

export function useAdminShopProduct(id: string) {
  return useQuery<ApiResponse<ShopProduct>>({
    queryKey: queryKeys.admin.shopProduct(id),
    queryFn: () => api.get<ShopProduct>(`/api/admin/shop/products/${id}`),
    enabled: !!id,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminShopProductMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "shop", "products"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<ApiResponse<ShopProduct>>("/api/admin/shop/products", payload),
    onSuccess: invalidate,
    onError: (err) => {
      if (err instanceof ApiResponseError && err.status === 409) {
        invalidate();
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.put<ApiResponse<ShopProduct>>(`/api/admin/shop/products/${id}`, payload),
    onSuccess: invalidate,
    onError: (err) => {
      if (err instanceof ApiResponseError && err.status === 409) {
        invalidate();
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/api/admin/shop/products/${id}`),
    onSuccess: invalidate,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<{ success: boolean }>>(`/api/admin/shop/products/${id}/restore`),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deleteMutation, restoreMutation };
}

// ── Product Variant Hooks ───────────────────────────────

export function useAdminShopProductVariants(productId: string) {
  return useQuery<ApiResponse<ShopProductVariant[]>>({
    queryKey: [...queryKeys.admin.shopProduct(productId), "variants"],
    queryFn: () => api.get<ShopProductVariant[]>(`/api/admin/shop/products/${productId}/variants`),
    enabled: !!productId,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminShopProductVariantMutations(productId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "shop", "products"] });
  };

  const createVariantMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<ShopProductVariant>(`/api/admin/shop/products/${productId}/variants`, payload),
    onSuccess: invalidate,
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.put<ShopProductVariant>(`/api/admin/shop/products/${productId}/variants/${id}`, payload),
    onSuccess: invalidate,
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/api/admin/shop/products/${productId}/variants/${id}`),
    onSuccess: invalidate,
  });

  const bulkUpdateVariantsMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; payload: Record<string, unknown> }>) =>
      api.put<{ results: Array<{ id: string; ok: boolean; error?: string }> }>(
        `/api/admin/shop/products/${productId}/variants-bulk`,
        { updates }
      ),
    onSuccess: invalidate,
  });

  const updateVariantImagesMutation = useMutation({
    mutationFn: ({ id, images }: { id: string; images: string[] }) =>
      api.put<ShopProductVariant>(`/api/admin/shop/products/${productId}/variants/${id}/images`, {
        images,
      }),
    onSuccess: invalidate,
  });

  const syncOptionsMutation = useMutation({
    mutationFn: (payload: {
      options: ShopProductOption[];
      newVariants: Array<{
        name: string;
        sku: string;
        optionValues: Array<{ optionName: string; value: string }>;
      }>;
    }) =>
      api.post<OptionsSyncResult>(`/api/admin/shop/products/${productId}/options-sync`, payload),
    onSuccess: invalidate,
  });

  return {
    createVariantMutation,
    updateVariantMutation,
    deleteVariantMutation,
    bulkUpdateVariantsMutation,
    updateVariantImagesMutation,
    syncOptionsMutation,
  };
}
