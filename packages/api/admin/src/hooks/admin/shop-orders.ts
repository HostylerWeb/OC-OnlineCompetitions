import type { ApiResponse } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface ShopOrder {
  _id: string;
  orderNumber: string;
  userId?: string;
  email?: string;
  status: string;
  isGuestCheckout?: boolean;
  items: any[];
  subtotal: number;
  total: number;
  shippingAddress: any;
  provider?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface AdminShopOrdersParams {
  page?: number;
  limit?: number;
  statusFilter?: string;
  search?: string;
  sortField?: string;
  sortDir?: string;
}

const usePaginatedAdminShopOrders = createPaginatedAdminQuery<ShopOrder>({
  queryKey: (page, limit, statusFilter = "") =>
    [...queryKeys.admin.shopOrders(page, limit, statusFilter)] as const,
  endpoint: "/api/admin/shop/orders",
  buildParams: (page, limit, statusFilter = "") => ({
    page,
    limit,
    ...(statusFilter ? { status: statusFilter } : {}),
  }),
});

export function useAdminShopOrders(options: AdminShopOrdersParams = {}) {
  const { page = 1, limit = 20, statusFilter = "", search = "", sortField, sortDir } = options;
  return usePaginatedAdminShopOrders({
    page,
    limit,
    sortField,
    sortDir,
    search,
    args: [statusFilter],
  });
}

export function useAdminShopOrder(id: string) {
  return useQuery<ApiResponse<ShopOrder>>({
    queryKey: queryKeys.admin.shopOrder(id),
    queryFn: () => api.get<ShopOrder>(`/api/admin/shop/orders/${id}`),
    enabled: !!id,
    staleTime: STALE_TIME_ADMIN,
  });
}

const ADMIN_SHOP_ORDERS_KEY = ["admin", "shop", "orders"] as const;

export function useAdminShopOrderMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_SHOP_ORDERS_KEY });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<ApiResponse<ShopOrder>>(`/api/admin/shop/orders/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_SHOP_ORDERS_KEY });
      const previous = queryClient.getQueryData<ApiResponse<ShopOrder[]>>(ADMIN_SHOP_ORDERS_KEY);
      queryClient.setQueryData<ApiResponse<ShopOrder[]>>(ADMIN_SHOP_ORDERS_KEY, (old) =>
        old ? { ...old, data: old.data.map((o) => (o._id === id ? { ...o, status } : o)) } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(ADMIN_SHOP_ORDERS_KEY, context.previous);
    },
    onSettled: invalidateAll,
  });

  return { updateStatusMutation };
}
