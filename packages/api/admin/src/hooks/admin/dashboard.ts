import type { ApiResponse } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export interface AdminDashboardStats {
  totalRevenue: number;
  totalUsers: number;
  activeCompetitions: number;
  totalCompetitions: number;
  totalOrders: number;
  ticketsSold: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
  totalPrizeValue: number;
  recentOrders: Array<{
    orderNumber: number;
    email: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
  recentWinners: Array<{
    competitionTitle: string;
    email: string;
    displayName: string;
    prizeValue: number;
    drawnAt: string;
  }>;
  _sortableFields?: {
    recentOrders: readonly string[];
    recentWinners: readonly string[];
  };
}

export interface AdminDebugStats {
  mongodb: {
    readyState: number;
    readyStateLabel: string;
    host: string;
    port: string;
    protocol: string;
    database: string;
    databaseFromUri: string;
    uriMismatch: boolean;
    options: string;
    hasCredentials: boolean;
    user: string | null;
    mongoUriMasked: string;
    serverVersion: string;
    mongoVersion: string;
    connections: { current: unknown; available: unknown };
    uptime: unknown;
  };
  competitions: {
    total: number;
    byStatus: Record<string, number>;
    list: Array<{
      _id: string;
      slug: string;
      status: string;
      ticketsSold: number;
      maxTickets: number;
      drawDate: string | null;
      prizeValue: number;
    }>;
  };
  categories: {
    total: number;
    active: number;
    list: Array<{ _id: string; slug: string; name: string; isActive: boolean }>;
  };
  users: { total: number; verified: number; admins: number };
  winners: { total: number; claimed: number };
  promoCodes: {
    total: number;
    active: number;
    list: Array<{
      _id: string;
      code: string;
      discountType: string;
      discountValue: number;
      isActive: boolean;
      currentUses: number;
      maxUses: number | null;
    }>;
  };
  env: Record<string, string>;
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    pid: number;
    uptimeSeconds: number;
    memoryUsage: { heapUsed: string; heapTotal: string; rss: string; external: string };
    timestamp: string;
  };
  stats: {
    competitions: number;
    categories: number;
    users: number;
    winners: number;
    promoCodes: number;
  };
}

export function useAdminDashboardStats(sortField?: string, sortDir?: string) {
  return useQuery<ApiResponse<AdminDashboardStats>>({
    queryKey: [...queryKeys.admin.dashboard(), sortField ?? "", sortDir ?? ""],
    queryFn: () =>
      api.get("/api/admin/dashboard/stats", {
        params: sortField ? { sortField, sortDir: sortDir ?? "desc" } : undefined,
      }),
    staleTime: sortField ? 0 : STALE_TIME_ADMIN,
  });
}

export function useAdminDebugStats() {
  return useQuery<ApiResponse<AdminDebugStats>>({
    queryKey: queryKeys.admin.debug(),
    queryFn: () => api.get("/api/debug"),
    staleTime: STALE_TIME_ADMIN,
  });
}
