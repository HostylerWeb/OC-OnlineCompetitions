import type {
  ApiResponse,
  RedeemReferralTicketsResponse,
  ReferralWalletResponse,
} from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";
import {
  cartIdsKeyFromItems,
  invalidateAfterCartMutation,
  readCurrentCart,
} from "../../lib/cart-mutations";

export function useMyReferralTickets(options?: { enabled?: boolean }) {
  return useQuery<ApiResponse<ReferralWalletResponse>>({
    queryKey: queryKeys.my.referralTickets(),
    queryFn: () => api.get<ReferralWalletResponse>("/api/me/tickets"),
    staleTime: STALE_TIME_USER,
    enabled: options?.enabled ?? true,
  });
}

export function useRedeemReferralTickets() {
  const qc = useQueryClient();
  return useMutation<
    ApiResponse<RedeemReferralTicketsResponse>,
    Error,
    { competitionId: string; quantity: number }
  >({
    mutationFn: (params) =>
      api.post<RedeemReferralTicketsResponse>("/api/me/tickets/redeem", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.my.referrals() });
      qc.invalidateQueries({ queryKey: queryKeys.my.entries(1, 100) });
      qc.invalidateQueries({ queryKey: queryKeys.my.entriesInfinite(200) });
      qc.invalidateQueries({ queryKey: queryKeys.competitions.all({ status: "active" }) });
      qc.invalidateQueries({ queryKey: queryKeys.competitions.availabilityBatch("") });
      invalidateAfterCartMutation(qc, {
        idsKey: cartIdsKeyFromItems(readCurrentCart(qc)?.items),
        walletChanged: true,
      });
    },
  });
}
