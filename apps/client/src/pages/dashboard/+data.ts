import type {
  Competition,
  Entry,
  MeOrderDto,
  MyReferralsResponse,
  MyStats,
  Profile,
} from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const [stats, entries, orders, competitions, profile, referrals, tickets] = await Promise.all([
    jsonFetch<MyStats>("/api/me/profile/stats", cookie),
    jsonFetch<Entry[]>("/api/me/entries?page=1&limit=100", cookie),
    jsonFetch<MeOrderDto[]>("/api/me/orders?page=1&limit=10", cookie),
    jsonFetch<Competition[]>("/api/competitions?status=active", cookie),
    jsonFetch<Profile>("/api/me/profile", cookie),
    jsonFetch<MyReferralsResponse>("/api/me/referrals", cookie),
    jsonFetch<unknown>("/api/me/tickets", cookie),
  ]);

  const defReferrals: MyReferralsResponse = {
    referralCode: null,
    totalReferralCount: 0,
    activeReferralCount: 0,
    pendingReferralCount: 0,
    tierTickets: 0,
    referralsToNextTier: 0,
    totalAwardedTickets: 0,
    walletBalance: 0,
    referralMultiplier: 1,
    recentReferrals: [],
    leaderboard: [],
  };

  return {
    dashboardData: {
      stats: stats ?? {
        activeEntries: 0,
        totalWins: 0,
        competitionWins: 0,
        instantWins: 0,
        bonusWins: 0,
        totalSpent: 0,
        totalEntries: 0,
      },
      entries: entries ?? [],
      orders: orders ?? [],
      activeCompetitions: competitions ?? [],
      profile: profile ?? ({} as Profile),
      referrals: referrals ?? defReferrals,
    },
    referralTicketsData: tickets,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
