"use client";
import type {
  AdminInstantPrize,
  ApiResponse,
  CompetitionInstantPrize,
  CreateCompetitionInstantPrizePayload,
  InstantPrizeCapacityParams,
  InstantPrizeCapacityResponse,
  UpdateCompetitionInstantPrizePayload,
} from "@oc/types";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  adminInstantPrizeAssignMutationOptions,
  adminInstantPrizeAssignPostOptions,
  api,
} from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface AdminInstantPrizeWinsParams {
  page?: number;
  limit?: number;
  claimedFilter?: string;
  competitionId?: string;
  userId?: string;
  groupBy?: string;
  sortField?: string;
  sortDir?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  showDeleted?: boolean;
}

export interface AdminInstantPrizeWinItem {
  _id: string;
  ticketNumber: number;
  claimed: boolean;
  claimedAt?: string;
  wonAt: string;
  entryId: string;
  prizeTitle: string;
  prizeValue: number;
  prizeType: "prize" | "competition_ticket";
  competitionTitle: string;
  competitionSlug: string;
  userEmail: string;
  userFirstName?: string;
  userLastName?: string;
  entryNumber: number;
}

const usePaginatedAdminInstantPrizeWins = createPaginatedAdminQuery<AdminInstantPrizeWinItem>({
  queryKey: (
    page,
    limit,
    claimedFilter = "",
    competitionId = "",
    userId = "",
    startDate = "",
    endDate = "",
    showDeleted = ""
  ) =>
    [
      ...queryKeys.admin.instantPrizeWins(
        claimedFilter,
        competitionId,
        userId,
        page,
        limit,
        startDate,
        endDate
      ),
      showDeleted,
    ] as const,
  endpoint: "/api/admin/instant-prize-wins",
  buildParams: (
    page,
    limit,
    claimedFilter = "",
    competitionId = "",
    userId = "",
    startDate = "",
    endDate = "",
    showDeleted = ""
  ) => ({
    page,
    limit,
    ...(claimedFilter && { claimed: claimedFilter }),
    ...(competitionId && { competitionId }),
    ...(userId && { userId }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminInstantPrizeWins(options: AdminInstantPrizeWinsParams = {}) {
  const {
    page = 1,
    limit = 20,
    claimedFilter = "",
    competitionId = "",
    userId = "",
    groupBy,
    sortField,
    sortDir,
    search,
    startDate,
    endDate,
    showDeleted,
  } = options;
  return usePaginatedAdminInstantPrizeWins({
    page,
    limit,
    groupBy,
    sortField,
    sortDir,
    search,
    args: [
      claimedFilter,
      competitionId,
      userId,
      startDate ?? "",
      endDate ?? "",
      showDeleted ? "true" : "",
    ],
  });
}

export function useAdminInstantPrizeWinMutations() {
  const queryClient = useQueryClient();

  const invalidateAllInstantPrizeWinKeys = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "instant-prize-wins"] });
    // User-facing "my instant prize wins" is keyed ["my", "instant-prize-wins"].
    void queryClient.invalidateQueries({ queryKey: ["my", "instant-prize-wins"] });
  };

  const toggleClaimedMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<{ _id: string; claimed: boolean; claimedAt?: string }>(
        `/api/admin/instant-prize-wins/${id}/claim`
      ),
    onSuccess: invalidateAllInstantPrizeWinKeys,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ _id: string }>(`/api/admin/instant-prize-wins/${id}`),
    onSuccess: invalidateAllInstantPrizeWinKeys,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: boolean }>(`/api/admin/instant-prize-wins/${id}/restore`),
    onSuccess: invalidateAllInstantPrizeWinKeys,
  });

  return { toggleClaimedMutation, deleteMutation, restoreMutation };
}

export interface AdminInstantPrizeTemplatesParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  groupBy?: string;
  sortField?: string;
  sortDir?: string;
  search?: string;
  showDeleted?: boolean;
}

const usePaginatedAdminInstantPrizeTemplates = createPaginatedAdminQuery<AdminInstantPrize>({
  queryKey: (page, limit, search = "", isActive = "", showDeleted = "") =>
    [...queryKeys.admin.instantPrizeTemplates(page, limit, search, isActive), showDeleted] as const,
  endpoint: "/api/admin/instant-prizes/templates",
  buildParams: (page, limit, search = "", isActive = "", showDeleted = "") => ({
    page,
    limit,
    ...(search ? { search } : {}),
    ...(isActive !== undefined && isActive !== "" ? { isActive } : {}),
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminInstantPrizeTemplates(options: AdminInstantPrizeTemplatesParams = {}) {
  const {
    page = 1,
    limit = 20,
    isActive,
    groupBy,
    sortField,
    sortDir,
    search = "",
    showDeleted,
  } = options;
  return usePaginatedAdminInstantPrizeTemplates({
    page,
    limit,
    groupBy,
    sortField,
    sortDir,
    search,
    args: ["", isActive !== undefined ? String(isActive) : "", showDeleted ? "true" : ""],
  });
}

export function useAdminInstantPrizeTemplateMutations() {
  const queryClient = useQueryClient();

  const invalidateAllInstantPrizeKeys = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "instant-prizes", "templates"] });
    // Public instant-prizes list keys look like
    // ["competitions", id, "instant-prizes"] — bust via the prefix.
    void queryClient.invalidateQueries({ queryKey: ["competitions"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/api/admin/instant-prizes/templates/${id}`),
    onSuccess: invalidateAllInstantPrizeKeys,
    onError: (err) => {
      if (err instanceof Error && err.message) {
        toast.error(err.message);
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<AdminInstantPrize>("/api/admin/instant-prizes/templates", payload),
    onSuccess: invalidateAllInstantPrizeKeys,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.put<AdminInstantPrize>(`/api/admin/instant-prizes/templates/${id}`, payload),
    onSuccess: invalidateAllInstantPrizeKeys,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: boolean }>(`/api/admin/instant-prizes/templates/${id}/restore`),
    onSuccess: invalidateAllInstantPrizeKeys,
  });

  return { deleteMutation, createMutation, updateMutation, restoreMutation };
}

function buildCapacitySearchParams(params: InstantPrizeCapacityParams): Record<string, string> {
  const objectId = /^[a-f\d]{24}$/i;
  const search: Record<string, string> = {};
  if (objectId.test(params.competitionId)) {
    search.competitionId = params.competitionId;
  }
  if (params.instantPrizeId && objectId.test(params.instantPrizeId)) {
    search.instantPrizeId = params.instantPrizeId;
  }
  if (
    params.quantity !== undefined &&
    Number.isInteger(params.quantity) &&
    params.quantity >= 1
  ) {
    search.quantity = String(params.quantity);
  }
  if (params.linkedCompetitionId && objectId.test(params.linkedCompetitionId)) {
    search.linkedCompetitionId = params.linkedCompetitionId;
  }
  if (
    params.ticketCount !== undefined &&
    Number.isInteger(params.ticketCount) &&
    params.ticketCount >= 1
  ) {
    search.ticketCount = String(params.ticketCount);
  }
  if (params.excludeCipId && objectId.test(params.excludeCipId)) {
    search.excludeCipId = params.excludeCipId;
  }
  return search;
}

export function useAdminInstantPrizeCapacity(
  competitionId: string,
  params: Omit<InstantPrizeCapacityParams, "competitionId"> = {},
  options: { enabled?: boolean } = {}
) {
  const queryParams = useMemo(
    () => buildCapacitySearchParams({ competitionId, ...params }),
    [
      competitionId,
      params.instantPrizeId,
      params.quantity,
      params.linkedCompetitionId,
      params.ticketCount,
      params.excludeCipId,
    ]
  );

  return useQuery<ApiResponse<InstantPrizeCapacityResponse>>({
    queryKey: queryKeys.admin.instantPrizeCapacity(competitionId, queryParams),
    queryFn: () =>
      api.get<InstantPrizeCapacityResponse>("/api/admin/competitions-instant-prizes/capacity", {
        params: queryParams,
      }),
    enabled:
      (options.enabled ?? true) &&
      !!competitionId &&
      /^[a-f\d]{24}$/i.test(competitionId) &&
      !!queryParams.competitionId,
    staleTime: STALE_TIME_ADMIN,
    placeholderData: keepPreviousData,
  });
}

export function useAdminCompetitionInstantPrizeAssignments(competitionId: string) {
  return useQuery<ApiResponse<CompetitionInstantPrize[]>>({
    queryKey: queryKeys.admin.competitionInstantPrizeAssignments(competitionId),
    queryFn: () =>
      api.get<CompetitionInstantPrize[]>(
        `/api/admin/competitions-instant-prizes?competitionId=${competitionId}`
      ),
    enabled: !!competitionId,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminCompetitionInstantPrizeAssignmentMutations() {
  const queryClient = useQueryClient();
  const invalidateCapacityQueries = (competitionId: string) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.instantPrizeCapacityBase(competitionId),
      }),
      queryClient.refetchQueries({
        queryKey: queryKeys.admin.instantPrizeCapacityBase(competitionId),
        type: "active",
      }),
    ]);
  const invalidatePublicInstantPrizes = (competitionId: string) => {
    void queryClient.invalidateQueries({
      queryKey: ["competitions", competitionId, "instant-prizes"],
    });
  };

  const listMutation = useMutation({
    mutationFn: ({ competitionId }: { competitionId: string }) =>
      api.get<CompetitionInstantPrize[]>(
        `/api/admin/competitions-instant-prizes?competitionId=${competitionId}`
      ),
  });

  const createMutation = useMutation({
    mutationFn: ({ payload }: { payload: CreateCompetitionInstantPrizePayload }) =>
      api.post<CompetitionInstantPrize>(
        `/api/admin/competitions-instant-prizes/assign`,
        payload,
        adminInstantPrizeAssignPostOptions
      ),
    onSuccess: async (_data, { payload }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.competitionInstantPrizeAssignments(payload.competitionId),
        }),
        invalidateCapacityQueries(payload.competitionId),
        invalidatePublicInstantPrizes(payload.competitionId),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCompetitionInstantPrizePayload }) =>
      api.put<CompetitionInstantPrize>(
        `/api/admin/competitions-instant-prizes/assign/${id}`,
        payload,
        adminInstantPrizeAssignMutationOptions
      ),
    onSuccess: async (data) => {
      const competitionId = data.data.competitionId;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.competitionInstantPrizeAssignments(competitionId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "competition-instant-prizes", "assignments"],
        }),
        invalidateCapacityQueries(competitionId),
        invalidatePublicInstantPrizes(competitionId),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, competitionId: _competitionId }: { id: string; competitionId: string }) =>
      api.delete<{ success: boolean }>(`/api/admin/competitions-instant-prizes/assign/${id}`),
    onSuccess: async (_data, { competitionId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.competitionInstantPrizeAssignments(competitionId),
        }),
        invalidateCapacityQueries(competitionId),
        invalidatePublicInstantPrizes(competitionId),
      ]);
    },
  });

  return { listMutation, createMutation, updateMutation, deleteMutation };
}
