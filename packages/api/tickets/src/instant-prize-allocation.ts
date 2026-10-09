import { AllocationError } from "@oc/api-errors";
import { type ClientSession, Types } from "mongoose";

export interface AllocationWin {
  ticketNumber: number;
  grantedTicketIds?: (Types.ObjectId | string)[];
}

export interface SlotRemovalResult {
  keptSlotIndices: number[];
  removedSlotIndices: number[];
  keptWinningEntryNumbers: number[];
  removedWinningEntryNumbers: number[];
}

export function getWonSlotIndices(
  winningEntryNumbers: number[],
  wins: AllocationWin[]
): Set<number> {
  const wonTicketNumbers = new Set(wins.map((w) => w.ticketNumber));
  const indices = new Set<number>();
  winningEntryNumbers.forEach((num, idx) => {
    if (wonTicketNumbers.has(num)) {
      indices.add(idx);
    }
  });
  return indices;
}

export function computeSlotRemoval(
  winningEntryNumbers: number[],
  currentQty: number,
  targetQty: number,
  wins: AllocationWin[]
): SlotRemovalResult {
  if (targetQty > currentQty) {
    throw new AllocationError("targetQty must be <= current quantity for reduction");
  }

  const allIndices = Array.from({ length: currentQty }, (_, i) => i);

  if (targetQty === currentQty) {
    return {
      keptSlotIndices: allIndices,
      removedSlotIndices: [],
      keptWinningEntryNumbers: [...winningEntryNumbers],
      removedWinningEntryNumbers: [],
    };
  }

  const wonSlotIndices = getWonSlotIndices(winningEntryNumbers, wins);
  const wonCount = wonSlotIndices.size;

  if (targetQty < wonCount) {
    throw new AllocationError(
      `Cannot reduce below ${wonCount} — that many slots have wins that cannot be removed`
    );
  }

  const unclaimedIndices = allIndices.filter((i) => !wonSlotIndices.has(i));
  const unclaimedToKeep = targetQty - wonCount;
  const keptUnclaimed = unclaimedIndices.slice(0, unclaimedToKeep);
  const removedUnclaimed = unclaimedIndices.slice(unclaimedToKeep);

  const keptSet = new Set([...wonSlotIndices, ...keptUnclaimed]);
  const keptSlotIndices = allIndices.filter((i) => keptSet.has(i));

  return {
    keptSlotIndices,
    removedSlotIndices: removedUnclaimed,
    keptWinningEntryNumbers: keptSlotIndices.map((i) => winningEntryNumbers[i]!),
    removedWinningEntryNumbers: removedUnclaimed.map((i) => winningEntryNumbers[i]!),
  };
}

export function getTicketIdsForSlotRange(
  slotIndex: number,
  ticketCount: number,
  grantedTicketIds: (Types.ObjectId | string)[]
): (Types.ObjectId | string)[] {
  const start = slotIndex * ticketCount;
  const end = start + ticketCount;
  return grantedTicketIds.slice(start, end);
}

export function getTicketIdsToFreeForRemovedSlots(
  removedSlotIndices: number[],
  ticketCount: number,
  grantedTicketIds: (Types.ObjectId | string)[]
): (Types.ObjectId | string)[] {
  const toFree: (Types.ObjectId | string)[] = [];
  for (const slotIdx of removedSlotIndices) {
    toFree.push(...getTicketIdsForSlotRange(slotIdx, ticketCount, grantedTicketIds));
  }
  return toFree;
}

export function rebuildGrantedTicketIds(
  keptSlotIndices: number[],
  ticketCount: number,
  existingGrantedTicketIds: (Types.ObjectId | string)[],
  wins: AllocationWin[],
  winningEntryNumbers: number[]
): (Types.ObjectId | string)[] {
  const wonTicketNumbers = new Set(wins.map((w) => w.ticketNumber));
  const result: (Types.ObjectId | string)[] = [];

  for (const slotIdx of keptSlotIndices) {
    const ticketNumber = winningEntryNumbers[slotIdx];
    if (ticketNumber != null && wonTicketNumbers.has(ticketNumber)) {
      continue;
    }
    result.push(...getTicketIdsForSlotRange(slotIdx, ticketCount, existingGrantedTicketIds));
  }

  return result;
}

export function shrinkGrantedTicketsForTicketCountChange(
  keptSlotIndices: number[],
  winningEntryNumbers: number[],
  wins: AllocationWin[],
  oldTicketCount: number,
  newTicketCount: number,
  existingGrantedTicketIds: (Types.ObjectId | string)[]
): {
  rebuiltGrantedTicketIds: (Types.ObjectId | string)[];
  ticketIdsToFree: (Types.ObjectId | string)[];
} {
  const wonTicketNumbers = new Set(wins.map((w) => w.ticketNumber));
  const rebuilt: (Types.ObjectId | string)[] = [];
  const ticketIdsToFree: (Types.ObjectId | string)[] = [];

  for (const slotIdx of keptSlotIndices) {
    const ticketNumber = winningEntryNumbers[slotIdx];
    if (ticketNumber != null && wonTicketNumbers.has(ticketNumber)) {
      continue;
    }

    const slotTickets = getTicketIdsForSlotRange(slotIdx, oldTicketCount, existingGrantedTicketIds);
    rebuilt.push(...slotTickets.slice(0, newTicketCount));
    ticketIdsToFree.push(...slotTickets.slice(newTicketCount));
  }

  return { rebuiltGrantedTicketIds: rebuilt, ticketIdsToFree };
}

export function expandGrantedTicketsForTicketCountChange(
  keptSlotIndices: number[],
  winningEntryNumbers: number[],
  wins: AllocationWin[],
  oldTicketCount: number,
  newTicketCount: number,
  existingGrantedTicketIds: (Types.ObjectId | string)[],
  newTicketsBySlot: Map<number, (Types.ObjectId | string)[]>
): { rebuiltGrantedTicketIds: (Types.ObjectId | string)[]; ticketsNeeded: number } {
  const wonTicketNumbers = new Set(wins.map((w) => w.ticketNumber));
  const rebuilt: (Types.ObjectId | string)[] = [];
  let ticketsNeeded = 0;

  for (const slotIdx of keptSlotIndices) {
    const ticketNumber = winningEntryNumbers[slotIdx];
    if (ticketNumber != null && wonTicketNumbers.has(ticketNumber)) {
      continue;
    }

    const existing = getTicketIdsForSlotRange(slotIdx, oldTicketCount, existingGrantedTicketIds);
    const delta = newTicketCount - oldTicketCount;
    const newTickets = newTicketsBySlot.get(slotIdx) ?? [];
    if (newTickets.length !== delta) {
      ticketsNeeded += delta - newTickets.length;
    }
    rebuilt.push(...existing, ...newTickets);
  }

  return { rebuiltGrantedTicketIds: rebuilt, ticketsNeeded };
}

export function countUnclaimedSlots(winningEntryNumbers: number[], wins: AllocationWin[]): number {
  const wonCount = getWonSlotIndices(winningEntryNumbers, wins).size;
  return winningEntryNumbers.length - wonCount;
}

export function computeArchiveState(
  winningEntryNumbers: number[],
  wins: AllocationWin[],
  ticketCount: number,
  grantedTicketIds: (Types.ObjectId | string)[]
): {
  archivedWinningEntryNumbers: number[];
  ticketIdsToFree: (Types.ObjectId | string)[];
} {
  const wonSlotIndices = getWonSlotIndices(winningEntryNumbers, wins);
  const archivedWinningEntryNumbers = [...wonSlotIndices]
    .sort((a, b) => a - b)
    .map((i) => winningEntryNumbers[i]!);

  const allIndices = winningEntryNumbers.map((_, i) => i);
  const unclaimedSlotIndices = allIndices.filter((i) => !wonSlotIndices.has(i));
  const ticketIdsToFree = getTicketIdsToFreeForRemovedSlots(
    unclaimedSlotIndices,
    ticketCount,
    grantedTicketIds
  );

  return { archivedWinningEntryNumbers, ticketIdsToFree };
}

export function expandGrantedTicketsForIncrease(
  delta: number,
  ticketCount: number
): { ticketsNeeded: number } {
  return { ticketsNeeded: delta * ticketCount };
}

export async function freeGrantedTickets(
  ticketIds: (Types.ObjectId | string)[],
  _linkedOrCipId?: Types.ObjectId | string,
  session?: ClientSession | null
): Promise<number> {
  if (ticketIds.length === 0) return 0;
  const { Competition, Ticket } = await import("@oc/api-db/models");
  const sessionOpts = session ? { session } : {};
  const objectIds = ticketIds.map((id) => new Types.ObjectId(id));

  const compTicket = await Ticket.findOne({ _id: { $in: objectIds } })
    .select("competitionId")
    .lean();
  const compId = compTicket?.competitionId;

  const result = await Ticket.updateMany(
    {
      _id: { $in: objectIds },
      status: "held",
    },
    { $set: { status: "available" }, $unset: { heldForCipId: "" } },
    sessionOpts
  );

  if (result.modifiedCount > 0 && compId) {
    const incOpts = session ? { session } : {};
    await Competition.updateOne(
      { _id: compId },
      { $inc: { ticketsHeld: -result.modifiedCount } },
      incOpts
    );
  }

  return result.modifiedCount;
}
