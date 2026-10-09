import type { CompetitionBuyingPower } from "@oc/api-client";
import type {
  Balance,
  PaymentConfigResponse,
  PaymentProviderInfo,
  Profile,
  SaferPlayState,
} from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

async function jsonFetch<T>(path: string, cookie: string): Promise<T | null> {
  const res = await serverFetch<T>(path, { cookieHeader: cookie });
  return res?.data ?? null;
}

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";
  const user = pageContext.user;
  const fetchBalance =
    user && user.isAnonymous === false
      ? jsonFetch<Balance>("/api/balance", cookie)
      : Promise.resolve(null);

  const [profile, providers, paymentConfig, saferPlay, balance] = await Promise.all([
    jsonFetch<Profile>("/api/me/profile", cookie),
    jsonFetch<PaymentProviderInfo[]>("/api/payments/providers", cookie),
    jsonFetch<PaymentConfigResponse>("/api/public/payment-config", cookie),
    user ? jsonFetch<SaferPlayState>("/api/me/safer-play", cookie) : Promise.resolve(null),
    fetchBalance,
  ]);

  let buyingPower: Record<string, CompetitionBuyingPower> | null = null;
  if (user) {
    const cartData = (pageContext as any).cartInitialData;
    const items: any[] = cartData?.data?.items ?? [];
    const ids = [...new Set(items.map((i: any) => i.competitionId).filter(Boolean))];
    if (ids.length > 0) {
      buyingPower = await jsonFetch<Record<string, CompetitionBuyingPower>>(
        `/api/competitions/buying-power-batch?ids=${ids.join(",")}`,
        cookie
      );
    }
  }

  return { profile, providers, paymentConfig, saferPlay, buyingPower, balance };
}

export type Data = Awaited<ReturnType<typeof data>>;
