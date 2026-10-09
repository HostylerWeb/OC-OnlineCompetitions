// React Query source of truth for cart reads. Selectors + convenience hooks below re-render only when the selected slice changes.
import type { ApiResponse, CartAdjustment, CartItem, CartWalletTicket, ICart } from "@oc/types";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";

const CART_REFETCH_INTERVAL_MS = 10_000;

export interface UseCartOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
  initialData?: ApiResponse<ICart>;
}

export function cartQueryOptions(options?: UseCartOptions) {
  const interval =
    options?.refetchInterval !== undefined ? options.refetchInterval : CART_REFETCH_INTERVAL_MS;
  return {
    queryKey: queryKeys.cart(),
    queryFn: async () => {
      const res = await api.get<ICart>("/api/cart");
      return res;
    },
    staleTime: STALE_TIME_USER,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: interval,
    enabled: options?.enabled ?? true,
    ...(options?.initialData !== undefined && { initialData: options.initialData }),
  } as const;
}

export function useCart(options?: UseCartOptions): UseQueryResult<ApiResponse<ICart>, Error> {
  return useQuery<ApiResponse<ICart>, Error>({
    ...cartQueryOptions(options),
  });
}

export function selectCartItems(cart?: ICart | null): CartItem[] {
  return (cart?.items ?? []) as CartItem[];
}

export function selectCartCount(cart?: ICart | null): number {
  return selectCartItems(cart).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

export function selectCartSubtotal(cart?: ICart | null): number {
  return cart?.subtotal ?? 0;
}

export function selectCartTotal(cart?: ICart | null): number {
  return cart?.total ?? 0;
}

export interface CartTotals {
  subtotal: number;
  monetarySubtotal: number;
  total: number;
  walletTicketsTotal: number;
}

export function selectCartTotals(cart?: ICart | null): CartTotals {
  return {
    subtotal: cart?.subtotal ?? 0,
    monetarySubtotal: cart?.monetarySubtotal ?? cart?.subtotal ?? 0,
    total: cart?.total ?? 0,
    walletTicketsTotal: cart?.walletTicketsTotal ?? 0,
  };
}

export interface CartWalletSummary {
  allocations: CartWalletTicket[];
  balance: number;
  ticketsTotal: number;
  discountAmount: number;
  savings: number;
}

export function selectCartWallet(cart?: ICart | null): CartWalletSummary {
  const savings = cart?.walletTicketSavings ?? 0;
  return {
    allocations: cart?.walletTicketsByCompetition ?? [],
    balance: cart?.walletBalance ?? 0,
    ticketsTotal: cart?.walletTicketsTotal ?? 0,
    discountAmount: savings,
    savings,
  };
}

export interface CartDiscountSummary {
  promoCode: string | null;
  pendingReferralCode: string | null;
  referralDiscountAmount: number | null;
  referralDiscountPercent: number | null;
  referralLocked: boolean;
  discountType: "percentage" | "fixed" | null;
  discountAmount: number;
  discountRequiresAuth?: boolean;
  promoDiscountPercent?: number | null;
}

export function selectCartDiscount(cart?: ICart | null): CartDiscountSummary {
  return {
    promoCode: cart?.promoCode ?? null,
    pendingReferralCode: cart?.referralCode ?? null,
    referralDiscountAmount: cart?.referralDiscountAmount ?? null,
    referralDiscountPercent: cart?.referralDiscountPercent ?? null,
    referralLocked: Boolean(cart?.referralLocked),
    discountType: cart?.discountType ?? null,
    discountAmount: cart?.discountAmount ?? 0,
    discountRequiresAuth: cart?.discountRequiresAuth ?? false,
    promoDiscountPercent: cart?.promoDiscountPercent ?? null,
  };
}

export function selectCartAutoAdjustments(cart?: ICart | null): CartAdjustment[] {
  return cart?.autoAdjustments ?? [];
}

export function useCartItems(options?: UseCartOptions): UseQueryResult<CartItem[], Error> {
  return useQuery<ApiResponse<ICart>, Error, CartItem[]>({
    ...cartQueryOptions(options),
    select: (res) => selectCartItems(res?.data),
  });
}

export function useCartCount(options?: UseCartOptions): UseQueryResult<number, Error> {
  return useQuery<ApiResponse<ICart>, Error, number>({
    ...cartQueryOptions(options),
    select: (res) => selectCartCount(res?.data),
  });
}

export function useCartTotals(options?: UseCartOptions): UseQueryResult<CartTotals, Error> {
  return useQuery<ApiResponse<ICart>, Error, CartTotals>({
    ...cartQueryOptions(options),
    select: (res) => selectCartTotals(res?.data),
  });
}

export function useCartWallet(options?: UseCartOptions): UseQueryResult<CartWalletSummary, Error> {
  return useQuery<ApiResponse<ICart>, Error, CartWalletSummary>({
    ...cartQueryOptions(options),
    select: (res) => selectCartWallet(res?.data),
  });
}

export function useCartDiscount(
  options?: UseCartOptions
): UseQueryResult<CartDiscountSummary, Error> {
  return useQuery<ApiResponse<ICart>, Error, CartDiscountSummary>({
    ...cartQueryOptions(options),
    select: (res) => selectCartDiscount(res?.data),
  });
}

export function useCartAutoAdjustments(
  options?: UseCartOptions
): UseQueryResult<CartAdjustment[], Error> {
  return useQuery<ApiResponse<ICart>, Error, CartAdjustment[]>({
    ...cartQueryOptions(options),
    select: (res) => selectCartAutoAdjustments(res?.data),
  });
}
