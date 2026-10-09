import type { InstantPrizeCapacityResponse } from "@oc/types";
import { isProductPrizeSetup, type InstantPrizeSetupMode } from "./instant-prize-capacity-guards";

export interface InstantPrizeAssignFormValues {
  quantity: number;
  selectedPrizeId: string;
  setup: InstantPrizeSetupMode;
  linkedCompetitionId: string;
  ticketCount: number;
  prizeName: string;
  manualTicketNumbers: number[] | null;
}

export interface InstantPrizeAssignFormErrors {
  quantity?: string;
  prize?: string;
  prizeName?: string;
  linkedCompetitionId?: string;
  ticketCount?: string;
  manualTicketNumbers?: string;
}

export function validateInstantPrizeAssignForm(
  values: InstantPrizeAssignFormValues,
  options: {
    editing: boolean;
    claimedCount: number;
    capacity?: InstantPrizeCapacityResponse | null;
    minQuantity?: number;
  }
): InstantPrizeAssignFormErrors {
  const errors: InstantPrizeAssignFormErrors = {};
  const {
    quantity,
    selectedPrizeId,
    setup,
    linkedCompetitionId,
    ticketCount,
    prizeName,
    manualTicketNumbers,
  } = values;
  const minQty =
    options.minQuantity ??
    (options.editing ? Math.max(1, options.claimedCount) : 1);

  if (!Number.isInteger(quantity) || quantity < minQty) {
    errors.quantity =
      options.editing && options.claimedCount > 0
        ? `Number of wins must be at least ${options.claimedCount} (${options.claimedCount} already won)`
        : "Number of wins must be at least 1";
  }

  const capacity = options.capacity;
  if (capacity && quantity > capacity.maxAssignableQty) {
    errors.quantity = `You can add at most ${capacity.maxAssignableQty} win${capacity.maxAssignableQty === 1 ? "" : "s"} right now`;
  }

  if (!options.editing) {
    if (setup === "saved" && !selectedPrizeId) {
      errors.prize = "Choose a template";
    }
  }

  if (isProductPrizeSetup(setup) && !prizeName.trim()) {
    errors.prizeName = "Prize name is required";
  }

  if (setup === "free_tickets" && !options.editing && !linkedCompetitionId) {
    errors.linkedCompetitionId = "Select target competition";
  }

  if (setup === "free_tickets" && (!Number.isInteger(ticketCount) || ticketCount < 1)) {
    errors.ticketCount = "Tickets per winner must be at least 1";
  }

  if (manualTicketNumbers !== null) {
    if (manualTicketNumbers.length !== quantity) {
      errors.manualTicketNumbers = `Enter exactly ${quantity} ticket number${quantity === 1 ? "" : "s"} (comma-separated), one per win`;
    }
  }

  if (capacity?.linkedCompetition && quantity > 0) {
    const ticketsRequired = quantity * capacity.linkedCompetition.ticketsPerSlot;
    if (ticketsRequired > capacity.linkedCompetition.availableTickets) {
      errors.quantity = `Needs ${ticketsRequired} tickets in "${capacity.linkedCompetition.title}" but only ${capacity.linkedCompetition.availableTickets} available`;
    }
  }

  return errors;
}

export function hasAssignFormErrors(errors: InstantPrizeAssignFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function parseManualTicketNumbersInput(raw: string): number[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/[,;\s]+/).filter(Boolean);
  const nums: number[] = [];
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  return nums;
}
