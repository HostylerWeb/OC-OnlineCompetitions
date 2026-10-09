// React Query mutation hooks for cart writes.
import type {
  ApiResponse,
  CartAdjustment,
  CartItem,
  CartItemInput,
  CartWalletTicket,
  ICart,
} from "@oc/types";
import {
  type QueryClient,
  type UseMutationResult,
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../client";
import { queryKeys } from "../../keys";
import {
  applyCartOptimistic,
  type CartOptimisticContext,
  cartIdsKeyFromItems,
  invalidateAfterCartMutation,
  readCurrentCart,
  rollbackCartOptimistic,
} from "../../lib/cart-mutations";
import { useCartUiStore } from "../../stores/cart-ui";

const CART_MUTATION_BASE_KEY = ["cart", "mutate"] as const;

const cartDebug = (_label: string, _payload?: unknown) => {};

function settleCartMutation(
  qc: QueryClient,
  options: { walletChanged?: boolean; invalidateCart?: boolean } = {}
): void {
  const current = readCurrentCart(qc);
  invalidateAfterCartMutation(qc, {
    idsKey: cartIdsKeyFromItems(current?.items),
    walletChanged: options.walletChanged ?? false,
    invalidateCart: options.invalidateCart ?? true,
  });
}

function toastAutoAdjustments(adjustments: CartAdjustment[] | undefined | null): void {
  if (!adjustments || adjustments.length === 0) return;
  const dismissed = useCartUiStore.getState().dismissedAdjustmentIds;
  for (const adj of adjustments) {
    if (!dismissed.has(adj.id) && adj.previousQuantity !== adj.adjustedQuantity) {
      toast.warning(adj.message);
    }
  }
  useCartUiStore.getState().clearDismissed();
}

function buildOptimisticItem(input: CartItemInput): CartItem {
  return {
    competitionId: input.competitionId,
    competitionSlug: "",
    competitionTitle: "",
    price: 0,
    quantity: input.quantity,
    answerIndex: input.answerIndex ?? 0,
    maxTicketsPerUser: Number.MAX_SAFE_INTEGER,
  };
}

function upsertCartItem(items: CartItem[], input: CartItemInput): CartItem[] {
  const index = items.findIndex((item) => item.competitionId === input.competitionId);
  if (index === -1) {
    return [...items, buildOptimisticItem(input)];
  }
  const next = [...items];
  const existing = next[index]!;
  next[index] = {
    ...existing,
    quantity: existing.quantity + input.quantity,
    answerIndex: input.answerIndex ?? existing.answerIndex,
  };
  return next;
}

function setCartItemQuantity(
  items: CartItem[],
  competitionId: string,
  quantity: number,
  answerIndex?: number
): CartItem[] {
  return items.map((item) =>
    item.competitionId === competitionId
      ? {
          ...item,
          quantity,
          answerIndex: answerIndex ?? item.answerIndex,
        }
      : item
  );
}

function removeCartItem(items: CartItem[], competitionId: string): CartItem[] {
  return items.filter((item) => item.competitionId !== competitionId);
}

export interface AddCartItemPayload extends CartItemInput {}

export function useAddCartItem(): UseMutationResult<
  ApiResponse<ICart>,
  Error,
  AddCartItemPayload,
  CartOptimisticContext
> {
  const qc = useQueryClient();
  return useMutation<ApiResponse<ICart>, Error, AddCartItemPayload, CartOptimisticContext>({
    mutationKey: [...CART_MUTATION_BASE_KEY, "addItem"],
    mutationFn: (payload) => {
      cartDebug("[CART-DEBUG-FE] useAddCartItem mutationFn:", payload);
      cartDebug("[FS-DEBUG-FE][cart.add] firing mutation:", {
        competitionId: payload.competitionId,
        quantity: payload.quantity,
      });
      return api.post<ICart>("/api/cart/items", payload);
    },
    onMutate: (payload) => {
      cartDebug("[CART-DEBUG-FE] useAddCartItem onMutate:", payload);
      return applyCartOptimistic(qc, (cart) => ({
        ...cart,
        items: upsertCartItem(cart.items ?? [], payload),
      }));
    },
    onError: (_err, _vars, context) => {
      cartDebug("[CART-DEBUG-FE] useAddCartItem onError", {
        message: _err?.message,
        payload: _vars,
      });
      cartDebug("[FS-DEBUG-FE][cart.add.error]", _err?.message);
      rollbackCartOptimistic(qc, context?.snapshot);
    },
    onSuccess: (response) => {
      cartDebug("[CART-DEBUG-FE] useAddCartItem onSuccess", {
        id: response?.data?.id,
        itemsCount: response?.data?.items?.length,
        items: response?.data?.items?.map((i) => ({ compId: i.competitionId, qty: i.quantity })),
        adjustments: response?.data?.autoAdjustments?.length,
      });
      cartDebug("[FS-DEBUG-FE][cart.add.success]", { itemsCount: response?.data?.items?.length });
      qc.setQueryData(queryKeys.cart(), response);
      toastAutoAdjustments(response?.data?.autoAdjustments);
    },
    onSettled: () => {
      cartDebug("");
      settleCartMutation(qc);
    },
  });
}

export interface UpdateCartItemPayload {
  competitionId: string;
  quantity: number;
  answerIndex?: number;
}

export function useUpdateCartItem(): UseMutationResult<
  ApiResponse<ICart>,
  Error,
  UpdateCartItemPayload,
  CartOptimisticContext
> {
  const qc = useQueryClient();
  return useMutation<ApiResponse<ICart>, Error, UpdateCartItemPayload, CartOptimisticContext>({
    mutationKey: [...CART_MUTATION_BASE_KEY, "updateItem"],
    mutationFn: ({ competitionId, quantity, answerIndex }) => {
      cartDebug("[CART-DEBUG-FE] useUpdateCartItem mutationFn:", {
        competitionId,
        quantity,
        answerIndex,
      });
      cartDebug("[FS-DEBUG-FE][cart.update] firing mutation:", { competitionId, quantity });
      return api.put<ICart>(`/api/cart/items/${competitionId}`, { quantity, answerIndex });
    },
    onMutate: ({ competitionId, quantity, answerIndex }) => {
      cartDebug("[CART-DEBUG-FE] useUpdateCartItem onMutate:", {
        competitionId,
        quantity,
        answerIndex,
      });
      return applyCartOptimistic(qc, (cart) => ({
        ...cart,
        items: setCartItemQuantity(cart.items ?? [], competitionId, quantity, answerIndex),
      }));
    },
    onError: (_err, _vars, context) => {
      cartDebug("[CART-DEBUG-FE] useUpdateCartItem onError:", _err?.message);
      cartDebug("[FS-DEBUG-FE][cart.update.error]", _err?.message);
      rollbackCartOptimistic(qc, context?.snapshot);
    },
    onSuccess: (response) => {
      cartDebug("[CART-DEBUG-FE] useUpdateCartItem onSuccess", {
        itemsCount: response?.data?.items?.length,
        items: response?.data?.items?.map((i) => ({ compId: i.competitionId, qty: i.quantity })),
      });
      cartDebug("[FS-DEBUG-FE][cart.update.success]", {
        itemsCount: response?.data?.items?.length,
      });
      qc.setQueryData(queryKeys.cart(), response);
      toastAutoAdjustments(response?.data?.autoAdjustments);
    },
    onSettled: () => {
      cartDebug("");
      settleCartMutation(qc);
    },
  });
}

export function useRemoveCartItem(): UseMutationResult<
  ApiResponse<ICart>,
  Error,
  string,
  CartOptimisticContext
> {
  const qc = useQueryClient();
  return useMutation<ApiResponse<ICart>, Error, string, CartOptimisticContext>({
    mutationKey: [...CART_MUTATION_BASE_KEY, "removeItem"],
    mutationFn: (competitionId) => {
      cartDebug("[FS-DEBUG-FE][cart.remove] firing mutation:", { competitionId });
      return api.delete<ICart>(`/api/cart/items/${competitionId}`);
    },
    onMutate: (competitionId) => {
      cartDebug("[FS-DEBUG-FE][cart.remove.mutate] competitionId:", competitionId);
      return applyCartOptimistic(qc, (cart) => ({
        ...cart,
        items: removeCartItem(cart.items ?? [], competitionId),
        walletTicketsByCompetition: (cart.walletTicketsByCompetition ?? []).filter(
          (entry) => entry.competitionId !== competitionId
        ),
      }));
    },
    onError: (_err, _vars, context) => {
      cartDebug("[FS-DEBUG-FE][cart.remove.error] competitionId:", _vars);
      cartDebug("[FS-DEBUG-FE][cart.remove.error] message:", _err?.message);
      rollbackCartOptimistic(qc, context?.snapshot);
    },
    onSuccess: (response) => {
      cartDebug("[FS-DEBUG-FE][cart.remove.success] itemsCount:", response?.data?.items?.length);
      qc.setQueryData(queryKeys.cart(), response);
      toastAutoAdjustments(response?.data?.autoAdjustments);
    },
    onSettled: () => {
      cartDebug("");
      settleCartMutation(qc, { walletChanged: true });
    },
  });
}

export function useClearCart(): UseMutationResult<
  ApiResponse<ClearCartResponse>,
  Error,
  void,
  CartOptimisticContext
> {
  const qc = useQueryClient();
  return useMutation<ApiResponse<ClearCartResponse>, Error, void, CartOptimisticContext>({
    mutationKey: [...CART_MUTATION_BASE_KEY, "clear"],
    mutationFn: () => api.delete<ClearCartResponse>("/api/cart/items"),
    onMutate: () =>
      applyCartOptimistic(qc, (cart) => ({
        ...cart,
        items: [],
        walletTicketsByCompetition: [],
        walletTicketsTotal: 0,
        walletTicketSavings: 0,
        promoCode: undefined,
        referralCode: undefined,
        referralDiscountAmount: 0,
        referralDiscountPercent: 0,
        referralLocked: false,
        discountAmount: 0,
        discountType: null,
        subtotal: 0,
        monetarySubtotal: 0,
        total: 0,
        autoAdjustments: [],
      })),
    onError: (_err, _vars, context) => {
      rollbackCartOptimistic(qc, context?.snapshot);
    },
    onSuccess: (response) => {
      // Backend returns a partial cart (id + empty items + totals), not a full ICart.
      // Invalidate the cart query so the next read refetches the authoritative state.
      void response;
    },
    onSettled: () => {
      settleCartMutation(qc, { walletChanged: true });
    },
  });
}

export type CartDiscountCodeType = "promo" | "referral" | "pending_referral";

export interface ApplyCartDiscountPayload {
  code: string;
  codeType?: CartDiscountCodeType;
}

export interface ApplyDiscountResponse {
  valid: boolean;
  code?: string;
  codeType?: "promo" | "referral" | "pending_referral";
  discountAmount?: number;
  discountType?: "percentage" | "fixed" | null;
  discountValue?: number;
  error?: string;
  total?: number;
  adjustments?: CartAdjustment[];
}

export interface ClearCartResponse {
  id: string;
  items: [];
  reclampedAllocations: [];
  walletTicketsByCompetition: [];
  promoCode?: string;
  discountAmount: number;
  discountType: "percentage" | "fixed" | null;
  subtotal: number;
  total: number;
}

export interface RemoveDiscountResponse {
  promoCode?: string;
  discountAmount: number;
  discountType: "percentage" | "fixed" | null;
  subtotal: number;
  total: number;
}

export function useApplyCartDiscount(): UseMutationResult<
  ApiResponse<ApplyDiscountResponse>,
  Error,
  ApplyCartDiscountPayload,
  CartOptimisticContext
> {
  const qc = useQueryClient();
  return useMutation<
    ApiResponse<ApplyDiscountResponse>,
    Error,
    ApplyCartDiscountPayload,
    CartOptimisticContext
  >({
    mutationKey: [...CART_MUTATION_BASE_KEY, "applyDiscount"],
    mutationFn: (payload) => {
      cartDebug("[FS-DEBUG-FE][cart.applyDiscount] firing mutation:", {
        code: payload.code,
        codeType: payload.codeType,
      });
      return api.post<ApplyDiscountResponse>("/api/cart/discount", payload);
    },
    onMutate: ({ code, codeType }) => {
      cartDebug("[FS-DEBUG-FE][cart.applyDiscount.mutate]", { code, codeType });
      return applyCartOptimistic(qc, (cart) => {
        if (codeType === "referral" || codeType === "pending_referral") {
          return { ...cart, referralCode: code };
        }
        return { ...cart, promoCode: code };
      });
    },
    onError: (_err, _vars, context) => {
      cartDebug("[FS-DEBUG-FE][cart.applyDiscount.error]", _err?.message);
      rollbackCartOptimistic(qc, context?.snapshot);
    },
    onSuccess: (response) => {
      cartDebug("[FS-DEBUG-FE][cart.applyDiscount.success]", {
        valid: response?.data?.valid,
        code: response?.data?.code,
      });
      toastAutoAdjustments(response?.data?.adjustments);
    },
    onSettled: () => {
      invalidateAfterCartMutation(qc, {});
    },
  });
}

export function useRemoveCartDiscount(): UseMutationResult<
  ApiResponse<RemoveDiscountResponse>,
  Error,
  void,
  CartOptimisticContext
> {
  const qc = useQueryClient();
  return useMutation<ApiResponse<RemoveDiscountResponse>, Error, void, CartOptimisticContext>({
    mutationKey: [...CART_MUTATION_BASE_KEY, "removeDiscount"],
    mutationFn: () => api.delete<RemoveDiscountResponse>("/api/cart/discount"),
    onMutate: () =>
      applyCartOptimistic(qc, (cart) => ({
        ...cart,
        promoCode: undefined,
        referralCode: undefined,
        referralDiscountAmount: 0,
        referralDiscountPercent: 0,
        discountAmount: 0,
        discountType: null,
      })),
    onError: (_err, _vars, context) => {
      rollbackCartOptimistic(qc, context?.snapshot);
    },
    onSuccess: (response) => {
      // Backend returns a partial response (totals only), not a full cart.
      // The cart query will be invalidated by onSettled, so the next read refreshes.
      void response;
    },
    onSettled: () => {
      settleCartMutation(qc);
    },
  });
}

export interface ApplyCartWalletPayload {
  walletTicketsByCompetition: CartWalletTicket[];
}

export function useApplyCartWallet(): UseMutationResult<
  ApiResponse<ICart>,
  Error,
  ApplyCartWalletPayload,
  CartOptimisticContext
> {
  const qc = useQueryClient();
  return useMutation<ApiResponse<ICart>, Error, ApplyCartWalletPayload, CartOptimisticContext>({
    mutationKey: [...CART_MUTATION_BASE_KEY, "applyWallet"],
    mutationFn: (payload) => {
      cartDebug("[FS-DEBUG-FE][cart.applyWallet] firing mutation:", {
        walletTicketsCount: payload.walletTicketsByCompetition?.length,
      });
      return api.put<ICart>("/api/cart/wallet", payload);
    },
    onMutate: ({ walletTicketsByCompetition }) => {
      cartDebug(
        "[FS-DEBUG-FE][cart.applyWallet.mutate] walletTicketsCount:",
        walletTicketsByCompetition?.length
      );
      return applyCartOptimistic(qc, (cart) => ({
        ...cart,
        walletTicketsByCompetition,
      }));
    },
    onError: (_err, _vars, context) => {
      cartDebug("[FS-DEBUG-FE][cart.applyWallet.error]", _err?.message);
      rollbackCartOptimistic(qc, context?.snapshot);
    },
    onSuccess: (response) => {
      cartDebug("[FS-DEBUG-FE][cart.applyWallet.success]", {
        itemsCount: response?.data?.items?.length,
      });
      qc.setQueryData(queryKeys.cart(), response);
      toastAutoAdjustments(response?.data?.autoAdjustments);
    },
    onSettled: () => {
      settleCartMutation(qc, { walletChanged: true, invalidateCart: false });
    },
  });
}

export function useIsApplyingCartMutation(): boolean {
  return useIsMutating({ mutationKey: CART_MUTATION_BASE_KEY }) > 0;
}
