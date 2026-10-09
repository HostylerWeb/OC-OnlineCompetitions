import type { AdminOrder, AdminUser } from "@oc/types";
import { queryKeys } from "../../keys";
import { createInfiniteAdminQuery } from "../../lib/pagination";

const useInfiniteOrdersQuery = createInfiniteAdminQuery<AdminOrder>({
  queryKey: (limit, statusFilter = "") =>
    queryKeys.admin.orders(1, statusFilter, "", limit) as readonly unknown[],
  endpoint: "/api/admin/orders",
  buildParams: (limit, statusFilter = "") => ({
    limit,
    ...(statusFilter && { status: statusFilter }),
  }),
});

const useInfiniteUsersQuery = createInfiniteAdminQuery<AdminUser>({
  queryKey: (limit, verified = "", isAdmin = "") =>
    queryKeys.admin.users(verified, isAdmin, 1, limit) as readonly unknown[],
  endpoint: "/api/admin/users",
  buildParams: (limit, verified = "", isAdmin = "") => ({
    limit,
    ...(verified && { isVerified: verified }),
    ...(isAdmin && { isAdmin }),
  }),
});

export function useInfiniteAdminOrders(statusFilter = "", limit = 20) {
  return useInfiniteOrdersQuery({ limit, args: [statusFilter] });
}

export function useInfiniteAdminUsers(verified = "", isAdmin = "", limit = 20) {
  return useInfiniteUsersQuery({ limit, args: [verified, isAdmin] });
}
