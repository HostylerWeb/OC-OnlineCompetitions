import type { ApiResponse } from "@oc/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface AdminWinnerItem {
  _id: string;
  competitionId: string;
  competitionSlug: string;
  competitionTitle: string;
  displayName?: string;
  location?: string;
  testimonial?: string;
  prizeTitle?: string;
  prizeValue: number;
  ticketNumber: string;
  email?: string;
  userId?: string;
  prizeImageUrl?: string | null;
  winnerPhotoUrl?: string | null;
  claimed: boolean;
  drawnAt: string;
}

export interface AdminWinnersParams {
  page?: number;
  limit?: number;
  claimedFilter?: string;
  competitionId?: string;
  userId?: string;
  groupBy?: string;
  sortField?: string;
  sortDir?: string;
  search?: string;
  columnSearch?: Record<string, string>;
  showDeleted?: boolean;
}

const usePaginatedAdminWinners = createPaginatedAdminQuery<AdminWinnerItem>({
  queryKey: (page, limit, claimedFilter = "", competitionId = "", userId = "", showDeleted = "") =>
    [
      ...queryKeys.admin.winners(claimedFilter, competitionId, userId, page, limit),
      showDeleted,
    ] as const,
  endpoint: "/api/admin/winners",
  buildParams: (
    page,
    limit,
    claimedFilter = "",
    competitionId = "",
    userId = "",
    showDeleted = ""
  ) => ({
    page,
    limit,
    ...(claimedFilter && { claimed: claimedFilter }),
    ...(competitionId && { competitionId }),
    ...(userId && { userId }),
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminWinners(options: AdminWinnersParams = {}) {
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
    columnSearch,
    showDeleted,
  } = options;
  return usePaginatedAdminWinners({
    page,
    limit,
    groupBy,
    sortField,
    sortDir,
    search,
    columnSearch,
    args: [claimedFilter, competitionId, userId, showDeleted ? "true" : ""],
  });
}

export function useAdminWinnerMutations() {
  const queryClient = useQueryClient();

  const invalidateAllWinnerKeys = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "winners"] });
    // Public winners lists and the dashboard winners banner
    void queryClient.invalidateQueries({ queryKey: ["winners"] });
    // Winners sometimes also affect the user-facing "my wins" view
    void queryClient.invalidateQueries({ queryKey: ["my", "wins"] });
  };

  const toggleClaimedMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.patch<ApiResponse<{ success: boolean }>>(`/api/admin/winners/${id}/claim`),
    onSuccess: invalidateAllWinnerKeys,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/api/admin/winners/${id}`),
    onSuccess: invalidateAllWinnerKeys,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<{ success: boolean }>>(`/api/admin/winners/${id}/restore`),
    onSuccess: invalidateAllWinnerKeys,
  });

  return { toggleClaimedMutation, deleteMutation, restoreMutation };
}
