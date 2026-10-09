import {
  Competition,
  CompetitionInstantPrize,
  InstantPrize,
  InstantPrizeWin,
} from "@oc/api-db/models";
import type { ICompetitionInstantPrize } from "@oc/api-db/models/CompetitionInstantPrize";
import type { IInstantPrize } from "@oc/api-db/models/InstantPrize";
import { AllocationError } from "@oc/api-errors";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { substringRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import { withMongoTransactionOptional } from "@oc/api-infra/mongo-capabilities";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import {
  computeArchiveState,
  computeSlotRemoval,
  expandGrantedTicketsForIncrease,
  expandGrantedTicketsForTicketCountChange,
  freeGrantedTickets,
  getTicketIdsToFreeForRemovedSlots,
  rebuildGrantedTicketIds,
  shrinkGrantedTicketsForTicketCountChange,
} from "@oc/api-tickets/instant-prize-allocation";
import {
  generateWinningEntryNumbers,
  regenerateUnclaimedWinningEntryNumbers,
  validateManualWinningEntryNumbers,
} from "@oc/api-tickets/instant-prize-utils";
import {
  buildExcludeSetForInstantPrizes,
  holdTickets,
  pickAvailableNumbers,
  provisionTickets,
  releaseHeldByCip,
} from "@oc/api-tickets/ticket-service";
import {
  getInstantPrizeCapacity,
  isCipInvariantError,
  validateInstantPrizeAssignment,
} from "@oc/api-tickets/validate-instant-prize-assignment";
import {
  type AssignCompetitionInstantPrizeInput,
  assignCompetitionInstantPrizeSchema,
  type InstantPrizeCapacityQueryInput,
  instantPrizeCapacityQuerySchema,
  type ReorderCompetitionInstantPrizesInput,
  reorderCompetitionInstantPrizesSchema,
  type UpdateCompetitionInstantPrizeInput,
  updateCompetitionInstantPrizeSchema,
  validateBody,
  validateQuery,
} from "@oc/api-validation";
import { type Context, Hono } from "hono";
import { type ClientSession, type PipelineStage, Types } from "mongoose";

type PopulatedInstantPrize = IInstantPrize & { _id: Types.ObjectId };

const app = new Hono();

app.use("*", requireManager);

const _CIP_COLLECTION = CompetitionInstantPrize.collection.name;
const PRIZE_COLLECTION = InstantPrize.collection.name;
const COMP_COLLECTION = Competition.collection.name;

type CipLogLevel = "info" | "warn" | "error";

function logCipEvent(
  event: string,
  payload: Record<string, unknown>,
  level: CipLogLevel = "info"
): void {
  const entry = {
    event,
    domain: "cip_assignment",
    timestamp: new Date().toISOString(),
    ...payload,
  };
  if (level === "warn") {
    console.warn(JSON.stringify(entry));
    return;
  }
  if (level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }
  console.log(JSON.stringify(entry));
}

async function withMongoTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  return withMongoTransactionOptional(fn, { logPrefix: "CIP", strictOnTxFailure: true });
}

function sessionOpts(session: ClientSession | null) {
  return session ? { session } : {};
}

async function rollbackHeldTickets(
  cipId: Types.ObjectId,
  grantedTicketIds: Types.ObjectId[],
  session: ClientSession | null
): Promise<void> {
  await releaseHeldByCip(cipId, session ?? undefined);
  if (grantedTicketIds.length > 0) {
    await freeGrantedTickets(grantedTicketIds, cipId, session);
  }
}

async function holdLinkedCompetitionTickets(
  linkedCompetitionId: Types.ObjectId,
  numbers: number[],
  cipId: Types.ObjectId,
  session: ClientSession | null
): Promise<Types.ObjectId[]> {
  const linked = await Competition.findById(linkedCompetitionId).lean();
  if (!linked) {
    throw new Error("Linked competition not found");
  }
  if (linked.status !== "active") {
    throw new Error(`Cannot use tickets from a ${linked.status} competition`);
  }

  await provisionTickets(linkedCompetitionId, linked.maxTickets, session ?? undefined);
  const heldIds = await holdTickets(linkedCompetitionId, numbers, cipId, session ?? undefined);
  return heldIds.map((id) => new Types.ObjectId(id));
}

async function pickHeldTicketNumbers(
  linkedCompetitionId: Types.ObjectId,
  count: number,
  session: ClientSession | null
): Promise<number[]> {
  const linked = await Competition.findById(linkedCompetitionId).lean();
  if (!linked) {
    throw new Error("Linked competition not found");
  }
  if (linked.status !== "active") {
    throw new Error(`Cannot use tickets from a ${linked.status} competition`);
  }
  await provisionTickets(linkedCompetitionId, linked.maxTickets, session ?? undefined);
  return pickAvailableNumbers(linkedCompetitionId, count, new Set(), session ?? undefined);
}

function resolveTargetQuantity(
  currentQty: number,
  quantity: number | undefined,
  absolute: boolean | undefined
): number {
  if (quantity === undefined) return currentQty;
  if (absolute) return quantity;
  return currentQty + quantity;
}

function formatCipResponse(cip: {
  _id: Types.ObjectId;
  competitionId: Types.ObjectId;
  instantPrizeId: Types.ObjectId;
  winningEntryNumbers: number[];
  quantity: number;
  claimedCount: number;
  isArchived?: boolean;
  sortOrder?: number;
}) {
  return {
    id: cip._id.toString(),
    competitionId: cip.competitionId.toString(),
    instantPrizeId: cip.instantPrizeId.toString(),
    winningEntryNumbers: cip.winningEntryNumbers,
    quantity: cip.quantity,
    claimedCount: cip.claimedCount,
    isArchived: cip.isArchived ?? false,
    sortOrder: cip.sortOrder ?? 0,
  };
}

function _formatListItem(cip: {
  _id: Types.ObjectId;
  competitionId: unknown;
  instantPrizeId: PopulatedInstantPrize | null;
  winningEntryNumbers: number[];
  quantity: number;
  claimedCount: number;
  isArchived?: boolean;
  createdAt?: Date;
}) {
  const competitionDoc = cip.competitionId as { _id: Types.ObjectId; title: string };
  return {
    id: cip._id.toString(),
    competitionId: competitionDoc._id.toString(),
    competitionTitle: competitionDoc.title ?? "",
    instantPrize: {
      title: cip.instantPrizeId?.title ?? "",
      description: cip.instantPrizeId?.description ?? "",
      images: cip.instantPrizeId?.images ?? [],
      value: cip.instantPrizeId?.value ?? 0,
      type: cip.instantPrizeId?.type,
      linkedCompetitionId: cip.instantPrizeId?.linkedCompetitionId?.toString(),
      ticketCount: cip.instantPrizeId?.ticketCount,
    },
    winningEntryNumbers: cip.winningEntryNumbers,
    quantity: cip.quantity,
    claimedCount: cip.claimedCount,
    isArchived: cip.isArchived ?? false,
    createdAt: cip.createdAt,
  };
}

function mapRouteError(c: Context, err: unknown) {
  captureRouteError(err, {
    requestId: c.get("requestId"),
    path: c.req.path,
    userId: c.get("userId") ?? null,
    operation: "competitionInstantPrize",
  });
  if (err instanceof AllocationError) {
    return error(c, ErrorCodes.VALIDATION_ERROR, err.message, 400);
  }
  if (isCipInvariantError(err)) {
    return error(
      c,
      ErrorCodes.VALIDATION_ERROR,
      err instanceof Error ? err.message : "Invalid instant prize assignment",
      400
    );
  }
  if (err instanceof Error) {
    if (err.message.startsWith("VALIDATION:")) {
      return error(c, ErrorCodes.VALIDATION_ERROR, err.message.slice("VALIDATION:".length), 400);
    }
    if (err.message.startsWith("NOT_FOUND:")) {
      return error(c, ErrorCodes.NOT_FOUND, err.message.slice("NOT_FOUND:".length), 404);
    }
    if (err.message.startsWith("INTERNAL:")) {
      console.error("[CIP]", err.message);
      return error(c, ErrorCodes.INTERNAL_ERROR, err.message.slice("INTERNAL:".length), 500);
    }
    if (err.message.includes("Not enough available tickets")) {
      return error(c, ErrorCodes.VALIDATION_ERROR, err.message, 400);
    }
  }
  console.error("Competition instant prize route error:", err);
  return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
}

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: [
        "createdAt",
        "quantity",
        "claimedCount",
        "competitionTitle",
        "prizeTitle",
        "prizeValue",
      ],
      defaultSort: { sortOrder: 1, createdAt: -1 },
    });
    const competitionId = c.req.query("competitionId");
    const search = c.req.query("search");
    await dbConnect();

    const query: Record<string, unknown> = {};
    if (competitionId) {
      query.competitionId = new Types.ObjectId(competitionId);
    }

    const basePipeline: PipelineStage[] = [
      { $match: query },

      {
        $lookup: {
          from: PRIZE_COLLECTION,
          localField: "instantPrizeId",
          foreignField: "_id",
          as: "prize",
        },
      },
      { $unwind: { path: "$prize", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: COMP_COLLECTION,
          localField: "competitionId",
          foreignField: "_id",
          as: "comp",
        },
      },
      { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 1,
          competitionId: 1,
          instantPrizeId: 1,
          winningEntryNumbers: 1,
          quantity: 1,
          claimedCount: 1,
          isArchived: 1,
          sortOrder: 1,
          createdAt: 1,
          prizeTitle: { $ifNull: ["$prize.title", ""] },
          prizeDescription: { $ifNull: ["$prize.description", ""] },
          prizeImages: { $ifNull: ["$prize.images", []] },
          prizeValue: { $ifNull: ["$prize.value", 0] },
          prizeType: { $ifNull: ["$prize.type", "prize"] },
          prizeCategory: "$prize.prizeCategory",
          prizeLinkedCompetitionId: "$prize.linkedCompetitionId",
          prizeTicketCount: "$prize.ticketCount",
          competitionTitle: { $ifNull: ["$comp.title", ""] },
        },
      },
      ...(() => {
        if (!search) return [];
        return [
          {
            $match: {
              $or: [
                { prizeTitle: { $regex: substringRegex(search), $options: "i" } },
                { competitionTitle: { $regex: substringRegex(search), $options: "i" } },
              ],
            },
          },
        ];
      })(),
    ];

    const searchPostMatch: PipelineStage[] = search
      ? [
          {
            $match: {
              $or: [
                { prizeTitle: { $regex: substringRegex(search), $options: "i" } },
                { competitionTitle: { $regex: substringRegex(search), $options: "i" } },
              ],
            },
          },
        ]
      : [];

    const baseCountPipeline: PipelineStage[] = [
      { $match: query },
      {
        $lookup: {
          from: PRIZE_COLLECTION,
          localField: "instantPrizeId",
          foreignField: "_id",
          as: "prize",
        },
      },
      { $unwind: { path: "$prize", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: COMP_COLLECTION,
          localField: "competitionId",
          foreignField: "_id",
          as: "comp",
        },
      },
      { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },
      ...searchPostMatch,
    ];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      competition: { groupKey: "$competitionId", groupLabel: "$competitionTitle" },
      prize: { groupKey: "$instantPrizeId", groupLabel: "$prizeTitle" },
    };

    const { dataPipeline, countPipeline } = applyGroupBy(
      basePipeline,
      baseCountPipeline,
      groupBy,
      GROUPING_CONFIG,
      page,
      limit,
      sortObj,
      sortDir
    );

    const [cipList, countResult] = await Promise.all([
      CompetitionInstantPrize.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      CompetitionInstantPrize.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = countResult.length > 0 ? (countResult[0] as { total: number }).total : 0;

    const results = cipList.map((cip) => ({
      id: cip._id.toString(),
      competitionId: cip.competitionId.toString(),
      instantPrizeId: cip.instantPrizeId?.toString(),
      competitionTitle: cip.competitionTitle,
      instantPrize: {
        title: cip.prizeTitle,
        description: cip.prizeDescription,
        images: cip.prizeImages,
        value: cip.prizeValue,
        type: cip.prizeType,
        prizeCategory: cip.prizeCategory,
        linkedCompetitionId: cip.prizeLinkedCompetitionId?.toString(),
        ticketCount: cip.prizeTicketCount,
      },
      winningEntryNumbers: cip.winningEntryNumbers,
      quantity: cip.quantity,
      claimedCount: cip.claimedCount,
      isArchived: cip.isArchived ?? false,
      sortOrder: cip.sortOrder ?? 0,
      createdAt: cip.createdAt,
    }));

    return paginated(c, results, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing competition instant prizes:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "competitionInstantPrize.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get(
  "/capacity",
  async (c, next) => validateQuery(c, next, instantPrizeCapacityQuerySchema),
  async (c) => {
    try {
      const query = c.get("query") as InstantPrizeCapacityQueryInput;
      await dbConnect();

      const capacity = await getInstantPrizeCapacity({
        competitionId: query.competitionId,
        instantPrizeId: query.instantPrizeId,
        excludeCipId: query.excludeCipId,
        linkedCompetitionId: query.linkedCompetitionId,
        ticketCount: query.ticketCount,
      });

      if (query.quantity !== undefined) {
        const validation = await validateInstantPrizeAssignment({
          competitionId: query.competitionId,
          quantity: query.quantity,
          instantPrizeId: query.instantPrizeId,
          excludeCipId: query.excludeCipId,
          linkedCompetitionId: query.linkedCompetitionId,
          ticketCount: query.ticketCount,
          skipTemplateChecks: true,
        });
        return success(c, {
          ...capacity,
          requestedQuantity: query.quantity,
          quantityValid: validation.ok,
          quantityMessage: validation.ok ? undefined : validation.message,
        });
      }

      return success(c, capacity);
    } catch (err: unknown) {
      return mapRouteError(c, err);
    }
  }
);

app.post(
  "/assign",
  async (c, next) => validateBody(c, next, assignCompetitionInstantPrizeSchema),
  async (c) => {
    try {
      const body = c.get("body") as AssignCompetitionInstantPrizeInput;
      const { competitionId, instantPrizeId, quantity: qty, winningEntryNumbers: manualNumbers } =
        body;

      await dbConnect();

      const competition = await Competition.findById(competitionId).lean();
      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      if (competition.status !== "active") {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `Cannot assign instant prizes to a ${competition.status} competition`,
          400
        );
      }

      const prize = await InstantPrize.findById(instantPrizeId).lean();
      if (!prize) {
        return error(c, ErrorCodes.NOT_FOUND, "Instant prize template not found", 404);
      }

      const baseExclude = await buildExcludeSetForInstantPrizes(new Types.ObjectId(competitionId));

      const validation = await validateInstantPrizeAssignment({
        competitionId,
        instantPrizeId,
        quantity: qty,
        linkedCompetitionId: prize.linkedCompetitionId,
        ticketCount: prize.ticketCount,
        baseExclude,
      });
      if (!validation.ok) {
        return error(c, ErrorCodes.VALIDATION_ERROR, validation.message, 400);
      }

      const cipId = new Types.ObjectId();

      const result = await withMongoTransaction(async (session) => {
        let grantedTicketIds: Types.ObjectId[] = [];

        try {
          let winningEntryNumbers: number[];

          if (manualNumbers && manualNumbers.length > 0) {
            const manualCheck = await validateManualWinningEntryNumbers(
              new Types.ObjectId(competitionId),
              manualNumbers,
              qty,
              competition.maxTickets,
              baseExclude
            );
            if (!manualCheck.ok) {
              throw new Error(`VALIDATION:${manualCheck.message}`);
            }
            winningEntryNumbers = manualNumbers;
          } else {
            winningEntryNumbers = await generateWinningEntryNumbers(
              new Types.ObjectId(competitionId),
              qty,
              competition.maxTickets,
              baseExclude,
              session ?? undefined
            );
          }

          if (winningEntryNumbers.length !== qty) {
            throw new Error(
              `VALIDATION:Could only generate ${winningEntryNumbers.length} winning numbers, requested ${qty}`
            );
          }

          if (prize.type === "competition_ticket" && prize.linkedCompetitionId) {
            const tc = prize.ticketCount ?? 1;
            const needed = qty * tc;
            const numbers = await pickHeldTicketNumbers(prize.linkedCompetitionId, needed, session);
            grantedTicketIds = await holdLinkedCompetitionTickets(
              prize.linkedCompetitionId,
              numbers,
              cipId,
              session
            );
          }

          const maxCip = await CompetitionInstantPrize.findOne(
            { competitionId: new Types.ObjectId(competitionId) },
            { sortOrder: 1 },
            { sort: { sortOrder: -1 }, limit: 1 }
          ).lean();
          const nextSortOrder = (maxCip?.sortOrder ?? -1) + 1;

          const [cip] = await CompetitionInstantPrize.create(
            [
              {
                _id: cipId,
                competitionId: new Types.ObjectId(competitionId),
                instantPrizeId: new Types.ObjectId(instantPrizeId),
                winningEntryNumbers,
                quantity: qty,
                claimedCount: 0,
                grantedTicketIds,
                isArchived: false,
                sortOrder: nextSortOrder,
              },
            ],
            sessionOpts(session)
          );

          return cip!;
        } catch (assignErr) {
          await rollbackHeldTickets(cipId, grantedTicketIds, session);
          throw assignErr;
        }
      });

      logCipEvent("cip.assignment_created", {
        requestId: c.get("requestId") ?? null,
        adminUserId: c.get("userId") ?? null,
        competitionId,
        instantPrizeId,
        cipId: result._id.toString(),
        quantity: result.quantity,
        claimedCount: result.claimedCount,
      });

      await invalidateByChannelSafe(
        CH.competitions,
        CH.landingPage,
        CH.competitionDetail,
        CH.instantPrizes
      );
      return success(c, formatCipResponse(result));
    } catch (err: unknown) {
      return mapRouteError(c, err);
    }
  }
);

async function handleAssignPatch(c: Context) {
  const id = c.req.param("id");
  if (!id || !Types.ObjectId.isValid(id)) {
    return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid ID format", 400);
  }

  const body = c.get("body") as UpdateCompetitionInstantPrizeInput;
  const {
    quantity,
    absolute,
    linkedCompetitionId,
    ticketCount,
    prizeTitle,
    prizeValue,
    prizeCategory,
    regenerateWinningNumbers,
  } = body;

  await dbConnect();

  const cip = await CompetitionInstantPrize.findById(id).lean();
  if (!cip) {
    return error(c, ErrorCodes.NOT_FOUND, "Competition instant prize not found", 404);
  }

  if (cip.isArchived) {
    return error(
      c,
      ErrorCodes.VALIDATION_ERROR,
      "Cannot modify an archived instant prize assignment",
      400
    );
  }

  const competition = await Competition.findById(cip.competitionId).lean();
  if (!competition) {
    return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
  }

  if (competition.status !== "active") {
    return error(
      c,
      ErrorCodes.VALIDATION_ERROR,
      `Cannot modify instant prizes for a ${competition.status} competition`,
      400
    );
  }

  const prize = await InstantPrize.findById(cip.instantPrizeId).lean();
  if (!prize) {
    return error(c, ErrorCodes.NOT_FOUND, "Instant prize template not found", 404);
  }

  const wins = await InstantPrizeWin.find({ competitionInstantPrizeId: cip._id })
    .select("ticketNumber grantedTicketIds")
    .lean();

  if (
    linkedCompetitionId !== undefined &&
    linkedCompetitionId !== prize.linkedCompetitionId?.toString() &&
    wins.length > 0
  ) {
    return error(
      c,
      ErrorCodes.VALIDATION_ERROR,
      "Cannot change linked competition — this assignment already has wins",
      400
    );
  }

  const targetQty =
    quantity !== undefined ? resolveTargetQuantity(cip.quantity, quantity, absolute) : cip.quantity;

  if (targetQty < cip.claimedCount) {
    return error(
      c,
      ErrorCodes.VALIDATION_ERROR,
      `Cannot reduce quantity below ${cip.claimedCount} — ${cip.claimedCount} slots have already been claimed`,
      400
    );
  }

  let increaseBaseExclude: Set<number> | undefined;

  if (targetQty > cip.quantity) {
    const delta = targetQty - cip.quantity;
    const effectiveLinkedId = linkedCompetitionId ?? prize.linkedCompetitionId?.toString();
    const effectiveTicketCount = ticketCount ?? prize.ticketCount ?? 1;
    increaseBaseExclude = await buildExcludeSetForInstantPrizes(cip.competitionId);
    const increaseValidation = await validateInstantPrizeAssignment({
      competitionId: cip.competitionId,
      quantity: delta,
      excludeCipId: cip._id,
      linkedCompetitionId: effectiveLinkedId,
      ticketCount: effectiveTicketCount,
      skipTemplateChecks: true,
      baseExclude: increaseBaseExclude,
    });
    if (!increaseValidation.ok) {
      return error(c, ErrorCodes.VALIDATION_ERROR, increaseValidation.message, 400);
    }
  }

  const existingGranted =
    (cip.grantedTicketIds?.length ? cip.grantedTicketIds : cip.grantedEntryIds) ?? [];

  try {
    const updated = await withMongoTransaction(async (session) => {
      let currentNumbers = [...cip.winningEntryNumbers];
      let currentGranted = [...existingGranted] as Types.ObjectId[];
      let currentQty = cip.quantity;
      const tc = prize.ticketCount ?? 1;
      const isCompTicket = prize.type === "competition_ticket" && !!prize.linkedCompetitionId;

      if (quantity !== undefined && targetQty !== currentQty) {
        if (targetQty < currentQty) {
          const removal = computeSlotRemoval(currentNumbers, currentQty, targetQty, wins);
          const ticketIdsToFree =
            isCompTicket && prize.linkedCompetitionId
              ? getTicketIdsToFreeForRemovedSlots(removal.removedSlotIndices, tc, currentGranted)
              : [];

          if (ticketIdsToFree.length > 0) {
            await freeGrantedTickets(ticketIdsToFree, cip._id, session);
          }

          currentGranted =
            isCompTicket && prize.linkedCompetitionId
              ? (rebuildGrantedTicketIds(
                  removal.keptSlotIndices,
                  tc,
                  existingGranted,
                  wins,
                  currentNumbers
                ) as Types.ObjectId[])
              : [];

          currentNumbers = removal.keptWinningEntryNumbers;
          currentQty = targetQty;
        } else {
          const delta = targetQty - currentQty;
          let newTicketDocs: Types.ObjectId[] = [];

          if (isCompTicket && prize.linkedCompetitionId) {
            const { ticketsNeeded } = expandGrantedTicketsForIncrease(delta, tc);
            const numbers = await pickHeldTicketNumbers(
              prize.linkedCompetitionId,
              ticketsNeeded,
              session
            );
            newTicketDocs = await holdLinkedCompetitionTickets(
              prize.linkedCompetitionId,
              numbers,
              cip._id,
              session
            );
          }

          const exclude =
            increaseBaseExclude ?? (await buildExcludeSetForInstantPrizes(cip.competitionId));
          const newWinningNumbers = await generateWinningEntryNumbers(
            cip.competitionId,
            delta,
            competition.maxTickets,
            exclude,
            session ?? undefined
          );

          const existingSet = new Set(currentNumbers);
          const duplicates = newWinningNumbers.filter((n) => existingSet.has(n));
          if (duplicates.length > 0) {
            throw new Error(
              `VALIDATION:Cannot increase quantity — ticket numbers [${duplicates.join(", ")}] are already winning numbers in this CIP`
            );
          }

          currentNumbers = [...currentNumbers, ...newWinningNumbers];
          currentGranted = [...currentGranted, ...newTicketDocs];
          currentQty = targetQty;
        }
      }

      if (
        ticketCount !== undefined &&
        ticketCount !== tc &&
        isCompTicket &&
        prize.linkedCompetitionId
      ) {
        const keptSlotIndices = currentNumbers.map((_, i) => i);
        const grantedBeforeTcChange = currentGranted;

        if (ticketCount > tc) {
          const unclaimedSlots = keptSlotIndices.filter(
            (idx) => !wins.some((w) => w.ticketNumber === currentNumbers[idx])
          );
          const ticketsNeeded = unclaimedSlots.length * (ticketCount - tc);
          const numbers = await pickHeldTicketNumbers(
            prize.linkedCompetitionId,
            ticketsNeeded,
            session
          );
          const newTickets = await holdLinkedCompetitionTickets(
            prize.linkedCompetitionId,
            numbers,
            cip._id,
            session
          );

          const newTicketsBySlot = new Map<number, Types.ObjectId[]>();
          let offset = 0;
          for (const slotIdx of unclaimedSlots) {
            newTicketsBySlot.set(
              slotIdx,
              newTickets.slice(offset, offset + (ticketCount - tc)) as Types.ObjectId[]
            );
            offset += ticketCount - tc;
          }

          currentGranted = expandGrantedTicketsForTicketCountChange(
            keptSlotIndices,
            currentNumbers,
            wins,
            tc,
            ticketCount,
            grantedBeforeTcChange,
            newTicketsBySlot
          ).rebuiltGrantedTicketIds as Types.ObjectId[];
        } else if (ticketCount < tc) {
          const { rebuiltGrantedTicketIds, ticketIdsToFree } =
            shrinkGrantedTicketsForTicketCountChange(
              keptSlotIndices,
              currentNumbers,
              wins,
              tc,
              ticketCount,
              grantedBeforeTcChange
            );
          if (ticketIdsToFree.length > 0) {
            await freeGrantedTickets(ticketIdsToFree, cip._id, session);
          }
          currentGranted = rebuiltGrantedTicketIds as Types.ObjectId[];
        }

        await InstantPrize.findByIdAndUpdate(
          cip.instantPrizeId,
          { ticketCount },
          sessionOpts(session)
        );
      }

      if (linkedCompetitionId !== undefined) {
        await InstantPrize.findByIdAndUpdate(
          cip.instantPrizeId,
          { linkedCompetitionId: new Types.ObjectId(linkedCompetitionId) },
          sessionOpts(session)
        );
      }

      if (prizeTitle !== undefined) {
        await InstantPrize.findByIdAndUpdate(
          cip.instantPrizeId,
          { title: prizeTitle },
          sessionOpts(session)
        );
      }

      if (prizeValue !== undefined) {
        await InstantPrize.findByIdAndUpdate(
          cip.instantPrizeId,
          { value: prizeValue },
          sessionOpts(session)
        );
      }

      if (prizeCategory !== undefined) {
        await InstantPrize.findByIdAndUpdate(
          cip.instantPrizeId,
          { prizeCategory },
          sessionOpts(session)
        );
      }

      if (regenerateWinningNumbers) {
        currentNumbers = await regenerateUnclaimedWinningEntryNumbers(
          cip.competitionId,
          competition.maxTickets,
          currentNumbers,
          wins,
          session ?? undefined
        );
      }

      const cipUpdate: Partial<ICompetitionInstantPrize> = {
        winningEntryNumbers: currentNumbers,
        quantity: currentQty,
        grantedTicketIds: currentGranted,
      };

      const doc = await CompetitionInstantPrize.findByIdAndUpdate(id, cipUpdate, {
        returnDocument: "after",
        ...sessionOpts(session),
      }).lean();

      if (!doc) {
        throw new Error("NOT_FOUND:Competition instant prize not found");
      }

      return doc;
    });

    logCipEvent("cip.assignment_updated", {
      requestId: c.get("requestId") ?? null,
      adminUserId: c.get("userId") ?? null,
      cipId: updated._id.toString(),
      competitionId: updated.competitionId.toString(),
      quantityBefore: cip.quantity,
      quantityAfter: updated.quantity,
      claimedCount: updated.claimedCount,
      wasArchived: Boolean(cip.isArchived),
    });

    await invalidateByChannelSafe(
      CH.competitions,
      CH.landingPage,
      CH.competitionDetail,
      CH.instantPrizes
    );
    return success(c, formatCipResponse(updated));
  } catch (err: unknown) {
    return mapRouteError(c, err);
  }
}

app.patch(
  "/assign/:id",
  async (c, next) => validateBody(c, next, updateCompetitionInstantPrizeSchema),
  (c) => handleAssignPatch(c)
);
app.put(
  "/assign/:id",
  async (c, next) => validateBody(c, next, updateCompetitionInstantPrizeSchema),
  (c) => handleAssignPatch(c)
);

app.delete("/assign/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!id || !Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid ID format", 400);
    }
    await dbConnect();

    const cip = await CompetitionInstantPrize.findById(id).lean();
    if (!cip) {
      return error(c, ErrorCodes.NOT_FOUND, "Competition instant prize not found", 404);
    }

    if (cip.isArchived) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "This instant prize assignment is already archived",
        400
      );
    }

    const competition = await Competition.findById(cip.competitionId).lean();
    if (competition && competition.status !== "active") {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Cannot modify instant prizes for a ${competition.status} competition`,
        400
      );
    }

    const prize = await InstantPrize.findById(cip.instantPrizeId).lean();
    const wins = await InstantPrizeWin.find({ competitionInstantPrizeId: cip._id })
      .select("ticketNumber")
      .lean();

    const grantedIds =
      (cip.grantedTicketIds?.length ? cip.grantedTicketIds : cip.grantedEntryIds) ?? [];

    const result = await withMongoTransaction(async (session) => {
      if (cip.claimedCount === 0) {
        if (prize?.type === "competition_ticket" && grantedIds.length > 0) {
          await freeGrantedTickets(grantedIds, cip._id, session);
        }

        await CompetitionInstantPrize.deleteOne({ _id: cip._id }, sessionOpts(session));
        return { success: true, archived: false };
      }

      const tc = prize?.ticketCount ?? 1;
      const { archivedWinningEntryNumbers, ticketIdsToFree } = computeArchiveState(
        cip.winningEntryNumbers,
        wins,
        tc,
        grantedIds
      );

      if (ticketIdsToFree.length > 0) {
        await freeGrantedTickets(ticketIdsToFree, cip._id, session);
      }

      await CompetitionInstantPrize.findByIdAndUpdate(
        id,
        {
          winningEntryNumbers: archivedWinningEntryNumbers,
          quantity: cip.claimedCount,
          grantedTicketIds: [],
          isArchived: true,
        },
        sessionOpts(session)
      );

      return { success: true, archived: true };
    });

    await invalidateByChannelSafe(
      CH.competitions,
      CH.landingPage,
      CH.competitionDetail,
      CH.instantPrizes
    );
    return success(c, result);
  } catch (err: unknown) {
    return mapRouteError(c, err);
  }
});

app.post(
  "/reorder",
  async (c, next) => validateBody(c, next, reorderCompetitionInstantPrizesSchema),
  async (c) => {
    try {
      const body = c.get("body") as ReorderCompetitionInstantPrizesInput;
      const { competitionId, items } = body;
      await dbConnect();

      const competition = await Competition.findById(competitionId).lean();
      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }
      if (competition.status !== "active") {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `Cannot modify instant prizes for a ${competition.status} competition`,
          400
        );
      }

      const allCipIds = await CompetitionInstantPrize.find({ competitionId }).select("_id").lean();
      const validIds = new Set(allCipIds.map((c) => c._id.toString()));
      const invalid = items.find((i) => !validIds.has(i.id));
      if (invalid) {
        return error(c, ErrorCodes.VALIDATION_ERROR, `Invalid CIP ID: ${invalid.id}`, 400);
      }

      const ops = items.map((i) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(i.id) },
          update: { $set: { sortOrder: i.sortOrder } },
        },
      }));
      await CompetitionInstantPrize.bulkWrite(ops);

      await invalidateByChannelSafe(
        CH.competitions,
        CH.landingPage,
        CH.competitionDetail,
        CH.instantPrizes
      );

      return success(c, { success: true });
    } catch (err: unknown) {
      return mapRouteError(c, err);
    }
  }
);

export default app;
