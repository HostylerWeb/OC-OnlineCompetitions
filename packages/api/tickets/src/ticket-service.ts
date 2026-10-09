import { TicketAvailabilityError } from "@oc/api-errors";

export { TicketAvailabilityError } from "@oc/api-errors";

import { Cart, Competition, Order, Profile, Ticket } from "@oc/api-db/models";
import type { ITicketFields } from "@oc/api-db/models/schemas/ticket.schema";
import type { TicketStatus } from "@oc/api-db/models/Ticket";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import { defaultAggregateOptions } from "@oc/api-infra/mongo-query-options";
import { createLogger } from "@oc/api-logger";
import { normalizeAnswerIndex } from "@oc/api-payment-core";
import { isOpenForTicketSales } from "@oc/api-tickets/competition-sales";
import { generateOrderNumber } from "@oc/api-tickets/create-session";
import { getTicketIdsForSlotRange } from "@oc/api-tickets/instant-prize-allocation";
import { type ClientSession, Types } from "mongoose";
import { checkBonusAwardMilestones } from "./bonus-award-draw";

type LeanTicket = ITicketFields & { _id: Types.ObjectId };

const HOLD_CHUNK_SIZE = 500;
const PROVISION_CHUNK_SIZE = 2_000;
const EXCLUDE_FILTER_MAX_SIZE = 5_000;
const EXCLUDE_CURSOR_BATCH_SIZE = 2_000;
const MAX_CLAIM_ITERATIONS = 100;

export interface ClaimTicketsResult {
  ticketIds: string[];
  numbers: number[];
}

export interface ClaimTicketsOptions {
  competitionId: string;
  userId: string;
  orderId: string;
  qty: number;
  answerIndex?: number;
  session?: ClientSession;
}

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

function sessionOpts(session?: ClientSession) {
  return session ? { session } : {};
}

export async function provisionTickets(
  competitionId: string | Types.ObjectId,
  maxTickets: number,
  session?: ClientSession
): Promise<number> {
  const compId = toObjectId(competitionId);
  const opts = { ...sessionOpts(session), ordered: false };

  const existingCount = await Ticket.countDocuments({ competitionId: compId }).session(
    session ?? null
  );
  if (existingCount >= maxTickets) return 0;

  const [agg] = await Ticket.aggregate<{ maxNum: number }>([
    { $match: { competitionId: compId } },
    { $group: { _id: null, maxNum: { $max: "$number" } } },
  ]).session(session ?? null);

  const start = (agg?.maxNum ?? 0) + 1;
  if (start > maxTickets) return 0;

  let inserted = 0;

  for (let chunkStart = start; chunkStart <= maxTickets; chunkStart += PROVISION_CHUNK_SIZE) {
    const chunkEnd = Math.min(maxTickets, chunkStart + PROVISION_CHUNK_SIZE - 1);
    const ops = [];

    for (let number = chunkStart; number <= chunkEnd; number++) {
      ops.push({
        insertOne: {
          document: {
            competitionId: compId,
            number,
            status: "available" as const,
            shuffleKey: Math.random(),
          },
        },
      });
    }

    if (ops.length === 0) continue;

    const bulkResult = await Ticket.bulkWrite(ops, opts);
    const chunkInserted = bulkResult?.insertedCount ?? 0;
    inserted += chunkInserted;
    if (chunkInserted < ops.length) {
      console.error(
        `[ticket.provision] bulkWrite under-inserted: competitionId=${compId.toString()} expected=${ops.length} inserted=${chunkInserted}`
      );
    }
  }

  return inserted;
}

export async function countByStatus(
  competitionId: string | Types.ObjectId,
  status?: TicketStatus,
  maxTickets?: number
): Promise<number> {
  const filter: Record<string, unknown> = {
    competitionId: toObjectId(competitionId),
  };
  if (status) filter.status = status;
  if (maxTickets !== undefined) filter.number = { $lte: maxTickets };
  return Ticket.countDocuments(filter);
}

export async function getMinimumAllowedMaxTickets(
  competitionId: string | Types.ObjectId
): Promise<number> {
  const compId = toObjectId(competitionId);
  const { CompetitionInstantPrize } = await import("@oc/api-db/models");

  const [maxTakenAgg, competition, cipMaxAgg] = await Promise.all([
    Ticket.aggregate<{ maxNum: number }>([
      {
        $match: {
          competitionId: compId,
          status: { $in: ["sold", "held", "reserved"] },
        },
      },
      { $group: { _id: null, maxNum: { $max: "$number" } } },
    ]),
    Competition.findById(compId).select("winnerTicketNumber").lean(),
    CompetitionInstantPrize.aggregate<{ maxNum: number }>([
      { $match: { competitionId: compId, isArchived: { $ne: true } } },
      { $unwind: "$winningEntryNumbers" },
      { $group: { _id: null, maxNum: { $max: "$winningEntryNumbers" } } },
    ]),
  ]);

  const maxTaken = maxTakenAgg[0]?.maxNum ?? 0;
  const maxWinning = cipMaxAgg[0]?.maxNum ?? 0;
  const winnerNum = competition?.winnerTicketNumber ?? 0;
  return Math.max(maxTaken, maxWinning, winnerNum);
}

export async function countOwnedByUser(
  competitionId: string | Types.ObjectId,
  userId: string | Types.ObjectId
): Promise<number> {
  return Ticket.countDocuments({
    competitionId: toObjectId(competitionId),
    ownerId: toObjectId(userId),
    status: "sold",
  });
}

/** Tickets reserved on in-flight orders (pending / processing) for cap enforcement. */
export async function countPendingOrderTicketsForUser(
  competitionId: string | Types.ObjectId,
  userId: string | Types.ObjectId,
  excludeOrderId?: string | Types.ObjectId
): Promise<number> {
  const compId = toObjectId(competitionId);
  const userIdObj = toObjectId(userId);
  const match: Record<string, unknown> = {
    userId: userIdObj,
    status: { $in: ["pending", "processing"] },
    deletedAt: null,
  };
  if (excludeOrderId) {
    match._id = { $ne: toObjectId(excludeOrderId) };
  }

  const rows = await Order.aggregate<{ total: number }>([
    { $match: match },
    {
      $lookup: {
        from: "orderitems",
        localField: "_id",
        foreignField: "orderId",
        as: "items",
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.competitionId": compId,
        "items.deletedAt": null,
      },
    },
    { $group: { _id: null, total: { $sum: "$items.quantity" } } },
  ]).option(defaultAggregateOptions);

  return rows[0]?.total ?? 0;
}

export async function countEffectiveOwnedForCap(
  competitionId: string | Types.ObjectId,
  userId: string | Types.ObjectId,
  excludeOrderId?: string | Types.ObjectId
): Promise<number> {
  const [sold, pending] = await Promise.all([
    countOwnedByUser(competitionId, userId),
    countPendingOrderTicketsForUser(competitionId, userId, excludeOrderId),
  ]);
  return sold + pending;
}

/**
 * Batched version of `countOwnedByUser` — runs a single aggregation that
 * groups the sold-ticket count by competition for the given user. Returns a
 * `Map<competitionId, count>` keyed by the stringified competition id; ids
 * with no matches are simply absent from the map.
 */
export async function countPendingOrderTicketsForUserBatch(
  competitionIds: (string | Types.ObjectId)[],
  userId: string | Types.ObjectId,
  excludeOrderId?: string | Types.ObjectId
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (competitionIds.length === 0) return result;

  const userIdObj = toObjectId(userId);
  const match: Record<string, unknown> = {
    userId: userIdObj,
    status: { $in: ["pending", "processing"] },
    deletedAt: null,
  };
  if (excludeOrderId) {
    match._id = { $ne: toObjectId(excludeOrderId) };
  }

  const compObjectIds = competitionIds.map((id) => toObjectId(id));
  const rows = await Order.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: match },
    {
      $lookup: {
        from: "orderitems",
        localField: "_id",
        foreignField: "orderId",
        as: "items",
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.competitionId": { $in: compObjectIds },
        "items.deletedAt": null,
      },
    },
    { $group: { _id: "$items.competitionId", total: { $sum: "$items.quantity" } } },
  ]).option(defaultAggregateOptions);

  for (const row of rows) {
    result.set(row._id.toString(), row.total);
  }
  return result;
}

export async function countEffectiveOwnedByUserBatch(
  competitionIds: (string | Types.ObjectId)[],
  userId: string | Types.ObjectId,
  excludeOrderId?: string | Types.ObjectId
): Promise<Map<string, number>> {
  const [soldMap, pendingMap] = await Promise.all([
    countOwnedByUserBatch(competitionIds, userId),
    countPendingOrderTicketsForUserBatch(competitionIds, userId, excludeOrderId),
  ]);
  const result = new Map<string, number>();
  for (const id of competitionIds) {
    const key = id.toString();
    result.set(key, (soldMap.get(key) ?? 0) + (pendingMap.get(key) ?? 0));
  }
  return result;
}

export async function countOwnedByUserBatch(
  competitionIds: (string | Types.ObjectId)[],
  userId: string | Types.ObjectId
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (competitionIds.length === 0) return result;

  const rows = await Ticket.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        ownerId: toObjectId(userId),
        competitionId: { $in: competitionIds.map((id) => toObjectId(id)) },
        status: "sold",
      },
    },
    { $group: { _id: "$competitionId", count: { $sum: 1 } } },
  ]).option(defaultAggregateOptions());

  for (const row of rows) {
    result.set(row._id.toString(), row.count);
  }
  return result;
}

export async function getCartQtyForUser(
  competitionId: string | Types.ObjectId,
  userId: string | Types.ObjectId
): Promise<number> {
  const cart = await Cart.findOne({ userId: toObjectId(userId) }).lean();
  if (!cart) return 0;
  const item = cart.items.find((i) => i.competitionId.equals(competitionId));
  return item?.quantity ?? 0;
}

async function updateCompetitionCounters(
  competitionId: Types.ObjectId,
  deltaSold: number,
  deltaHeld: number,
  session?: ClientSession
): Promise<void> {
  console.log(
    "[BONUS-TRACE] updateCompetitionCounters ENTER: compId=%s deltaSold=%d deltaHeld=%d",
    competitionId,
    deltaSold,
    deltaHeld
  );
  const update: Record<string, number> = {};
  if (deltaSold !== 0) update.ticketsSold = deltaSold;
  if (deltaHeld !== 0) update.ticketsHeld = deltaHeld;
  if (Object.keys(update).length === 0) {
    console.log("[BONUS-TRACE] updateCompetitionCounters: no update needed, returning early");
    return;
  }
  await Competition.updateOne({ _id: competitionId }, { $inc: update }, sessionOpts(session));
  console.log("[BONUS-TRACE] updateCompetitionCounters: Competition.updateOne done");

  if (deltaSold > 0) {
    console.log("[BONUS-TRACE] updateCompetitionCounters: deltaSold>0, checking bonus awards");
    try {
      const comp = await Competition.findById(competitionId, {
        ticketsSold: 1,
        status: 1,
        title: 1,
      })
        .session(session ?? null)
        .lean();
      if (comp && comp.status === "active" && comp.ticketsSold >= 0) {
        console.log(
          "[bonus-award] updateCompetitionCounters: calling checkBonusAwardMilestones compId=%s ticketsSold=%d deltaSold=%d compTitle=%s",
          competitionId,
          comp.ticketsSold,
          deltaSold,
          comp.title ?? ""
        );
        await checkBonusAwardMilestones(
          typeof competitionId === "string" ? new Types.ObjectId(competitionId) : competitionId,
          comp.ticketsSold,
          session
        );
        console.log(
          "[bonus-award] updateCompetitionCounters: checkBonusAwardMilestones completed compId=%s",
          competitionId
        );
      }
    } catch (err) {
      console.error("[bonus-award] checkBonusAwardMilestones failed:", err);
      if (err instanceof Error) {
        console.error(err.stack);
      }
    }
  }
}

export async function getCompetitionTicketStats(
  competitionId: string | Types.ObjectId,
  competitionMeta?: {
    status?: string;
    maxTickets?: number;
    ticketsSold?: number;
    ticketsHeld?: number;
  }
): Promise<{
  available: number;
  sold: number;
  held: number;
  taken: number;
  total: number;
  percentageSold: number;
  percentageTaken: number;
  isActive: boolean;
}> {
  const id = toObjectId(competitionId).toString();
  const statsMap = await getCompetitionTicketStatsBatch([
    {
      id,
      maxTickets: competitionMeta?.maxTickets,
      status: competitionMeta?.status,
    },
  ]);

  return (
    statsMap.get(id) ??
    buildEmptyTicketStats(competitionMeta?.maxTickets ?? 0, competitionMeta?.status)
  );
}

export interface CompetitionTicketStatsInput {
  id: string;
  maxTickets?: number;
  status?: string;
  ticketsSold?: number;
  ticketsHeld?: number;
}

function buildEmptyTicketStats(
  maxTickets: number,
  status?: string
): {
  available: number;
  sold: number;
  held: number;
  taken: number;
  total: number;
  percentageSold: number;
  percentageTaken: number;
  isActive: boolean;
} {
  return {
    available: 0,
    sold: 0,
    held: 0,
    taken: 0,
    total: maxTickets,
    percentageSold: 0,
    percentageTaken: 0,
    isActive: status === "active",
  };
}

function buildTicketStatsFromCounts(
  counts: { available: number; sold: number; held: number },
  maxTickets: number,
  status?: string
): {
  available: number;
  sold: number;
  held: number;
  taken: number;
  total: number;
  percentageSold: number;
  percentageTaken: number;
  isActive: boolean;
} {
  const { available, sold, held } = counts;
  const total = maxTickets > 0 ? maxTickets : available + sold + held;
  const taken = sold + held;
  const soldRatio = total > 0 ? sold / total : 0;
  const takenRatio = total > 0 ? taken / total : 0;

  return {
    available,
    sold,
    held,
    taken,
    total,
    percentageSold: Math.min(100, Math.round(soldRatio * 100)),
    percentageTaken: Math.min(100, Math.round(takenRatio * 100)),
    isActive: status === "active",
  };
}

export async function getCompetitionTicketStatsBatch(
  competitions: CompetitionTicketStatsInput[]
): Promise<
  Map<
    string,
    {
      available: number;
      sold: number;
      held: number;
      taken: number;
      total: number;
      percentageSold: number;
      percentageTaken: number;
      isActive: boolean;
    }
  >
> {
  const result = new Map<
    string,
    {
      available: number;
      sold: number;
      held: number;
      taken: number;
      total: number;
      percentageSold: number;
      percentageTaken: number;
      isActive: boolean;
    }
  >();

  if (competitions.length === 0) return result;

  const metaById = new Map(competitions.map((c) => [c.id, c]));
  const idsNeedingMeta = competitions
    .filter(
      (c) =>
        c.maxTickets === undefined ||
        c.status === undefined ||
        c.ticketsSold === undefined ||
        c.ticketsHeld === undefined
    )
    .map((c) => toObjectId(c.id));

  if (idsNeedingMeta.length > 0) {
    const fromDb = await Competition.find({ _id: { $in: idsNeedingMeta } })
      .select("maxTickets status ticketsSold ticketsHeld")
      .lean();
    for (const comp of fromDb) {
      const id = comp._id.toString();
      const existing = metaById.get(id);
      metaById.set(id, {
        id,
        maxTickets: existing?.maxTickets ?? comp.maxTickets,
        status: existing?.status ?? comp.status,
        ticketsSold: existing?.ticketsSold ?? comp.ticketsSold,
        ticketsHeld: existing?.ticketsHeld ?? comp.ticketsHeld,
      });
    }
  }

  const allHaveCounters = [...metaById.values()].every(
    (m) => m.ticketsSold !== undefined && m.ticketsHeld !== undefined
  );

  if (allHaveCounters) {
    for (const [id, meta] of metaById) {
      const sold = meta.ticketsSold ?? 0;
      const held = meta.ticketsHeld ?? 0;
      const maxTickets = meta.maxTickets ?? sold + held;
      const counts = {
        available: Math.max(0, maxTickets - sold - held),
        sold,
        held,
      };
      result.set(id, buildTicketStatsFromCounts(counts, maxTickets, meta.status));
    }
    return result;
  }

  const compObjectIds = [...metaById.keys()].map((id) => toObjectId(id));
  const rows = await Ticket.aggregate<{
    _id: { competitionId: Types.ObjectId; status: TicketStatus };
    count: number;
  }>([
    { $match: { competitionId: { $in: compObjectIds } } },
    {
      $group: {
        _id: { competitionId: "$competitionId", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]).option(defaultAggregateOptions());

  const countsByCompetition = new Map<string, { available: number; sold: number; held: number }>();
  for (const row of rows) {
    const compId = row._id.competitionId.toString();
    const counts = countsByCompetition.get(compId) ?? { available: 0, sold: 0, held: 0 };
    if (row._id.status === "available") counts.available = row.count;
    else if (row._id.status === "sold") counts.sold = row.count;
    else if (row._id.status === "held") counts.held = row.count;
    countsByCompetition.set(compId, counts);
  }

  for (const [id, meta] of metaById) {
    const counts = countsByCompetition.get(id) ?? { available: 0, sold: 0, held: 0 };
    const maxTickets = meta.maxTickets ?? counts.available + counts.sold + counts.held;
    result.set(id, buildTicketStatsFromCounts(counts, maxTickets, meta.status));
  }

  return result;
}

export async function checkAvailability(
  competitionId: string,
  targetCartQty: number,
  userId?: string,
  existingCartQty = 0
): Promise<{ available: number; maxTicketsPerUser: number; status: string }> {
  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    throw new Error("Competition not found");
  }

  if (competition.status !== "active") {
    throw new TicketAvailabilityError(
      `Competition "${competition.title}" is not active`,
      "COMPETITION_INACTIVE"
    );
  }

  if (!isOpenForTicketSales(competition)) {
    throw new TicketAvailabilityError(
      `Competition "${competition.title}" is no longer open for ticket sales`,
      "COMPETITION_INACTIVE"
    );
  }

  const available = await countByStatus(competitionId, "available", competition.maxTickets);
  const increment = Math.max(0, targetCartQty - existingCartQty);
  if (available < increment) {
    throw new TicketAvailabilityError(
      `TICKETS_SOLD_OUT:Only ${available} tickets available for "${competition.title}"`,
      "TICKETS_SOLD_OUT"
    );
  }

  const maxTicketsPerUser = competition.maxTicketsPerUser;
  if (userId && maxTicketsPerUser > 0) {
    const owned = await countEffectiveOwnedForCap(competitionId, userId);
    if (owned + targetCartQty > maxTicketsPerUser) {
      throw new TicketAvailabilityError(
        `MAX_TICKETS_PER_USER_EXCEEDED:You already have ${owned} tickets. Maximum allowed: ${maxTicketsPerUser}`,
        "MAX_TICKETS_PER_USER_EXCEEDED"
      );
    }
  }

  return { available, maxTicketsPerUser, status: competition.status };
}

async function findSoldTicketsForOrder(
  orderIdObj: Types.ObjectId,
  compId: Types.ObjectId,
  ownerIdObj: Types.ObjectId,
  session?: ClientSession
): Promise<LeanTicket[]> {
  const query = Ticket.find({
    orderId: orderIdObj,
    competitionId: compId,
    ownerId: ownerIdObj,
  }).sort({ number: 1 });
  return session ? query.session(session).lean() : query.lean();
}

export async function claimTicketsForOrder(
  options: ClaimTicketsOptions
): Promise<ClaimTicketsResult> {
  const { competitionId, userId, orderId, qty, answerIndex = 0, session } = options;
  log.debug(
    `[ticket.claim] ENTER compId=${competitionId} userId=${userId} orderId=${orderId} qty=${qty} answerIndex=${answerIndex} session=${Boolean(session)}`
  );
  const compId = toObjectId(competitionId);
  const userIdObj = toObjectId(userId);
  const orderIdObj = toObjectId(orderId);
  const opts = { ...sessionOpts(session), ordered: false };

  let claimed = await findSoldTicketsForOrder(orderIdObj, compId, userIdObj, session);
  if (claimed.length >= qty) {
    log.debug(
      `[ticket.claim] short-circuit already-claimed orderId=${orderId} compId=${competitionId} ownerId=${userId} claimed.length=${claimed.length} qty=${qty}`
    );
    return {
      ticketIds: claimed.map((t) => t._id.toString()),
      numbers: claimed.map((t) => t.number),
    };
  }

  const competition = await Competition.findById(compId).lean();
  if (!competition) {
    throw new Error(`Competition ${competitionId} not found`);
  }

  const remaining = qty - claimed.length;
  await checkAvailability(competitionId, remaining, userId);
  log.debug(
    `[ticket.claim] availability OK compId=${competitionId} remaining=${remaining} maxTickets=${competition.maxTickets} maxTicketsPerUser=${competition.maxTicketsPerUser}`
  );

  const answerIdx = normalizeAnswerIndex(answerIndex, competition.questionOptions);
  const answerCorrect =
    competition.correctAnswer !== undefined ? answerIdx === competition.correctAnswer : undefined;
  const now = new Date();

  const order = await Order.findById(orderIdObj).select("orderNumber").lean();
  const orderNumberValue: number | undefined = order?.orderNumber;

  const ownerProfile = await Profile.findById(userIdObj)
    .select("firstName lastName showLastName")
    .lean();

  let iterations = 0;
  while (claimed.length < qty && iterations < MAX_CLAIM_ITERATIONS) {
    iterations++;
    const prevCount = claimed.length;
    const need = qty - claimed.length;
    const claimedIds = claimed.map((t) => t._id);

    const candidateQuery = Ticket.find({
      competitionId: compId,
      status: "available",
      number: { $lte: competition.maxTickets },
      ...(claimedIds.length > 0 ? { _id: { $nin: claimedIds } } : {}),
    })
      .sort({ shuffleKey: 1, _id: 1 })
      .limit(need)
      .select("_id number")
      .lean();

    const candidates: Array<Pick<LeanTicket, "_id" | "number">> = session
      ? await candidateQuery.session(session)
      : await candidateQuery;

    log.debug(
      `[ticket.claim] iter=${iterations} need=${need} candidates.length=${candidates.length}`
    );

    if (candidates.length === 0) {
      await releaseByOrderId(orderId, session);
      log.debug(
        `[ticket.claim] FAIL no candidates iter=${iterations} claimed=${claimed.length} qty=${qty}`
      );
      throw new TicketAvailabilityError(
        `TICKETS_SOLD_OUT:Only ${claimed.length} tickets available for "${competition.title}"`,
        "TICKETS_SOLD_OUT"
      );
    }

    const setFields: Record<string, unknown> = {
      status: "sold",
      ownerId: userIdObj,
      orderId: orderIdObj,
      answerIndex: answerIdx,
      answerCorrect,
      soldAt: now,
    };
    if (orderNumberValue !== undefined) {
      setFields.orderNumber = orderNumberValue;
    }
    if (ownerProfile?.firstName) {
      setFields.entryFirstName = ownerProfile.firstName;
      setFields.entryLastName = ownerProfile.lastName ?? undefined;
      setFields.entryShowLastName = ownerProfile.showLastName ?? true;
    }
    const bulkResult = await Ticket.bulkWrite(
      candidates.map((t) => ({
        updateOne: {
          filter: { _id: t._id, status: "available" },
          update: { $set: setFields },
        },
      })),
      opts
    );

    try {
      await updateCompetitionCounters(compId, bulkResult.modifiedCount, 0, session);
    } catch (err) {
      log.error("[ticket.claim] counter update failed", {
        err,
        compId: compId.toString(),
        modifiedCount: bulkResult.modifiedCount,
      });
    }

    claimed = await findSoldTicketsForOrder(orderIdObj, compId, userIdObj, session);

    if (claimed.length === prevCount) {
      await releaseByOrderId(orderId, session);
      log.debug(
        `[ticket.claim] FAIL no progress iter=${iterations} prev=${prevCount} now=${claimed.length}`
      );
      throw new TicketAvailabilityError(
        `TICKETS_SOLD_OUT:Only ${claimed.length} tickets available for "${competition.title}"`,
        "TICKETS_SOLD_OUT"
      );
    }
  }

  if (claimed.length < qty) {
    await releaseByOrderId(orderId, session);
    log.debug(
      `[ticket.claim] FAIL exhausted iter=${iterations} claimed=${claimed.length} qty=${qty}`
    );
    throw new TicketAvailabilityError(
      `TICKETS_SOLD_OUT:Only ${claimed.length} tickets available for "${competition.title}"`,
      "TICKETS_SOLD_OUT"
    );
  }

  const result = {
    ticketIds: claimed.map((t) => t._id.toString()),
    numbers: claimed.map((t) => t.number),
  };
  log.debug(
    `[ticket.claim] EXIT OK compId=${competitionId} orderId=${orderId} claimed=${claimed.length} ticketIds.length=${result.ticketIds.length} sampleNumbers=${JSON.stringify(result.numbers.slice(0, 10))} sampleIds=${JSON.stringify(result.ticketIds.slice(0, 3))}`
  );
  return result;
}

export async function revertGrantedSoldTickets(
  grantedTicketIds: (string | Types.ObjectId)[],
  cipId: string | Types.ObjectId,
  session?: ClientSession
): Promise<number> {
  if (grantedTicketIds.length === 0) return 0;

  const ticketIds = grantedTicketIds.map((id) => toObjectId(id));
  const cipIdObj = toObjectId(cipId);

  const compTickets = await Ticket.find({ _id: { $in: ticketIds } })
    .select("competitionId")
    .lean();
  const compIds = [...new Set(compTickets.map((t) => t.competitionId.toString()))];

  const result = await Ticket.updateMany(
    { _id: { $in: ticketIds }, status: "sold" },
    {
      $set: { status: "held", heldForCipId: cipIdObj },
      $unset: {
        ownerId: 1,
        orderId: 1,
        answerIndex: 1,
        answerCorrect: 1,
        soldAt: 1,
        instantPrizeWinId: 1,
      },
    },
    sessionOpts(session)
  );

  if (result.modifiedCount > 0) {
    for (const compIdStr of compIds) {
      const compId = new Types.ObjectId(compIdStr);
      await updateCompetitionCounters(compId, -result.modifiedCount, result.modifiedCount, session);
    }
  }

  void invalidateByChannelSafe(
    CH.competitionAvailability,
    CH.competitionsAvailabilityBatch,
    CH.competitionBuyingPower,
    CH.competitionsBuyingPowerBatch
  ).catch(() => {});
  return result.modifiedCount;
}

export async function releaseByOrderId(
  orderId: string | Types.ObjectId,
  session?: ClientSession
): Promise<number> {
  const orderIdObj = toObjectId(orderId);

  const query = Ticket.find({
    orderId: orderIdObj,
    status: { $in: ["reserved", "sold"] },
  }).select("competitionId status");
  const ticketsToRelease = session ? await query.session(session) : await query;

  const soldCountByComp = new Map<string, number>();
  for (const t of ticketsToRelease) {
    if (t.status === "sold") {
      const compId = t.competitionId.toString();
      soldCountByComp.set(compId, (soldCountByComp.get(compId) ?? 0) + 1);
    }
  }

  const ticketIds = ticketsToRelease.map((t) => t._id);

  const result = await Ticket.updateMany(
    { _id: { $in: ticketIds }, status: { $in: ["reserved", "sold"] } },
    {
      $set: { status: "available" },
      $unset: {
        ownerId: 1,
        orderId: 1,
        answerIndex: 1,
        answerCorrect: 1,
        reservedAt: 1,
        soldAt: 1,
        instantPrizeWinId: 1,
      },
    },
    sessionOpts(session)
  );

  for (const [compId, count] of soldCountByComp) {
    await updateCompetitionCounters(new Types.ObjectId(compId), -count, 0, session);
  }

  void invalidateByChannelSafe(
    CH.competitionAvailability,
    CH.competitionsAvailabilityBatch,
    CH.competitionBuyingPower,
    CH.competitionsBuyingPowerBatch
  ).catch(() => {});
  return result.modifiedCount;
}

export async function holdTickets(
  competitionId: string | Types.ObjectId,
  numbers: number[],
  cipId: string | Types.ObjectId,
  session?: ClientSession
): Promise<string[]> {
  if (numbers.length === 0) return [];

  const compId = toObjectId(competitionId);
  const cipIdObj = toObjectId(cipId);
  const opts = sessionOpts(session);

  for (let offset = 0; offset < numbers.length; offset += HOLD_CHUNK_SIZE) {
    const chunk = numbers.slice(offset, offset + HOLD_CHUNK_SIZE);
    const result = await Ticket.updateMany(
      { competitionId: compId, number: { $in: chunk }, status: "available" },
      { $set: { status: "held", heldForCipId: cipIdObj } },
      opts
    );

    await updateCompetitionCounters(compId, 0, result.modifiedCount, session);

    if (result.modifiedCount !== chunk.length) {
      const attemptedNumbers = numbers.slice(0, offset + chunk.length);
      await releaseHeldNumbersForCip(compId, cipIdObj, attemptedNumbers, session);
      throw new Error(
        `Only ${result.modifiedCount}/${chunk.length} tickets held in competition ${competitionId}`
      );
    }
  }

  const heldQuery = Ticket.find({
    competitionId: compId,
    number: { $in: numbers },
    heldForCipId: cipIdObj,
    status: "held",
  })
    .select("_id number")
    .lean();

  const held: Array<{ _id: Types.ObjectId; number: number }> = session
    ? await heldQuery.session(session ?? null)
    : await heldQuery;

  const byNumber = new Map(held.map((t) => [t.number, t._id.toString()]));
  const result = numbers.map((n) => {
    const id = byNumber.get(n);
    if (!id) {
      throw new Error(`Held ticket #${n} missing after hold in competition ${competitionId}`);
    }
    return id;
  });
  void invalidateByChannelSafe(
    CH.competitionAvailability,
    CH.competitionsAvailabilityBatch,
    CH.competitionBuyingPower,
    CH.competitionsBuyingPowerBatch
  ).catch(() => {});
  return result;
}

/** @alias holdTickets */
export const holdTicketsForNumbers = holdTickets;

async function releaseHeldNumbersForCip(
  competitionId: Types.ObjectId,
  cipId: Types.ObjectId,
  numbers: number[],
  session?: ClientSession
): Promise<number> {
  if (numbers.length === 0) return 0;

  const result = await Ticket.updateMany(
    {
      competitionId,
      number: { $in: numbers },
      heldForCipId: cipId,
      status: "held",
    },
    {
      $set: { status: "available" },
      $unset: { heldForCipId: 1 },
    },
    sessionOpts(session)
  );

  if (result.modifiedCount > 0) {
    await updateCompetitionCounters(competitionId, 0, -result.modifiedCount, session);
  }

  return result.modifiedCount;
}

export async function releaseHeldByCip(
  cipId: string | Types.ObjectId,
  session?: ClientSession
): Promise<number> {
  const cipIdObj = toObjectId(cipId);

  const compTickets = await Ticket.find({ heldForCipId: cipIdObj, status: "held" })
    .select("competitionId")
    .lean();
  const compIds = [...new Set(compTickets.map((t) => t.competitionId.toString()))];

  const result = await Ticket.updateMany(
    { heldForCipId: cipIdObj, status: "held" },
    {
      $set: { status: "available" },
      $unset: { heldForCipId: 1 },
    },
    sessionOpts(session)
  );

  if (result.modifiedCount > 0) {
    for (const compIdStr of compIds) {
      const compId = new Types.ObjectId(compIdStr);
      await updateCompetitionCounters(compId, 0, -result.modifiedCount, session);
    }
  }

  void invalidateByChannelSafe(
    CH.competitionAvailability,
    CH.competitionsAvailabilityBatch,
    CH.competitionBuyingPower,
    CH.competitionsBuyingPowerBatch
  ).catch(() => {});
  return result.modifiedCount;
}

export async function pickAvailableNumbers(
  competitionId: string | Types.ObjectId,
  qty: number,
  exclude: Set<number> = new Set(),
  session?: ClientSession
): Promise<number[]> {
  const compId = toObjectId(competitionId);
  if (exclude.size <= EXCLUDE_FILTER_MAX_SIZE) {
    const excludeArr = [...exclude];
    const query = Ticket.find({
      competitionId: compId,
      status: "available",
      ...(excludeArr.length > 0 ? { number: { $nin: excludeArr } } : {}),
    })
      .sort({ shuffleKey: 1, _id: 1 })
      .limit(qty)
      .select("number")
      .lean();

    const candidates: Array<Pick<LeanTicket, "number">> = session
      ? await query.session(session)
      : await query;

    if (candidates.length < qty) {
      throw new Error(`Not enough available tickets: requested ${qty}, found ${candidates.length}`);
    }

    return candidates.map((t) => t.number);
  }

  const picked: number[] = [];
  const query = Ticket.find({
    competitionId: compId,
    status: "available",
  })
    .sort({ shuffleKey: 1, _id: 1 })
    .select("number")
    .lean();

  const cursor = session
    ? query.session(session).cursor({ batchSize: EXCLUDE_CURSOR_BATCH_SIZE })
    : query.cursor({ batchSize: EXCLUDE_CURSOR_BATCH_SIZE });
  for await (const ticket of cursor as AsyncIterable<Pick<LeanTicket, "number">>) {
    if (exclude.has(ticket.number)) continue;
    picked.push(ticket.number);
    if (picked.length >= qty) break;
  }

  if (picked.length < qty) {
    throw new Error(`Not enough available tickets: requested ${qty}, found ${picked.length}`);
  }

  return picked;
}

export async function buildExcludeSetForInstantPrizes(
  competitionId: string | Types.ObjectId,
  baseExclude?: Set<number>
): Promise<Set<number>> {
  const { CompetitionInstantPrize, InstantPrizeWin } = await import("@oc/api-db/models");
  const compId = toObjectId(competitionId);
  const competition = await Competition.findById(compId).select("winnerTicketNumber").lean();
  const exclude = new Set(baseExclude ?? []);

  if (competition?.winnerTicketNumber) {
    exclude.add(competition.winnerTicketNumber);
  }

  const unavailableQuery = Ticket.find({
    competitionId: compId,
    status: { $in: ["sold", "held", "reserved"] },
  })
    .select("number")
    .lean();
  const unavailableCursor = unavailableQuery.cursor({ batchSize: EXCLUDE_CURSOR_BATCH_SIZE });
  for await (const ticket of unavailableCursor as AsyncIterable<Pick<LeanTicket, "number">>) {
    exclude.add(ticket.number);
  }

  const cipsCursor = CompetitionInstantPrize.find({
    competitionId: compId,
    isArchived: { $ne: true },
  })
    .select("winningEntryNumbers")
    .lean()
    .cursor({ batchSize: EXCLUDE_CURSOR_BATCH_SIZE });
  for await (const cip of cipsCursor as AsyncIterable<{ winningEntryNumbers: number[] }>) {
    for (const n of cip.winningEntryNumbers ?? []) {
      if (n != null) exclude.add(n);
    }
  }

  const winsCursor = InstantPrizeWin.aggregate<{ ticketNumber: number }>([
    { $match: { deletedAt: null } },
    {
      $lookup: {
        from: "competitioninstantprizes",
        localField: "competitionInstantPrizeId",
        foreignField: "_id",
        as: "cip",
      },
    },
    { $unwind: "$cip" },
    { $match: { "cip.competitionId": compId } },
    { $project: { ticketNumber: 1 } },
  ])
    .option(defaultAggregateOptions())
    .cursor({ batchSize: EXCLUDE_CURSOR_BATCH_SIZE });
  for await (const win of winsCursor as AsyncIterable<{ ticketNumber: number }>) {
    exclude.add(win.ticketNumber);
  }

  return exclude;
}

export async function transferHeldToOwner(
  cipId: string | Types.ObjectId,
  winIndex: number,
  ticketCount: number,
  userId: string | Types.ObjectId,
  grantedTicketIds: (string | Types.ObjectId)[],
  instantPrizeWinId?: string | Types.ObjectId,
  session?: ClientSession
): Promise<string[]> {
  const cipIdObj = toObjectId(cipId);
  const userIdObj = toObjectId(userId);
  const ticketIds = getTicketIdsForSlotRange(winIndex, ticketCount, grantedTicketIds).map((id) =>
    toObjectId(id)
  );

  if (ticketIds.length < ticketCount) {
    throw new Error(
      `Not enough granted tickets for CIP ${cipIdObj.toString()} at slot ${winIndex}: expected ${ticketCount}, got ${ticketIds.length}`
    );
  }

  const compTicket = await Ticket.findOne({ _id: { $in: ticketIds } })
    .select("competitionId")
    .lean();
  const compId = compTicket?.competitionId;

  const prizeOrderNumber = await generateOrderNumber();

  const now = new Date();
  const result = await Ticket.updateMany(
    { _id: { $in: ticketIds }, status: "held", heldForCipId: cipIdObj },
    {
      $set: {
        status: "sold",
        ownerId: userIdObj,
        soldAt: now,
        orderNumber: prizeOrderNumber,
        ...(instantPrizeWinId ? { instantPrizeWinId: toObjectId(instantPrizeWinId) } : {}),
      },
      $unset: { heldForCipId: 1 },
    },
    sessionOpts(session)
  );

  if (result.modifiedCount !== ticketIds.length) {
    throw new Error(
      `Failed to transfer ${ticketIds.length - result.modifiedCount} held ticket(s) for CIP ${cipIdObj.toString()} at slot ${winIndex}`
    );
  }

  if (compId) {
    await updateCompetitionCounters(compId, result.modifiedCount, -result.modifiedCount, session);
  }

  return ticketIds.map((id) => id.toString());
}

export async function getGrantedTicketIdsForCip(cipId: string | Types.ObjectId): Promise<string[]> {
  const tickets: Array<Pick<LeanTicket, "_id">> = await Ticket.find({
    heldForCipId: toObjectId(cipId),
    status: "held",
  })
    .sort({ number: 1 })
    .select("_id")
    .lean();
  return tickets.map((t) => t._id.toString());
}

export async function claimTicketsForUser(params: {
  userId: string;
  competitionId: string;
  quantity: number;
  answerIndex?: number;
}): Promise<{ ticketNumbers: number[]; entryNumbers: number[] }> {
  const orderId = new Types.ObjectId();
  const result = await claimTicketsForOrder({
    competitionId: params.competitionId,
    userId: params.userId,
    orderId: orderId.toHexString(),
    qty: params.quantity,
    answerIndex: params.answerIndex ?? 0,
  });
  return { ticketNumbers: result.numbers, entryNumbers: result.numbers };
}

export async function countTakenFromPool(competitionId: string | Types.ObjectId): Promise<number> {
  return Ticket.countDocuments({
    competitionId: toObjectId(competitionId),
    status: { $in: ["sold", "held", "reserved"] },
  });
}

const log = createLogger("app");
