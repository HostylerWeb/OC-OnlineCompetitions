import type {
  ApiResponse,
  CapturePaymentSessionResponse,
  CreatePaymentSessionRequest,
  CreatePaymentSessionResponse,
  PaymentProviderId,
  PaymentSessionStatusResponse,
} from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSessionSnapshot } from "../../auth/session-snapshot";
import { api, checkoutRequestOptions } from "../../client";
import { POLL_INTERVAL_CHECKOUT, STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";
import { buildCheckoutIdempotencyKey } from "../../lib/checkout-idempotency";

export function useCreateCheckoutSession() {
  return useMutation<
    ApiResponse<CreatePaymentSessionResponse>,
    Error,
    CreatePaymentSessionRequest & { provider?: PaymentProviderId }
  >({
    mutationFn: async (params) => {
      const userId = getSessionSnapshot().user?.id;
      const idempotencyKey =
        params.idempotencyKey ??
        (params.cartId && userId
          ? await buildCheckoutIdempotencyKey(params.cartId, userId, params.expectedCartVersion)
          : undefined);

      return api.post<CreatePaymentSessionResponse>(
        "/api/payments/session",
        { ...params, idempotencyKey },
        checkoutRequestOptions
      );
    },
  });
}

export function useCapturePaymentSession() {
  return useMutation<
    ApiResponse<CapturePaymentSessionResponse>,
    Error,
    { provider: string; sessionId: string }
  >({
    mutationFn: ({ provider, sessionId }) =>
      api.post(
        `/api/payments/session/${provider}/${sessionId}/capture`,
        {},
        checkoutRequestOptions
      ),
  });
}

export function useBalanceTopUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      api.post<ApiResponse<{ success: boolean }>>("/api/balance/top-up", { amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.my.balance() });
      qc.invalidateQueries({ queryKey: queryKeys.my.balanceTransactions() });
    },
  });
}

export function useBalanceWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { amount: number; withdrawReference?: string }) =>
      api.post<ApiResponse<{ success: boolean; message?: string }>>(
        "/api/balance/withdraw",
        params
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.my.balance() });
      qc.invalidateQueries({ queryKey: queryKeys.my.balanceTransactions() });
    },
  });
}

export function usePaymentSession(provider: string, sessionId: string | null) {
  return useQuery<ApiResponse<PaymentSessionStatusResponse>>({
    queryKey: queryKeys.payment.session(provider, sessionId ?? ""),
    queryFn: () =>
      api.get<PaymentSessionStatusResponse>(`/api/payments/session/${provider}/${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: POLL_INTERVAL_CHECKOUT,
    staleTime: STALE_TIME_USER,
  });
}
