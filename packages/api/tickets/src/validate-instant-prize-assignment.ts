import { Competition, CompetitionInstantPrize, InstantPrize, Ticket } from "@oc/api-db/models";
import type { IInstantPrize } from "@oc/api-db/models/InstantPrize";
import {
  buildExcludeSetForInstantPrizes,
  countByStatus,
  provisionTickets,
} from "@oc/api-tickets/ticket-service";
import { Types } from "mongoose";

export interface InstantPrizeAssignmentLimits {
  maxTickets: number;
  maxQty: number;
  maxAssignableQty: number;
  availableTickets: number;
  assignedSlots: number;
  remainingSlots: number;
  linkedAvailable?: number;
  linkedMaxSlots?: number;
}

export interface LinkedCompetitionCapacityInfo {
  id: string;
  title: string;
  availableTickets: number;
  ticketsPerSlot: number;
}

export interface InstantPrizeCapacityResult extends InstantPrizeAssignmentLimits {
  linkedCompetition?: LinkedCompetitionCapacityInfo;
}

export type InstantPrizeAssignmentValidationResult =
  | { ok: true; limits: InstantPrizeAssignmentLimits }
  | { ok: false; code: string; message: string; limits: InstantPrizeAssignmentLimits };

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

export function computeMaxAssignableQty(
  remainingSlots: number,
  pickableTickets: number,
  linkedSlotCap?: number
): number {
  const caps = [remainingSlots, pickableTickets];
  if (linkedSlotCap !== undefined) {
    caps.push(linkedSlotCap);
  }
  return Math.max(0, Math.min(...caps));
}

export function evaluateQuantityAgainstLimits(
  quantity: number,
  limits: InstantPrizeAssignmentLimits
): InstantPrizeAssignmentValidationResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      ok: false,
      code: "INVALID_QUANTITY",
      message: "Quantity must be a positive integer",
      limits,
    };
  }

  if (quantity > limits.maxAssignableQty) {
    const parts: string[] = [];
    if (quantity > limits.remainingSlots) {
      parts.push(
        `only ${limits.remainingSlots} slot${limits.remainingSlots === 1 ? "" : "s"} remaining on this competition`
      );
    }
    if (quantity > limits.availableTickets) {
      parts.push(
        `only ${limits.availableTickets} ticket${limits.availableTickets === 1 ? "" : "s"} available in the pick pool`
      );
    }
    if (limits.linkedMaxSlots !== undefined && quantity > limits.linkedMaxSlots) {
      parts.push(
        `linked competition allows at most ${limits.linkedMaxSlots} slot${limits.linkedMaxSlots === 1 ? "" : "s"} right now (${limits.linkedAvailable ?? 0} tickets available)`
      );
    }
    const detail = parts.length > 0 ? ` — ${parts.join("; ")}` : "";
    return {
      ok: false,
      code: "QUANTITY_EXCEEDS_CAPACITY",
      message: `Cannot assign ${quantity} slots — maximum assignable right now is ${limits.maxAssignableQty}${detail}`,
      limits,
    };
  }

  return { ok: true, limits };
}

async function countPickableTickets(
  competitionId: Types.ObjectId,
  exclude: Set<number>
): Promise<number> {
  const excludeArr = [...exclude];
  const filter: Record<string, unknown> = {
    competitionId,
    status: "available",
  };
  if (excludeArr.length > 0) {
    filter.number = { $nin: excludeArr };
  }
  return Ticket.countDocuments(filter);
}

async function sumActiveAssignedSlots(
  competitionId: Types.ObjectId,
  excludeCipId?: Types.ObjectId
): Promise<number> {
  const match: Record<string, unknown> = {
    competitionId,
    isArchived: false,
  };
  if (excludeCipId) {
    match._id = { $ne: excludeCipId };
  }

  const rows = await CompetitionInstantPrize.aggregate<{ total: number }>([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);

  return rows[0]?.total ?? 0;
}

export async function getInstantPrizeCapacity(params: {
  competitionId: string | Types.ObjectId;
  instantPrizeId?: string | Types.ObjectId;
  excludeCipId?: string | Types.ObjectId;
  linkedCompetitionId?: string | Types.ObjectId;
  ticketCount?: number;
  baseExclude?: Set<number>;
}): Promise<InstantPrizeCapacityResult> {
  const competitionId = toObjectId(params.competitionId);
  const excludeCipId = params.excludeCipId ? toObjectId(params.excludeCipId) : undefined;

  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    throw new Error("NOT_FOUND:Competition not found");
  }

  await provisionTickets(competitionId, competition.maxTickets);

  const [assignedSlots, exclude] = await Promise.all([
    sumActiveAssignedSlots(competitionId, excludeCipId),
    params.baseExclude ?? buildExcludeSetForInstantPrizes(competitionId),
  ]);

  const remainingSlots = Math.max(0, competition.maxTickets - assignedSlots);
  const availableTickets = await countPickableTickets(competitionId, exclude);

  let prize: Pick<
    IInstantPrize,
    "type" | "linkedCompetitionId" | "ticketCount" | "isActive"
  > | null = null;
  if (params.instantPrizeId) {
    prize = await InstantPrize.findById(params.instantPrizeId)
      .select("type linkedCompetitionId ticketCount isActive")
      .lean();
  }

  const linkedCompetitionId =
    params.linkedCompetitionId?.toString() ?? prize?.linkedCompetitionId?.toString();
  const ticketCount = params.ticketCount ?? prize?.ticketCount ?? 1;
  const isCompTicket =
    prize?.type === "competition_ticket" || params.linkedCompetitionId !== undefined;

  let linkedCompetition: LinkedCompetitionCapacityInfo | undefined;
  let linkedAvailable: number | undefined;
  let linkedSlotCap: number | undefined;

  if (isCompTicket && linkedCompetitionId) {
    const linked = await Competition.findById(linkedCompetitionId)
      .select("title maxTickets")
      .lean();
    if (!linked) {
      throw new Error("NOT_FOUND:Linked competition not found");
    }
    await provisionTickets(linkedCompetitionId, linked.maxTickets);
    linkedAvailable = await countByStatus(linkedCompetitionId, "available");
    linkedSlotCap = Math.floor(linkedAvailable / ticketCount);
    linkedCompetition = {
      id: linkedCompetitionId,
      title: linked.title,
      availableTickets: linkedAvailable,
      ticketsPerSlot: ticketCount,
    };
  }

  const maxAssignableQty = computeMaxAssignableQty(remainingSlots, availableTickets, linkedSlotCap);

  const limits: InstantPrizeCapacityResult = {
    maxTickets: competition.maxTickets,
    maxQty: maxAssignableQty,
    maxAssignableQty,
    availableTickets,
    assignedSlots,
    remainingSlots,
    linkedAvailable,
    linkedMaxSlots: linkedSlotCap,
    linkedCompetition,
  };

  return limits;
}

export async function validateInstantPrizeAssignment(params: {
  competitionId: string | Types.ObjectId;
  quantity: number;
  instantPrizeId?: string | Types.ObjectId;
  excludeCipId?: string | Types.ObjectId;
  linkedCompetitionId?: string | Types.ObjectId;
  ticketCount?: number;
  skipTemplateChecks?: boolean;
  baseExclude?: Set<number>;
}): Promise<InstantPrizeAssignmentValidationResult> {
  const limits = await getInstantPrizeCapacity({
    competitionId: params.competitionId,
    instantPrizeId: params.instantPrizeId,
    excludeCipId: params.excludeCipId,
    linkedCompetitionId: params.linkedCompetitionId,
    ticketCount: params.ticketCount,
    baseExclude: params.baseExclude,
  });

  const qtyCheck = evaluateQuantityAgainstLimits(params.quantity, limits);
  if (!qtyCheck.ok) {
    return qtyCheck;
  }

  if (!params.skipTemplateChecks && params.instantPrizeId) {
    const prize = await InstantPrize.findById(params.instantPrizeId).lean();
    if (!prize) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Instant prize template not found",
        limits,
      };
    }
    if (!prize.isActive) {
      return {
        ok: false,
        code: "INACTIVE_TEMPLATE",
        message: "Cannot assign an inactive prize template",
        limits,
      };
    }

    const competitionId = toObjectId(params.competitionId);
    const existingActive = await CompetitionInstantPrize.findOne({
      competitionId,
      instantPrizeId: toObjectId(params.instantPrizeId),
      isArchived: false,
    }).lean();

    if (
      existingActive &&
      (!params.excludeCipId || !existingActive._id.equals(params.excludeCipId))
    ) {
      return {
        ok: false,
        code: "DUPLICATE_ASSIGNMENT",
        message: "This prize template is already assigned to this competition",
        limits,
      };
    }

    if (prize.type === "competition_ticket" && !prize.linkedCompetitionId) {
      return {
        ok: false,
        code: "MISSING_LINKED_COMPETITION",
        message:
          "This competition ticket prize has no linked competition — update the template before assigning",
        limits,
      };
    }
  }

  return { ok: true, limits };
}

export function isCipInvariantError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("winningEntryNumbers.length") ||
    msg.includes("must equal quantity") ||
    msg.includes("winningEntryNumbers must not contain duplicate") ||
    (msg.includes("quantity (") && msg.includes("must be >= claimedCount")) ||
    msg.includes("archived CIP quantity")
  );
}
