import { CompetitionInstantPrize, InstantPrizeWin, Ticket } from "@oc/api-db/models";
import type { IInstantPrize } from "@oc/api-db/models/InstantPrize";
import {
  type AllocationWin,
  getWonSlotIndices,
} from "@oc/api-tickets/instant-prize-allocation";
import { buildExcludeSetForInstantPrizes } from "@oc/api-tickets/ticket-service";
import { type ClientSession, Types } from "mongoose";

export async function generateWinningEntryNumbers(
  competitionId: Types.ObjectId,
  quantity: number,
  _maxTickets: number,
  exclude?: Set<number>,
  session?: ClientSession
): Promise<number[]> {
  const excludeSet = exclude ?? (await buildExcludeSetForInstantPrizes(competitionId));
  const excludeArr = [...excludeSet];

  // Use MongoDB $sample for truly uniform random selection — completely independent
  // of shuffleKey used in ticket claiming, preventing the first-buyer bias bug.
  const matchFilter: Record<string, unknown> = {
    competitionId,
    status: "available",
  };
  if (excludeArr.length > 0) {
    matchFilter.number = { $nin: excludeArr };
  }

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const candidates = await Ticket.aggregate<{ number: number }>(
      [
        { $match: matchFilter },
        { $sample: { size: quantity } },
        { $project: { number: 1, _id: 0 } },
      ],
      session ? { session } : {}
    );

    if (candidates.length < quantity) {
      throw new Error(
        `Not enough available tickets: requested ${quantity}, found ${candidates.length}`
      );
    }

    const winningNumbers = candidates.map((t) => t.number);
    const unique = [...new Set(winningNumbers)];
    if (unique.length !== winningNumbers.length) {
      console.warn(
        `Duplicate winning numbers in generateWinningEntryNumbers: ${winningNumbers.length - unique.length} duplicates detected (attempt ${attempt})`
      );
      if (attempt < MAX_RETRIES) continue;
      throw new Error(
        `Failed to generate ${quantity} unique winning entry numbers after ${MAX_RETRIES} attempts`
      );
    }

    return unique;
  }

  throw new Error("Unreachable");
}

export async function validateManualWinningEntryNumbers(
  competitionId: Types.ObjectId,
  numbers: number[],
  quantity: number,
  maxTickets: number,
  exclude: Set<number>
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (numbers.length !== quantity) {
    return {
      ok: false,
      message: `Provide exactly ${quantity} ticket number${quantity === 1 ? "" : "s"} (one per win)`,
    };
  }

  const unique = new Set(numbers);
  if (unique.size !== numbers.length) {
    return { ok: false, message: "Winning ticket numbers must be unique" };
  }

  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 1 || n > maxTickets) {
      return {
        ok: false,
        message: `Ticket number ${n} is out of range (1–${maxTickets})`,
      };
    }
    if (exclude.has(n)) {
      return {
        ok: false,
        message: `Ticket number ${n} is already assigned to another instant win`,
      };
    }
  }

  const availableCount = await Ticket.countDocuments({
    competitionId,
    number: { $in: numbers },
    status: "available",
  });

  if (availableCount !== numbers.length) {
    return {
      ok: false,
      message: "One or more ticket numbers are not available (sold, held, or missing)",
    };
  }

  return { ok: true };
}

export async function regenerateUnclaimedWinningEntryNumbers(
  competitionId: Types.ObjectId,
  maxTickets: number,
  winningEntryNumbers: number[],
  wins: AllocationWin[],
  session?: ClientSession
): Promise<number[]> {
  const wonSlotIndices = getWonSlotIndices(winningEntryNumbers, wins);
  const unclaimedSlotIndices = winningEntryNumbers
    .map((_, index) => index)
    .filter((index) => !wonSlotIndices.has(index));

  if (unclaimedSlotIndices.length === 0) {
    return winningEntryNumbers;
  }

  const exclude = await buildExcludeSetForInstantPrizes(competitionId);
  for (const slotIndex of unclaimedSlotIndices) {
    exclude.delete(winningEntryNumbers[slotIndex]!);
  }

  const replacementNumbers = await generateWinningEntryNumbers(
    competitionId,
    unclaimedSlotIndices.length,
    maxTickets,
    exclude,
    session
  );

  const next = [...winningEntryNumbers];
  unclaimedSlotIndices.forEach((slotIndex, i) => {
    next[slotIndex] = replacementNumbers[i]!;
  });
  return next;
}

export interface InstantWinResult {
  entryNumber: number;
  winIndex: number;
  instantPrize: IInstantPrize;
  competitionInstantPrizeId: Types.ObjectId;
  prizeType: "prize" | "competition_ticket";
  linkedCompetitionId?: Types.ObjectId;
  ticketCount?: number;
}

export async function checkInstantWins(
  competitionId: Types.ObjectId,
  assignedNumbers: number[]
): Promise<InstantWinResult[]> {
  if (assignedNumbers.length === 0) return [];

  const assignedSet = new Set(assignedNumbers);

  const cipList = await CompetitionInstantPrize.find({
    competitionId,
    isArchived: { $ne: true },
    winningEntryNumbers: { $in: assignedNumbers },
  }).populate<{ instantPrizeId: IInstantPrize }>("instantPrizeId");

  if (cipList.length === 0) return [];

  const cipIds = cipList.map((c) => c._id);
  const existingWins = await InstantPrizeWin.find({
    competitionInstantPrizeId: { $in: cipIds },
    ticketNumber: { $in: assignedNumbers },
  })
    .select("competitionInstantPrizeId ticketNumber")
    .lean();

  const wonTicketNumbers = new Set(existingWins.map((w) => w.ticketNumber));

  const wins: InstantWinResult[] = [];

  for (const cip of cipList) {
    const instantPrize = cip.instantPrizeId as unknown as IInstantPrize;
    const prizeType = instantPrize.type ?? "prize";

    const occurrenceCount = new Map<number, number>();
    const positionMap = new Map<number, number>();
    cip.winningEntryNumbers.forEach((num, idx) => {
      if (!positionMap.has(num)) positionMap.set(num, idx);
    });
    for (const entryNumber of cip.winningEntryNumbers) {
      if (!assignedSet.has(entryNumber)) continue;
      if (wonTicketNumbers.has(entryNumber)) continue;

      const baseIndex = positionMap.get(entryNumber)!;
      const occurrence = occurrenceCount.get(entryNumber) ?? 0;
      const winIndex = baseIndex + occurrence;
      occurrenceCount.set(entryNumber, occurrence + 1);
      wins.push({
        entryNumber,
        winIndex,
        instantPrize,
        competitionInstantPrizeId: cip._id,
        prizeType,
        linkedCompetitionId:
          prizeType === "competition_ticket" ? instantPrize.linkedCompetitionId : undefined,
        ticketCount:
          prizeType === "competition_ticket" ? (instantPrize.ticketCount ?? 1) : undefined,
      });
    }
  }

  return wins;
}
