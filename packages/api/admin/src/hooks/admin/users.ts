import type { AdminReferralStats, AdminUser, ApiResponse, Profile } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface AdminUsersParams {
  page?: number;
  limit?: number;
  verified?: string;
  isAdmin?: string;
  groupBy?: string;
  sortField?: string;
  sortDir?: string;
  search?: string;
}

const usePaginatedAdminUsers = createPaginatedAdminQuery<AdminUser>({
  queryKey: (page, limit, verified = "", isAdmin = "") =>
    queryKeys.admin.users(verified, isAdmin, page, limit),
  endpoint: "/api/admin/users",
  buildParams: (page, limit, verified = "", isAdmin = "") => ({
    page,
    limit,
    ...(verified && { isVerified: verified }),
    ...(isAdmin && { isAdmin }),
  }),
});

export function useAdminUsers(options: AdminUsersParams = {}) {
  const {
    page = 1,
    limit = 20,
    verified = "",
    isAdmin = "",
    groupBy,
    sortField,
    sortDir,
    search,
  } = options;
  return usePaginatedAdminUsers({
    page,
    limit,
    groupBy,
    sortField,
    sortDir,
    search,
    args: [verified, isAdmin],
  });
}

export function useAdminUser(userId: string) {
  return useQuery<ApiResponse<Profile>>({
    queryKey: queryKeys.admin.user(userId),
    queryFn: () => api.get<Profile>(`/api/admin/users/${userId}`),
    enabled: !!userId,
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminUserReferralStats(userId: string) {
  return useQuery<ApiResponse<AdminReferralStats>>({
    queryKey: queryKeys.admin.userReferralStats(userId),
    queryFn: () => api.get<AdminReferralStats>(`/api/admin/users/${userId}/referral-stats`),
    enabled: !!userId,
    staleTime: STALE_TIME_ADMIN,
  });
}

const ADMIN_USERS_KEY = ["admin", "users"] as const;

export function useAdminUserMutations(_options: AdminUsersParams = {}) {
  const qc = useQueryClient();

  const toggleAdminMutation = useMutation({
    mutationFn: ({ userId, isAdmin: next }: { userId: string; isAdmin: boolean }) =>
      api.put(`/api/admin/users/${userId}`, { isAdmin: next }),
    onMutate: async ({ userId, isAdmin: next }) => {
      await qc.cancelQueries({ queryKey: ADMIN_USERS_KEY });
      const previous = qc.getQueryData<unknown[]>(ADMIN_USERS_KEY);
      qc.setQueryData<unknown[]>(ADMIN_USERS_KEY, (old) =>
        old && typeof old === "object" && "data" in old
          ? {
              ...old,
              data: (old as { data: unknown[] }).data?.map((u: unknown) =>
                u && typeof u === "object" && "_id" in u && (u as { _id: string })._id === userId
                  ? { ...u, isAdmin: next }
                  : u
              ),
            }
          : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(ADMIN_USERS_KEY, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
  });

  const toggleVerifiedMutation = useMutation({
    mutationFn: ({ userId, isVerified: next }: { userId: string; isVerified: boolean }) =>
      api.put(`/api/admin/users/${userId}`, { isVerified: next }),
    onMutate: async ({ userId, isVerified: next }) => {
      await qc.cancelQueries({ queryKey: ADMIN_USERS_KEY });
      const previous = qc.getQueryData<unknown[]>(ADMIN_USERS_KEY);
      qc.setQueryData<unknown[]>(ADMIN_USERS_KEY, (old) =>
        old && typeof old === "object" && "data" in old
          ? {
              ...old,
              data: (old as { data: unknown[] }).data?.map((u: unknown) =>
                u && typeof u === "object" && "_id" in u && (u as { _id: string })._id === userId
                  ? { ...u, isVerified: next }
                  : u
              ),
            }
          : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(ADMIN_USERS_KEY, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
  });

  const updateReferralMultiplierMutation = useMutation({
    mutationFn: ({ userId, referralMultiplier }: { userId: string; referralMultiplier: number }) =>
      api.patch(`/api/admin/users/${userId}/referral-multiplier`, { referralMultiplier }),
    onMutate: async ({ userId, referralMultiplier }) => {
      await qc.cancelQueries({ queryKey: ADMIN_USERS_KEY });
      const previous = qc.getQueryData<unknown[]>(ADMIN_USERS_KEY);
      qc.setQueryData<unknown[]>(ADMIN_USERS_KEY, (old) =>
        old && typeof old === "object" && "data" in old
          ? {
              ...old,
              data: (old as { data: unknown[] }).data?.map((u: unknown) =>
                u && typeof u === "object" && "_id" in u && (u as { _id: string })._id === userId
                  ? { ...u, referralMultiplier }
                  : u
              ),
            }
          : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(ADMIN_USERS_KEY, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/admin/users/${userId}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
  });

  return {
    toggleAdminMutation,
    toggleVerifiedMutation,
    updateReferralMultiplierMutation,
    deleteUserMutation,
  };
}
