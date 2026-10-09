"use client";
import type {
  AdminBonusAward,
  AdminBonusAwardAssignment,
  AdminBonusAwardWinItem,
  ApiResponse,
  BonusAwardCapacityResponse,
  CreateAssignmentPayload,
  CreateBonusAwardPayload,
  UpdateAssignmentPayload,
  UpdateBonusAwardPayload,
} from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

// ─── Template hooks ──────────────────────────────────────────────────────────

export function useAdminAllBonusAwards(
  params: {
    page?: number;
    limit?: number;
    sortField?: string;
    sortDir?: string;
    search?: string;
    showDeleted?: string;
  } = {}
) {
  const { page = 1, limit = 20, sortField, sortDir, search, showDeleted } = params;
  return useQuery<ApiResponse<AdminBonusAward[]>>({
    queryKey: [
      "admin",
      "bonus-award-templates",
      page,
      limit,
      sortField ?? "",
      sortDir ?? "",
      search ?? "",
      showDeleted ?? "",
    ],
    queryFn: () =>
      api.get<AdminBonusAward[]>("/api/admin/bonus-awards", {
        params: {
          page,
          limit,
          ...(sortField ? { sortField, sortDir } : {}),
          ...(search ? { search } : {}),
          ...(showDeleted ? { showDeleted } : {}),
        },
      }),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminBonusAward(id: string) {
  return useQuery<ApiResponse<AdminBonusAward>>({
    queryKey: ["admin", "bonus-award-template", id],
    queryFn: () => api.get<AdminBonusAward>(`/api/admin/bonus-awards/${id}`),
    enabled: !!id,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminBonusAwardTemplateMutations() {
  const queryClient = useQueryClient();

  const createTemplate = useMutation({
    mutationFn: (payload: CreateBonusAwardPayload) =>
      api.post<AdminBonusAward>("/api/admin/bonus-awards", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-templates"] });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBonusAwardPayload }) =>
      api.put<AdminBonusAward>(`/api/admin/bonus-awards/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-templates"] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) =>
      api.delete<Record<string, unknown>>(`/api/admin/bonus-awards/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-templates"] });
    },
  });

  const restoreTemplate = useMutation({
    mutationFn: (id: string) =>
      api.post<Record<string, unknown>>(`/api/admin/bonus-awards/${id}/restore`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-templates"] });
    },
  });

  return { createTemplate, updateTemplate, deleteTemplate, restoreTemplate };
}

// ─── Assignment hooks ────────────────────────────────────────────────────────

export function useAdminBonusAwardAssignments(competitionId: string) {
  return useQuery<ApiResponse<AdminBonusAwardAssignment[]>>({
    queryKey: queryKeys.admin.bonusAwardAssignments(competitionId),
    queryFn: () =>
      api.get<AdminBonusAwardAssignment[]>(
        `/api/admin/bonus-awards/competitions/${competitionId}/assignments`
      ),
    enabled: !!competitionId,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminBonusAwardCapacity(
  competitionId: string,
  params?: Record<string, unknown>
) {
  return useQuery<ApiResponse<BonusAwardCapacityResponse>>({
    queryKey: queryKeys.admin.bonusAwardCapacity(competitionId, params),
    queryFn: () =>
      api.get<BonusAwardCapacityResponse>(
        `/api/admin/bonus-awards/competitions/${competitionId}/assignments/capacity`,
        { params: params as Record<string, string | number | boolean> }
      ),
    enabled: !!competitionId,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminBonusAwardAssignmentMutations() {
  const queryClient = useQueryClient();

  const createAssignment = useMutation({
    mutationFn: ({
      competitionId,
      payload,
    }: {
      competitionId: string;
      payload: CreateAssignmentPayload;
    }) =>
      api.post<Record<string, unknown>>(
        `/api/admin/bonus-awards/competitions/${competitionId}/assignments`,
        payload
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.bonusAwardAssignments(variables.competitionId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.bonusAwardCapacity(variables.competitionId),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-templates"] });
    },
  });

  const updateAssignment = useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: UpdateAssignmentPayload;
      competitionId: string;
    }) =>
      api.patch<Record<string, unknown>>(
        `/api/admin/bonus-awards/assignments/${assignmentId}`,
        payload
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.bonusAwardAssignments(variables.competitionId),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-templates"] });
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: ({ assignmentId }: { assignmentId: string; competitionId: string }) =>
      api.delete<Record<string, unknown>>(`/api/admin/bonus-awards/assignments/${assignmentId}`),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.bonusAwardAssignments(variables.competitionId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.bonusAwardCapacity(variables.competitionId),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-templates"] });
    },
  });

  const restoreAssignment = useMutation({
    mutationFn: (assignmentId: string) =>
      api.post<Record<string, unknown>>(
        `/api/admin/bonus-awards/assignments/${assignmentId}/restore`
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-assignments"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-templates"] });
    },
  });

  return { createAssignment, updateAssignment, deleteAssignment, restoreAssignment };
}

// ─── Wins hooks ───────────────────────────────────────────────────────────────

export function useAdminBonusAwardWins(params: Record<string, unknown>) {
  return useQuery<ApiResponse<AdminBonusAwardWinItem[]>>({
    queryKey: queryKeys.admin.bonusAwardWins(params),
    queryFn: async () => {
      const res = await api.get<AdminBonusAwardWinItem[]>("/api/admin/bonus-awards/wins", {
        params: params as Record<string, string | number | boolean>,
      });
      return {
        data: res.data,
        meta: {
          page: res.meta?.page ?? 1,
          limit: res.meta?.limit ?? 20,
          total: res.meta?.total ?? 0,
          pages: res.meta?.pages ?? 1,
          hasMore: res.meta?.hasMore ?? false,
        },
      };
    },
  });
}

export function useAdminBonusAwardWinMutations() {
  const queryClient = useQueryClient();

  const toggleClaimedMutation = useMutation({
    mutationFn: ({ winId, claimed }: { winId: string; claimed: boolean }) =>
      api.patch<Record<string, unknown>>(`/api/admin/bonus-awards/wins/${winId}/claim`, {
        claimed,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-wins"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (winId: string) =>
      api.delete<Record<string, unknown>>(`/api/admin/bonus-awards/wins/${winId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-wins"] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (winId: string) =>
      api.post<Record<string, unknown>>(`/api/admin/bonus-awards/wins/${winId}/restore`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-wins"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: { action: string; ids: string[] }) =>
      api.post<Record<string, unknown>>("/api/admin/bonus-awards/wins/bulk", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-wins"] });
    },
  });

  return { toggleClaimedMutation, deleteMutation, restoreMutation, bulkMutation };
}
