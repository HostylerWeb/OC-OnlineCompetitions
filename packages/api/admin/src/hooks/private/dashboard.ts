import type {
  ApiResponse,
  Competition,
  Entry,
  MeOrderDto,
  MyReferralsResponse,
  MyStats,
  Profile,
} from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";

export interface DashboardData {
  stats: MyStats;
  entries: Entry[];
  orders: MeOrderDto[];
  activeCompetitions: Competition[];
  profile: Profile;
  referrals: MyReferralsResponse;
}

async function fetchDashboardData(): Promise<ApiResponse<DashboardData>> {
  const [stats, entries, orders, competitions, profile, referrals] = await Promise.all([
    api.get<MyStats>("/api/me/profile/stats"),
    api.get<Entry[]>("/api/me/entries", { params: { page: 1, limit: 100 } }),
    api.get<MeOrderDto[]>("/api/me/orders", { params: { page: 1, limit: 10 } }),
    api.get<Competition[]>("/api/competitions", { params: { status: "active" } }),
    api.get<Profile>("/api/me/profile"),
    api.get<MyReferralsResponse>("/api/me/referrals"),
  ]);

  return {
    data: {
      stats: stats.data,
      entries: entries.data ?? [],
      orders: orders.data ?? [],
      activeCompetitions: competitions.data ?? [],
      profile: profile.data,
      referrals: referrals.data,
    },
  };
}

export function useDashboardData(options?: { enabled?: boolean }) {
  return useQuery<ApiResponse<DashboardData>>({
    queryKey: queryKeys.dashboard.all(),
    queryFn: fetchDashboardData,
    staleTime: STALE_TIME_USER,
    enabled: options?.enabled ?? true,
  });
}
