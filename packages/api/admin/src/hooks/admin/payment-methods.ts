import type { AdminPaymentMethodRecord, ApiResponse } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_ADMIN } from "../../constants";
import { queryKeys } from "../../keys";

export type AdminPaymentMethod = AdminPaymentMethodRecord;

export interface AdminPaymentMethodDetail {
  provider: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  environment: "sandbox" | "live";
  credentialsSource: "environment";
  updatedAt: string;
}

export interface AdminUpdatePaymentMethodPayload {
  provider: string;
  enabled: boolean;
  environment: "sandbox" | "live";
  checkoutMode?: "hosted" | "popup";
  sandboxCredentials?: {
    clientId?: string;
    secret?: string;
    webhookId?: string;
  };
  liveCredentials?: {
    clientId?: string;
    secret?: string;
    webhookId?: string;
  };
}

export function useAdminPaymentMethods() {
  return useQuery<ApiResponse<AdminPaymentMethod[]>>({
    queryKey: queryKeys.admin.paymentMethods(),
    queryFn: async () => api.get<AdminPaymentMethod[]>("/api/admin/payment-methods"),
    staleTime: STALE_TIME_ADMIN,
  });
}

export function useAdminPaymentMethodMutations() {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (payload: AdminUpdatePaymentMethodPayload) =>
      api.put<ApiResponse<AdminPaymentMethod>>(`/api/admin/payment-methods/${payload.provider}`, {
        enabled: payload.enabled,
        environment: payload.environment,
        ...(payload.checkoutMode !== undefined ? { checkoutMode: payload.checkoutMode } : {}),
        ...(payload.sandboxCredentials ? { sandboxCredentials: payload.sandboxCredentials } : {}),
        ...(payload.liveCredentials ? { liveCredentials: payload.liveCredentials } : {}),
      }),
    onSuccess: () => {
      // Bust the admin list and the public payment-config / payment-providers
      // (the public payment config endpoint is read at checkout and on every
      // /dashboard load).
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.paymentMethods() });
      void queryClient.invalidateQueries({ queryKey: ["public", "payment"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({
      provider,
      environment,
      sandboxCredentials,
      liveCredentials,
    }: {
      provider: string;
      environment: "sandbox" | "live";
      sandboxCredentials?: { clientId?: string; secret?: string; webhookId?: string };
      liveCredentials?: { clientId?: string; secret?: string; webhookId?: string };
    }) =>
      api.post<{ success: boolean; error?: string }>(
        `/api/admin/payment-methods/${provider}/test`,
        { environment, sandboxCredentials, liveCredentials }
      ),
  });

  return { updateMutation, testMutation };
}
