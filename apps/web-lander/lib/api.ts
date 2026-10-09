/**
 * Server-side API client for competition.onlinecompetitions.co.uk
 *
 * Reads NEXT_PUBLIC_CLIENT_APP_URL (or FRONTEND_URL) for server-side API calls.
 * NEXT_PUBLIC_APP_URL is the lander's own public URL only (metadata).
 *
 * NEVER import this file from client components — it is intentionally
 * free of "use client" so Next.js keeps it in the server bundle only.
 */

import { createServerAxios } from "@oc/api-axios";
import { getClientAppUrl } from "./config";
import { type AxiosError, type AxiosResponse } from "axios";

export interface Competition {
  id: string;
  _id?: string;
  title: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  status: "active" | "draft" | "ended" | "pending_draw" | "drawn" | "cancelled";
  ticketPrice: number;
  price?: number;
  originalPrice?: number;
  imageUrl?: string;
  landingPageVideoUrl?: string;
  landingPageVideoFramesPrefix?: string;
  landingPageVideoFrameCount?: number;
  landingPageVideoFps?: number;
  landingPageVideoMetadata?: {
    source: {
      width: number;
      height: number;
      fps: number;
      duration: number;
      codec: string;
      size: number;
    };
    extraction: {
      fps: number;
      width: number;
      height: number;
      quality: number;
      totalFrames: number;
    };
  };
  prizeImageUrl?: string;
  prizeImages?: string[];
  drawDate?: string;
  endDate?: string;
  startDate?: string;
  prizeValue: number;
  maxTickets: number;
  ticketsSold?: number;
  ticketsHeld?: number;
  availableTickets?: number;
  percentageTaken?: number;
  percentageSold?: number;
  totalTickets?: number;
  soldTickets?: number;
  maxTicketsPerUser?: number;
  isFeatured?: boolean;
  displayOrder?: number;
  isHeroFeatured?: boolean;
  heroImageUrl?: string;
  question?: string;
  questionOptions?: string[];
  longDescription?: string;
  terms?: string;
  faq?: string;
  currency: string;
  winnerId?: string;
  winnerTicketNumber?: number;
  winnerAnnouncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionAvailability {
  available: number;
  total: number;
  sold: number;
  held: number;
  taken: number;
  percentageSold: number;
  percentageTaken: number;
  maxPerUser: number;
  isActive: boolean;
  userOwned?: number;
  remainingForUser?: number;
}

export interface LandingPageAvailability extends CompetitionAvailability {
  instantPrizeGrantedTickets: number;
}

export interface InstantPrizeWinnerEntry {
  ticketNumber: number;
  userFullName: string;
}

export interface CompetitionInstantPrize {
  id: string;
  instantPrize: {
    title: string;
    description?: string;
    images: string[];
    value?: number;
    type?: "prize" | "competition_ticket";
    linkedCompetitionId?: string;
    linkedCompetition?: { id?: string; title: string; slug?: string; imageUrl?: string };
  };
  winningEntryNumbers: number[];
  winnerEntries: InstantPrizeWinnerEntry[];
  quantity: number;
  claimedCount: number;
  isArchived?: boolean;
}

export interface CompetitionWinner {
  _id: string;
  id?: string;
  competitionId: string | { _id: string; title?: string; prizeImageUrl?: string };
  competitionTitle?: string;
  competitionSlug?: string;
  userId: string;
  email?: string;
  entryId?: string;
  ticketNumber: number;
  prizeTitle?: string;
  prizeValue?: number;
  prizeImageUrl?: string;
  displayName?: string;
  location?: string;
  testimonial?: string;
  winnerPhotoUrl?: string;
  showFullName: boolean;
  claimed?: boolean;
  claimedAt?: string;
  drawnAt: string;
  createdAt?: string;
}

export interface LandingPageWinnerStats {
  totalWinners: number;
  totalPrizeValue: number;
}

export interface LandingPageOtherCompetition {
  slug: string;
  title: string;
  imageUrl?: string;
  prizeValue: number;
  ticketPrice: number;
}

export interface LandingPagePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CompetitionLandingPageData {
  competition: Competition & { instantPrizeGrantedTickets: number };
  availability: LandingPageAvailability;
  instantPrizes: CompetitionInstantPrize[];
  instantPrizesPagination: LandingPagePagination;
  totalInstantPrizes: number;
  winners: CompetitionWinner[];
  winnerStats: LandingPageWinnerStats;
  otherCompetitions: LandingPageOtherCompetition[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface GlobalStats {
  totalPrizeValue: number;
  totalUsers: number;
  totalEntries: number;
  totalHeldEntries: number;
  totalTakenEntries: number;
}

const serverAxios = createServerAxios({
  baseURL: getClientAppUrl(),
});

serverAxios.interceptors.response.use(
  (res: AxiosResponse) => res,
  (error: AxiosError) => {
    if (error.response) {
      const body = error.response.data as { message?: string } | undefined;
      throw new Error(body?.message ?? `HTTP ${error.response.status} — ${error.config?.url}`);
    }
    throw new Error(error.message ?? "Request failed");
  }
);

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const { data } = await serverAxios.get<T>(path, { params });
  return data;
}

export async function fetchCompetitionLandingPage(
  slug: string,
  options?: { page?: number; limit?: number }
): Promise<CompetitionLandingPageData> {
  const params: Record<string, string> = {};
  if (options?.page !== undefined) params.page = String(options.page);
  if (options?.limit !== undefined) params.limit = String(options.limit);
  const res = await apiFetch<ApiResponse<CompetitionLandingPageData>>(
    `/api/competitions/${slug}/landing-page`,
    params
  );
  return res.data;
}

export async function fetchCompetitions(options?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Competition>> {
  const params: Record<string, string> = {};
  if (options?.page !== undefined) params.page = String(options.page);
  if (options?.limit !== undefined) params.limit = String(options.limit);
  return apiFetch<PaginatedResponse<Competition>>("/api/competitions", params);
}

export async function fetchFeaturedCompetitions(): Promise<Competition[]> {
  const res = await apiFetch<ApiResponse<Competition[]>>("/api/competitions/featured");
  return res.data;
}

export async function fetchLandingPageCompetitions(options?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Competition>> {
  const params: Record<string, string> = {};
  if (options?.page !== undefined) params.page = String(options.page);
  if (options?.limit !== undefined) params.limit = String(options.limit);
  return apiFetch<PaginatedResponse<Competition>>("/api/landing-page/competitions", params);
}

export async function fetchGlobalStats(): Promise<GlobalStats> {
  const res = await apiFetch<ApiResponse<GlobalStats>>("/api/stats");
  return res.data;
}

export async function fetchCompetition(slug: string): Promise<Competition> {
  const res = await apiFetch<ApiResponse<Competition>>(`/api/competitions/${slug}`);
  return res.data;
}

export async function fetchAvailability(id: string): Promise<CompetitionAvailability> {
  const res = await apiFetch<ApiResponse<CompetitionAvailability>>(
    `/api/competitions/${id}/availability`
  );
  return res.data;
}

export async function fetchWinnersByCompetition(
  competitionId: string
): Promise<CompetitionWinner[]> {
  const res = await apiFetch<ApiResponse<CompetitionWinner[]>>(
    `/api/winners/competition/${competitionId}`
  );
  return res.data;
}

export interface CompetitionPageData {
  competition: Competition;
  availability: CompetitionAvailability;
  winners: CompetitionWinner[];
}

export async function fetchCompetitionPageData(slug: string): Promise<CompetitionPageData> {
  const competition = await fetchCompetition(slug);
  const [availability, winners] = await Promise.all([
    fetchAvailability(competition.id ?? competition._id ?? slug),
    fetchWinnersByCompetition(competition.id ?? competition._id ?? slug).catch(
      () => [] as CompetitionWinner[]
    ),
  ]);

  return { competition, availability, winners };
}
