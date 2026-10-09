import type { CompetitionAvailability, CompetitionInstantPrizePublicDTO } from "@oc/api-client";
import type {
  PublicBonusAwardEntry,
  PublicBonusAwardWinDTO,
  RawCompetitionResponse,
} from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";
  const slug = pageContext.routeParams?.slug as string | undefined;

  const serverNow = Date.now();

  if (!slug) {
    return {
      competition: null,
      availability: null,
      instantPrizes: null,
      bonusAwards: null,
      bonusAwardWins: null,
      serverNow,
    };
  }

  const competitionRes = await serverFetch<RawCompetitionResponse>(`/api/competitions/${slug}`, {
    cookieHeader: cookie,
  });
  const competition = competitionRes?.data ?? null;
  const compId = competition?._id || competition?.id;

  if (!compId) {
    return {
      competition,
      availability: null,
      instantPrizes: null,
      bonusAwards: null,
      bonusAwardWins: null,
      serverNow,
    };
  }

  const [availabilityRes, instantPrizesRes, bonusAwardsRes, bonusAwardWinsRes] = await Promise.all([
    serverFetch<CompetitionAvailability>(`/api/competitions/${compId}/availability`, {
      cookieHeader: cookie,
    }),
    serverFetch<CompetitionInstantPrizePublicDTO[]>(`/api/competitions/${compId}/instant-prizes`, {
      cookieHeader: cookie,
    }),
    serverFetch<PublicBonusAwardEntry[]>(`/api/competitions/${compId}/bonus-awards`, {
      cookieHeader: cookie,
    }),
    serverFetch<PublicBonusAwardWinDTO[]>(`/api/competitions/${compId}/bonus-awards/wins`, {
      cookieHeader: cookie,
    }),
  ]);

  return {
    competition,
    availability: availabilityRes?.data ?? null,
    instantPrizes: instantPrizesRes?.data ?? [],
    bonusAwards: bonusAwardsRes?.data ?? [],
    bonusAwardWins: bonusAwardWinsRes?.data ?? [],
    serverNow,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
