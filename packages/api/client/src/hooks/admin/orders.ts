import type { AdminOrder, ApiResponse } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface AdminOrdersParams {
  page?: number;
  limit?: number;
  statusFilter?: string;
  userId?: string;
  groupBy?: string;
  sortField?: string;
  sortDir?: string;
  search?: string;
  columnSearch?: Record<string, string>;
  showDeleted?: boolean;
}

const usePaginatedAdminOrders = createPaginatedAdminQuery<AdminOrder>({
  queryKey: (page, limit, statusFilter = "", userId = "", showDeleted = "") =>
    [...queryKeys.admin.orders(page, statusFilter, userId, limit), showDeleted] as const,
  endpoint: "/api/admin/orders",
  buildParams: (page, limit, statusFilter = "", userId = "", showDeleted = "") => ({
    page,
    limit,
    ...(statusFilter && { status: statusFilter }),
    ...(userId && { userId }),
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminOrders(options: AdminOrdersParams = {}) {
  const {
    page = 1,
    limit = 20,
    statusFilter = "",
    userId = "",
    groupBy,
    sortField,
    sortDir,
    search,
    columnSearch,
    showDeleted,
  } = options;
  return usePaginatedAdminOrders({
    page,
    limit,
    groupBy,
    sortField,
    sortDir,
    search,
    columnSearch,
    args: [statusFilter, userId ?? "", showDeleted ? "true" : ""],
  });
}

export function useAdminOrder(orderId: string) {
  return useQuery<ApiResponse<AdminOrder>>({
    queryKey: ["admin", "order", orderId],
    queryFn: () => api.get<AdminOrder>(`/api/admin/orders/${orderId}`),
    enabled: !!orderId,
    staleTime: STALE_TIME_ADMIN,
  });
}

const ADMIN_ORDERS_KEY = ["admin", "orders"] as const;

export function useAdminOrderMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_KEY });
    // Also bust the per-user my.orders cache so the affected user sees
    // the new status on their next visit.
    void queryClient.invalidateQueries({ queryKey: ["my", "orders"] });
    void queryClient.invalidateQueries({ queryKey: ["my", "pending-order"] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<ApiResponse<AdminOrder>>(`/api/admin/orders/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_ORDERS_KEY });
      const previous = queryClient.getQueryData<ApiResponse<AdminOrder[]>>(ADMIN_ORDERS_KEY);
      queryClient.setQueryData<ApiResponse<AdminOrder[]>>(ADMIN_ORDERS_KEY, (old) =>
        old ? { ...old, data: old.data.map((o) => (o._id === id ? { ...o, status } : o)) } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(ADMIN_ORDERS_KEY, context.previous);
    },
    onSettled: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/api/admin/orders/${id}`),
    onSuccess: invalidateAll,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<{ success: boolean }>>(`/api/admin/orders/${id}/restore`),
    onSuccess: invalidateAll,
  });

  return { updateStatusMutation, deleteMutation, restoreMutation };
}
