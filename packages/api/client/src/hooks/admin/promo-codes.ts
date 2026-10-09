import type { AdminPromoCode, ApiResponse } from "@oc/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface AdminPromoCodesParams {
  page?: number;
  limit?: number;
  groupBy?: string;
  sortField?: string;
  sortDir?: string;
  search?: string;
  columnSearch?: Record<string, string>;
  showDeleted?: boolean;
}

const usePaginatedAdminPromoCodes = createPaginatedAdminQuery<AdminPromoCode>({
  queryKey: (page, limit, showDeleted = "") =>
    [...queryKeys.admin.promoCodes(page, limit), showDeleted] as const,
  endpoint: "/api/admin/promo-codes",
  buildParams: (page, limit, showDeleted = "") => ({
    page,
    limit,
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminPromoCodes(options: AdminPromoCodesParams = {}) {
  const {
    page = 1,
    limit = 20,
    groupBy,
    sortField,
    sortDir,
    search,
    columnSearch,
    showDeleted,
  } = options;
  return usePaginatedAdminPromoCodes({
    page,
    limit,
    groupBy,
    sortField,
    sortDir,
    search,
    columnSearch,
    args: [showDeleted ? "true" : ""],
  });
}

export function useAdminPromoCodeMutations() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/api/admin/promo-codes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "promo-codes"] }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<ApiResponse<AdminPromoCode>>("/api/admin/promo-codes", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "promo-codes"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.put<ApiResponse<AdminPromoCode>>(`/api/admin/promo-codes/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "promo-codes"] }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<{ success: boolean }>>(`/api/admin/promo-codes/${id}/restore`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "promo-codes"] }),
  });

  return { deleteMutation, createMutation, updateMutation, restoreMutation };
}
