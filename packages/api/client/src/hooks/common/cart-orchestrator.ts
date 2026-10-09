import type { ApiResponse, CartWalletTicket, ICart } from "@oc/types";
import { useCallback, useEffect, useRef } from "react";
import { type QueueItem, useCartOrchestratorStore } from "../../lib/cart-orchestrator";
import { useApplyCartWallet, useRemoveCartItem, useUpdateCartItem } from "./cart-mutations";

export function useCartOrchestrator() {
  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveCartItem();
  const applyWallet = useApplyCartWallet();

  const queueRef = useRef<QueueItem[]>([]);
  const quantityIntentionsRef = useRef<Map<string, number>>(new Map());
  const walletIntentionsRef = useRef<CartWalletTicket[] | null>(null);
  const isProcessingRef = useRef(false);
  const flushScheduledRef = useRef(false);

  const syncState = useCallback(() => {
    const pending = queueRef.current.length + quantityIntentionsRef.current.size;
    const store = useCartOrchestratorStore.getState();
    store._setPendingCount(pending + (walletIntentionsRef.current ? 1 : 0));
    store._setProcessing(isProcessingRef.current);
  }, []);

  const drainIntents = useCallback(() => {
    for (const [id, qty] of quantityIntentionsRef.current) {
      queueRef.current.push({ type: "update", competitionId: id, quantity: qty });
    }
    quantityIntentionsRef.current.clear();

    if (walletIntentionsRef.current) {
      queueRef.current.push({ type: "wallet", allocations: walletIntentionsRef.current });
      walletIntentionsRef.current = null;
    }
  }, []);

  const processQueue = useCallback(() => {
    if (isProcessingRef.current) return;

    drainIntents();

    if (queueRef.current.length === 0) {
      syncState();
      useCartOrchestratorStore.getState()._setProcessing(false);
      return;
    }

    isProcessingRef.current = true;
    syncState();

    const item = queueRef.current.shift()!;

    const onFinally = () => {
      isProcessingRef.current = false;
      processQueue();
    };

    const snapBackTimers = new Map<string, ReturnType<typeof setTimeout>>();

    switch (item.type) {
      case "update": {
        const { competitionId, quantity } = item;
        const snapKey = `update:${competitionId}`;

        updateMutation.mutate(
          { competitionId, quantity },
          {
            onSuccess: (response: ApiResponse<ICart>) => {
              const serverItem = response?.data?.items?.find(
                (i) => i.competitionId === competitionId
              );
              if (serverItem && serverItem.quantity !== quantity) {
                const store = useCartOrchestratorStore.getState();
                store._setSnapBack(competitionId, { from: quantity, to: serverItem.quantity });
                const existingTimer = snapBackTimers.get(snapKey);
                if (existingTimer) clearTimeout(existingTimer);
                const timer = setTimeout(() => {
                  snapBackTimers.delete(snapKey);
                  store._removeSnapBack(competitionId);
                }, 1500);
                snapBackTimers.set(snapKey, timer);
              }
            },
            onError: () => {},
            onSettled: onFinally,
          }
        );
        break;
      }
      case "remove": {
        const { competitionId } = item;
        removeMutation.mutate(competitionId, {
          onSettled: onFinally,
        });
        break;
      }
      case "wallet": {
        const { allocations } = item;
        applyWallet.mutate(
          { walletTicketsByCompetition: allocations },
          {
            onSettled: onFinally,
          }
        );
        break;
      }
    }
  }, [updateMutation, removeMutation, applyWallet, drainIntents, syncState]);

  const scheduleFlush = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    requestAnimationFrame(() => {
      flushScheduledRef.current = false;
      processQueue();
    });
  }, [processQueue]);

  const updateQuantity = useCallback(
    (competitionId: string, quantity: number) => {
      quantityIntentionsRef.current.set(competitionId, quantity);
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const removeItem = useCallback(
    (competitionId: string) => {
      quantityIntentionsRef.current.delete(competitionId);
      queueRef.current.push({ type: "remove", competitionId });
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const applyWalletAllocations = useCallback(
    (allocations: CartWalletTicket[]) => {
      walletIntentionsRef.current = allocations;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  useEffect(() => {
    return () => {
      queueRef.current.length = 0;
      quantityIntentionsRef.current.clear();
      walletIntentionsRef.current = null;
    };
  }, []);

  const snapBacks = useCartOrchestratorStore((s) => s.snapBacks);
  const isProcessing = useCartOrchestratorStore((s) => s.isProcessing);
  const pendingCount = useCartOrchestratorStore((s) => s.pendingCount);
  const dismissSnapBack = useCartOrchestratorStore((s) => s.dismissSnapBack);

  return {
    snapBacks,
    isProcessing,
    pendingCount,
    updateQuantity,
    removeItem,
    applyWalletAllocations,
    dismissSnapBack,
  };
}
