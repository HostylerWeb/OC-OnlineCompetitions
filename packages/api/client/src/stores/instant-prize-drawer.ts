import type { CompetitionInstantPrize } from "@oc/types";
import { create } from "zustand";

interface InstantPrizeDrawerState {
  /** Whether the add-prize drawer is open */
  isOpen: boolean;
  /** The competition being edited in the add-prize drawer (null = create mode) */
  editingCip: CompetitionInstantPrize | null;
  /** The competition ID this drawer is attached to */
  competitionId: string;
  /** The maxTickets cap for the competition this drawer is attached to */
  maxTickets: number;
}

interface InstantPrizeDrawerActions {
  /** Open drawer in create mode (no editingCip) */
  openCreate: (competitionId: string, maxTickets: number) => void;
  /** Open drawer in edit mode with a pre-populated Cip */
  openEdit: (competitionId: string, maxTickets: number, cip: CompetitionInstantPrize) => void;
  /** Close the drawer and reset state */
  close: () => void;
}

export type InstantPrizeDrawerStore = InstantPrizeDrawerState & InstantPrizeDrawerActions;

export const useInstantPrizeDrawerStore = create<InstantPrizeDrawerStore>((set) => ({
  isOpen: false,
  editingCip: null,
  competitionId: "",
  maxTickets: 0,

  openCreate: (competitionId, maxTickets) =>
    set({
      isOpen: true,
      editingCip: null,
      competitionId,
      maxTickets,
    }),

  openEdit: (competitionId, maxTickets, cip) =>
    set({
      isOpen: true,
      editingCip: cip,
      competitionId,
      maxTickets,
    }),

  close: () =>
    set({
      isOpen: false,
      editingCip: null,
      competitionId: "",
      maxTickets: 0,
    }),
}));
