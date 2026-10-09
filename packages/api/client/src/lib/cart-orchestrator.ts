import type { CartWalletTicket } from "@oc/types";
import { create } from "zustand";

export interface SnapBackEntry {
  from: number;
  to: number;
}

export type QueueItem =
  | { type: "update"; competitionId: string; quantity: number }
  | { type: "remove"; competitionId: string }
  | { type: "wallet"; allocations: CartWalletTicket[] };

export interface CartOrchestratorState {
  snapBacks: Map<string, SnapBackEntry>;
  isProcessing: boolean;
  pendingCount: number;
  dismissSnapBack: (competitionId: string) => void;
  _setProcessing: (v: boolean) => void;
  _setSnapBack: (id: string, entry: SnapBackEntry) => void;
  _removeSnapBack: (id: string) => void;
  _setPendingCount: (n: number) => void;
}

export const useCartOrchestratorStore = create<CartOrchestratorState>((set) => ({
  snapBacks: new Map(),
  isProcessing: false,
  pendingCount: 0,

  dismissSnapBack: (competitionId) =>
    set((s) => {
      const next = new Map(s.snapBacks);
      next.delete(competitionId);
      return { snapBacks: next };
    }),

  _setProcessing: (v) => set({ isProcessing: v }),

  _setSnapBack: (id, entry) =>
    set((s) => {
      const next = new Map(s.snapBacks);
      next.set(id, entry);
      return { snapBacks: next };
    }),

  _removeSnapBack: (id) =>
    set((s) => {
      const next = new Map(s.snapBacks);
      next.delete(id);
      return { snapBacks: next };
    }),

  _setPendingCount: (n) => set({ pendingCount: n }),
}));
