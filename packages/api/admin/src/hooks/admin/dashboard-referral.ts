import type { ApiResponse, LeaderboardEntry } from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export interface ReferralDistribution {
  tiers: number[];
  buckets: Array<{ _id: number; count: number }>;
}

export interface ReferralSummary {
  totalReferrers: number;
  ticketsMinted: number;
  ticketsRedeemed: number;
  ticketsInWallets: number;
  burnRate: number;
  purchasesRecorded: number;
  usersWithWalletBalance: number;
  activeReferralPurchases: number;
}

export type TopReferrer = LeaderboardEntry;

export interface TimeseriesPoint {
  date: string;
  tickets: number;
  purchases: number;
}

export function useAdminReferralSummary() {
  return useQuery<ApiResponse<ReferralSummary>>({
    queryKey: [queryKeys.admin.dashboard(), "referral-summary"],
    queryFn: () => api.get("/api/admin/referral-stats/summary"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminReferralDistribution() {
  return useQuery<ApiResponse<ReferralDistribution>>({
    queryKey: [queryKeys.admin.dashboard(), "referral-distribution"],
    queryFn: () => api.get("/api/admin/referral-stats/distribution"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminTopReferrers(limit = 20, includeDeleted = false) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (includeDeleted) params.set("includeDeleted", "true");
  return useQuery<ApiResponse<TopReferrer[]>>({
    queryKey: [queryKeys.admin.dashboard(), "top-referrers", limit, includeDeleted],
    queryFn: () => api.get(`/api/admin/referral-stats/top-referrers?${params.toString()}`),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminReferralTimeseries(days = 30) {
  return useQuery<ApiResponse<TimeseriesPoint[]>>({
    queryKey: [queryKeys.admin.dashboard(), "referral-timeseries", days],
    queryFn: () => api.get(`/api/admin/referral-stats/timeseries?days=${days}`),
    staleTime: STALE_TIME_ADMIN,
  });
}
