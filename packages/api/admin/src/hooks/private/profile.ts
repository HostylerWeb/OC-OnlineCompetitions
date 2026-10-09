"use client";
import type {
  ApiResponse,
  MyReferralsResponse,
  MyStats,
  Profile,
  ProfileAddress,
  Winner,
} from "@oc/types";
import { getProfileInitials, withAssetCacheVersion } from "@oc/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "../../auth/use-auth";
import { api } from "../../client";
import { STALE_TIME_STATIC, STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";
import { useUpdateProfile } from "../auth";

function profileAddressFromProfile(profile: Profile): ProfileAddress {
  return {
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    postcode: profile.postcode ?? "",
    country: profile.country ?? "GB",
  };
}

function getProfileAddressUpdates(
  current: ProfileAddress,
  next: ProfileAddress
): Partial<ProfileAddress> {
  const updates: Partial<ProfileAddress> = {};

  for (const key of Object.keys(next) as (keyof ProfileAddress)[]) {
    const currentValue = current[key] ?? "";
    const nextValue = next[key] ?? "";
    if (currentValue !== nextValue) {
      updates[key] = nextValue;
    }
  }

  return updates;
}

export function useMyProfile(options?: { enabled?: boolean }) {
  return useQuery<ApiResponse<Profile>>({
    queryKey: queryKeys.my.profile(),
    queryFn: () => api.get<Profile>("/api/me/profile"),
    staleTime: STALE_TIME_STATIC,
    refetchOnMount: false,
    enabled: options?.enabled ?? true,
  });
}

export function useProfileAvatar(options?: { enabled?: boolean }) {
  const { user, isAnonymous } = useAuth();
  const enabled = (options?.enabled ?? true) && Boolean(user) && !isAnonymous;
  const { data: profileResponse, isLoading } = useMyProfile({ enabled });
  const profile = profileResponse?.data;

  const avatarUrl = useMemo(
    () => withAssetCacheVersion(profile?.avatarUrl, profile?.updatedAt),
    [profile?.avatarUrl, profile?.updatedAt]
  );
  const initials = useMemo(
    () =>
      getProfileInitials({
        firstName: profile?.firstName ?? user?.firstName,
        lastName: profile?.lastName ?? user?.lastName,
        email: profile?.email ?? user?.email,
      }),
    [
      profile?.email,
      profile?.firstName,
      profile?.lastName,
      user?.email,
      user?.firstName,
      user?.lastName,
    ]
  );

  return { avatarUrl, initials, profile, user, isLoading, enabled };
}

export function useMyStats() {
  return useQuery<ApiResponse<MyStats>>({
    queryKey: queryKeys.my.stats(),
    queryFn: () => api.get<MyStats>("/api/me/profile/stats"),
    staleTime: STALE_TIME_USER,
  });
}

export function useMyWins() {
  return useQuery<ApiResponse<Winner[]>>({
    queryKey: queryKeys.my.wins(),
    queryFn: () => api.get<Winner[]>("/api/me/profile/wins"),
    staleTime: STALE_TIME_USER,
  });
}

export function useMyReferrals(options?: { enabled?: boolean }) {
  return useQuery<ApiResponse<MyReferralsResponse>>({
    queryKey: queryKeys.my.referrals(),
    queryFn: () => api.get<MyReferralsResponse>("/api/me/referrals"),
    staleTime: STALE_TIME_USER,
    enabled: options?.enabled ?? true,
  });
}

function syncMyProfileCache(qc: ReturnType<typeof useQueryClient>, response: ApiResponse<Profile>) {
  qc.setQueryData(queryKeys.my.profile(), response);
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post<Profile>("/api/me/profile/avatar", formData);
    },
    onSuccess: (response) => {
      syncMyProfileCache(qc, response);
    },
  });
}

export function useDeleteAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<Profile>("/api/me/profile/avatar"),
    onSuccess: (response) => {
      syncMyProfileCache(qc, response);
    },
  });
}

export function useImportGoogleAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Profile>("/api/me/profile/avatar/import-google"),
    onSuccess: (response) => {
      syncMyProfileCache(qc, response);
    },
  });
}

export function useSyncProfileAddressIfChanged() {
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();

  return useCallback(
    async (address: ProfileAddress, phone?: string) => {
      const cached = queryClient.getQueryData<ApiResponse<Profile>>(queryKeys.my.profile());
      const profile = cached?.data;

      if (!profile) {
        throw new Error("Unable to load profile. Please refresh and try again.");
      }

      const payload: Parameters<typeof updateProfile.mutateAsync>[0] = {
        ...getProfileAddressUpdates(profileAddressFromProfile(profile), address),
      };

      if (phone !== undefined && phone !== (profile.phone ?? "")) {
        payload.phone = phone;
      }

      if (Object.keys(payload).length === 0) {
        return;
      }

      await updateProfile.mutateAsync(payload);
    },
    [queryClient, updateProfile]
  );
}
