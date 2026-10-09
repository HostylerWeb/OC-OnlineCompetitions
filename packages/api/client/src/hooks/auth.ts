import type { ApiResponse, Profile } from "@oc/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  changePassword,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  sendVerificationMagicLink,
  sendVerificationOtp,
  verifyEmailOtp,
} from "../auth/actions";
import { refreshAuthSession } from "../auth/refresh-session";
import { api } from "../client";
import { queryKeys } from "../keys";

export function useForgotPassword() {
  return useMutation({
    mutationFn: ({ email, turnstileToken }: { email: string; turnstileToken?: string }) =>
      requestPasswordResetOtp(email, turnstileToken),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({
      email,
      code,
      newPassword,
      turnstileToken,
    }: {
      email: string;
      code: string;
      newPassword: string;
      turnstileToken?: string;
    }) => resetPasswordWithOtp(email, code, newPassword, turnstileToken),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) => sendVerificationOtp(email),
  });
}

export function useSendVerificationMagicLink() {
  return useMutation({
    mutationFn: ({ email, callbackURL }: { email: string; callbackURL?: string }) =>
      sendVerificationMagicLink(email, callbackURL),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => verifyEmailOtp(email, code),
    onSuccess: async () => {
      await refreshAuthSession();
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      dateOfBirth?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      postcode?: string;
      country?: string;
      marketingConsent?: boolean;
      instagram?: string;
      facebook?: string;
      twitter?: string;
      tiktok?: string;
      youtube?: string;
      websiteUrl?: string;
      showLastName?: boolean;
      showLocation?: boolean;
      showSocials?: boolean;
    }) => api.put<Profile>("/api/me/profile", payload),
    onSuccess: async (response) => {
      qc.setQueryData(queryKeys.my.profile(), response);

      try {
        await refreshAuthSession();
      } catch {
        // Session refresh is best-effort after profile update.
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.my.profile() }),
        qc.invalidateQueries({ queryKey: queryKeys.my.stats() }),
        qc.invalidateQueries({ queryKey: queryKeys.my.wins() }),
        qc.invalidateQueries({ queryKey: queryKeys.my.referrals() }),
      ]);
    },
  });
}

export function useContactForm() {
  return useMutation({
    mutationFn: (payload: { name: string; email: string; subject: string; message: string }) =>
      api.post<ApiResponse<{ success: boolean }>>("/api/contact", payload),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => changePassword(currentPassword, newPassword),
  });
}
