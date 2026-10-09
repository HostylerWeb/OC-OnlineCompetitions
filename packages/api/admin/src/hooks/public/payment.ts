import type {
  ApiResponse,
  PaymentConfigResponse,
  PaymentProviderInfo,
  StripePublicConfig,
} from "@oc/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_PUBLIC } from "../../constants";
import { queryKeys } from "../../keys";

export type { PaymentProviderInfo, StripePublicConfig };

export function usePaymentConfig() {
  return useQuery<ApiResponse<PaymentConfigResponse>>({
    queryKey: queryKeys.payment.config(),
    queryFn: () => api.get<PaymentConfigResponse>("/api/public/payment-config"),
    staleTime: STALE_TIME_PUBLIC,
  });
}

export function usePaymentProviders() {
  return useQuery<ApiResponse<PaymentProviderInfo[]>>({
    queryKey: queryKeys.payment.providers(),
    queryFn: () => api.get<PaymentProviderInfo[]>("/api/payments/providers"),
    staleTime: STALE_TIME_PUBLIC,
  });
}

export function parsePaymentConfigPayload(
  payload: unknown
): PaymentConfigResponse["config"] | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  if ("config" in payload && (payload as PaymentConfigResponse).config) {
    return (payload as PaymentConfigResponse).config;
  }
  return payload as PaymentConfigResponse["config"];
}

export function parseStripeConfig(payload: unknown): StripePublicConfig | undefined {
  const config = parsePaymentConfigPayload(payload);
  const stripe = config?.stripe;
  if (!stripe || typeof stripe !== "object") return undefined;
  return stripe as StripePublicConfig;
}
