import type { ApiResponse, CartItem, ICart } from "@oc/types";
import type { QueryClient } from "@tanstack/react-query";
import { getSessionSnapshot } from "../auth/session-snapshot";
import { queryKeys } from "../keys";

export type CartSnapshot = ApiResponse<ICart> | undefined;

export interface CartOptimisticContext {
  snapshot: CartSnapshot;
}

export type CartPatcher = (cart: ICart) => ICart;

export async function applyCartOptimistic(
  qc: QueryClient,
  patcher: CartPatcher
): Promise<CartOptimisticContext> {
  await qc.cancelQueries({ queryKey: queryKeys.cart() });
  const snapshot = qc.getQueryData<ApiResponse<ICart>>(queryKeys.cart());
  if (snapshot?.data) {
    const patched: ApiResponse<ICart> = {
      ...snapshot,
      data: patcher(snapshot.data),
    };
    qc.setQueryData(queryKeys.cart(), patched);
  }
  return { snapshot };
}

export function rollbackCartOptimistic(qc: QueryClient, snapshot: CartSnapshot): void {
  if (snapshot) {
    qc.setQueryData(queryKeys.cart(), snapshot);
  }
}

export function cartIdsKeyFromItems(items: CartItem[] | undefined | null): string {
  if (!items?.length) return "";
  return [...new Set(items.map((item) => item.competitionId))].sort().join(",");
}

export function readCurrentCart(qc: QueryClient): ICart | undefined {
  return qc.getQueryData<ApiResponse<ICart>>(queryKeys.cart())?.data;
}

export interface InvalidateAfterCartMutationOptions {
  /** Pre-computed ids key; if omitted we read it from the current cart cache. */
  idsKey?: string;
  /** Whether to invalidate the referral tickets wallet (used by wallet apply + clearCart). */
  walletChanged?: boolean;
  /** Whether to invalidate the cart query itself (default true). */
  invalidateCart?: boolean;
}

export function setCartItemQuantity(
  items: CartItem[],
  competitionId: string,
  quantity: number,
  answerIndex?: number
): CartItem[] {
  return items.map((item) =>
    item.competitionId === competitionId
      ? { ...item, quantity, answerIndex: answerIndex ?? item.answerIndex }
      : item
  );
}

export function invalidateAfterCartMutation(
  qc: QueryClient,
  options: InvalidateAfterCartMutationOptions = {}
): void {
  const { walletChanged = false, invalidateCart = true } = options;

  const idsKey = options.idsKey ?? cartIdsKeyFromItems(readCurrentCart(qc)?.items);
  const userId = getSessionSnapshot().user?.id ?? "anon";

  if (invalidateCart) {
    void qc.invalidateQueries({ queryKey: queryKeys.cart() });
  }

  if (idsKey) {
    // Per-user suffixed batch keys (the actual keys used by the hooks).
    void qc.invalidateQueries({
      queryKey: [...queryKeys.competitions.buyingPowerBatch(idsKey), userId],
    });
    void qc.invalidateQueries({
      queryKey: queryKeys.competitions.availabilityBatch(idsKey),
    });

    // Per-id + per-user suffixed keys (the actual keys used by the hooks).
    const ids = idsKey.split(",").filter(Boolean);
    for (const id of ids) {
      void qc.invalidateQueries({
        queryKey: [...queryKeys.competitions.availability(id), userId],
      });
      void qc.invalidateQueries({
        queryKey: [...queryKeys.competitions.buyingPower(id), userId],
      });
    }
  }

  if (walletChanged) {
    void qc.invalidateQueries({ queryKey: queryKeys.my.referralTickets() });
  }
}
