import { randomBytes } from "node:crypto";
import { createLogger } from "@oc/api-logger";
import type { ClientSession } from "mongoose";
import { Types } from "mongoose";
import { normalizeAnswerIndex } from "./answer-index";

type FulfillmentLogLevel = "info" | "warn" | "error";

function logFulfillmentEvent(
  event: string,
  payload: Record<string, unknown>,
  level: FulfillmentLogLevel = "info"
): void {
  const logEntry = {
    event,
    domain: "fulfillment",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (level === "warn") {
    console.warn(JSON.stringify(logEntry));
    return;
  }
  if (level === "error") {
    console.error(JSON.stringify(logEntry));
    return;
  }
  console.log(JSON.stringify(logEntry));
}

export interface OrderItemData {
  competitionId: string;
  quantity: number;
  paidQty?: number;
  walletQty?: number;
  answerIndex: number;
}

export interface OrderFulfillmentDeps {
  claimTicketsForOrder: (params: {
    competitionId: string;
    userId: string;
    orderId: string;
    qty: number;
    answerIndex?: number;
    session?: ClientSession;
  }) => Promise<{ ticketIds: string[]; numbers: number[] }>;
  releaseByOrderId: (orderId: string, session?: ClientSession) => Promise<number>;
  rollbackOrderFulfillment?: (params: {
    orderId: string;
    userId: string;
    profileStatsDelta?: { entries: number; spent: number };
    referralBalanceUsed?: number;
    promoCode?: string;
    session?: ClientSession;
  }) => Promise<void>;
  createInstantPrizeWin: (win: {
    competitionInstantPrizeId: Types.ObjectId;
    userId: Types.ObjectId;
    entryId: Types.ObjectId;
    ticketNumber: number;
    claimed: boolean;
    wonAt: Date;
    session?: ClientSession;
  }) => Promise<{ _id: Types.ObjectId }>;
  updateInstantPrizeWinGrantedTickets: (
    winId: Types.ObjectId,
    grantedTicketIds: Types.ObjectId[],
    session?: ClientSession
  ) => Promise<void>;
  markInstantPrizeWinClaimed: (winId: Types.ObjectId, session?: ClientSession) => Promise<void>;
  updateCompetitionInstantPrizeClaimedCount: (
    id: Types.ObjectId,
    session?: ClientSession
  ) => Promise<void>;
  updateProfileStats: (
    userId: Types.ObjectId,
    totalEntries: number,
    totalSpent: number,
    session?: ClientSession
  ) => Promise<void>;
  updateProfileAddress: (
    userId: Types.ObjectId,
    address: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      postcode: string;
      country?: string;
    }
  ) => Promise<void>;
  createOrderItems: (
    items: Array<{
      orderId: Types.ObjectId;
      competitionId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      ticketNumbers: number[];
      entryIds: string[];
      answerIndex: number;
    }>,
    session?: ClientSession
  ) => Promise<void>;
  updateBalance: (
    userId: Types.ObjectId,
    amount: number,
    session?: ClientSession
  ) => Promise<{ available: number } | null>;
  updateBalanceTransaction: (
    transactionId: Types.ObjectId,
    status: string,
    balanceAfter: number,
    session?: ClientSession
  ) => Promise<void>;
  checkInstantWins: (
    competitionId: Types.ObjectId,
    ticketNumbers: number[]
  ) => Promise<
    Array<{
      competitionInstantPrizeId: Types.ObjectId;
      entryNumber: number;
      winIndex: number;
      instantPrize: { title: string; images?: string[]; value?: number };
      prizeType: "prize" | "competition_ticket";
      linkedCompetitionId?: Types.ObjectId;
      ticketCount?: number;
    }>
  >;
  sendInstantWinEmail: (params: {
    userId: string;
    wins: Array<{
      prizeTitle: string;
      prizeImage?: string;
      prizeValue?: number;
      ticketNumber: number;
      competitionName?: string;
    }>;
  }) => Promise<void>;
  onInstantWinGranted?: (params: {
    userId: string;
    wins: Array<{ prizeTitle: string; prizeValue?: number }>;
  }) => void;
  sendOrderConfirmationEmail: (params: {
    userId: string;
    orderId: string;
    orderNumber?: number;
    orderDate: string;
    items: Array<{
      competitionTitle: string;
      quantity: number;
      unitPrice: number;
      ticketNumbers: number[];
      totalPrice: number;
    }>;
    subtotal: number;
    discount: number;
    total: number;
    orderEmail?: string;
  }) => Promise<void>;
  recordReferralPurchase: (params: {
    buyerUserId: string;
    orderId: string;
    quantity: number;
    orderTotal: number;
    isGuestCheckout?: boolean;
  }) => Promise<void>;
  recordFailedReferral?: (params: { orderId: string; error: string }) => Promise<void>;
  debitReferralWallet?: (
    userId: Types.ObjectId,
    amount: number,
    session?: ClientSession
  ) => Promise<boolean>;
  findCompetitionsByIds: (ids: string[]) => Promise<
    Map<
      string,
      {
        title: string;
        ticketPrice: number;
        status: string;
        questionOptions?: string[];
        correctAnswer?: number;
      }
    >
  >;
  findCipById: (id: string) => Promise<{
    _id: Types.ObjectId;
    competitionInstantPrizeId: Types.ObjectId;
    winningEntryNumbers: number[];
    grantedTicketIds: Types.ObjectId[];
  } | null>;
  transferHeldTicketsToOwner: (
    cipId: Types.ObjectId,
    winIndex: number,
    ticketCount: number,
    userId: Types.ObjectId,
    instantPrizeWinId: Types.ObjectId,
    grantedTicketIds: Types.ObjectId[],
    session?: ClientSession
  ) => Promise<string[]>;
  findOrderById: (id: Types.ObjectId) => Promise<{
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    metadata?: Record<string, unknown>;
  } | null>;
  notifyPendingBonusAwardFires?: (params: {
    userId: string;
    assignedNumbers: AssignedOrderNumbers[];
    session?: ClientSession;
  }) => Promise<void>;
  session?: ClientSession;
}

export interface BalanceTopUpDeps {
  updateBalance: (
    userId: Types.ObjectId,
    amount: number,
    session?: ClientSession
  ) => Promise<{ available: number } | null>;
  updateBalanceTransaction: (
    transactionId: Types.ObjectId,
    status: string,
    balanceAfter: number,
    session?: ClientSession
  ) => Promise<void>;
}

export function getItemsFromOrder(order: { metadata?: Record<string, unknown> }): OrderItemData[] {
  const meta = order.metadata ?? {};
  if (meta.items) {
    try {
      return JSON.parse(meta.items as string) as OrderItemData[];
    } catch {
      throw new Error(`getItemsFromOrder: metadata.items is not valid JSON for order fulfillment`);
    }
  }

  const competitionIds = ((meta.competitionIds as string) ?? "").split(",").filter(Boolean);
  if (competitionIds.length === 0) return [];

  throw new Error(
    `getItemsFromOrder: metadata.items is missing for order. ` +
      `competitionIds="${meta.competitionIds}". ` +
      `This indicates data corruption or a migration edge case — cannot safely assume quantity:1.`
  );
}

export function formatOrderDate(date: Date = new Date()): string {
  return date.toLocaleString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function generateOrderNumber(): number {
  return Number.parseInt(randomBytes(6).toString("hex"), 16);
}

export interface ProcessOrderFulfillmentOptions {
  orderId: string;
  orderNumber?: number;
  userId: string;
  competitionIds: string[];
  items: OrderItemData[];
  subtotal: number;
  discountAmount: number;
  total: number;
  metadata: Record<string, unknown>;
  logPrefix: string;
  deps: OrderFulfillmentDeps;
  referralBalanceUsed?: number;
  session?: ClientSession;
  orderEmail?: string;
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    country?: string;
  };
}

export interface AssignedTicketGrant {
  competitionId: string;
  ticketNumbers: number[];
  entryIds: string[];
}

export type AssignedOrderNumbers = AssignedTicketGrant;

export interface GrantInstantPrizeWinsOptions {
  userId: string;
  assignedNumbers: AssignedTicketGrant[];
  deps: OrderFulfillmentDeps;
  session?: ClientSession;
  logPrefix: string;
  competitionTitles?: Map<string, string>;
}

export async function grantInstantPrizeWinsForAssignedNumbers(
  options: GrantInstantPrizeWinsOptions
): Promise<
  Array<{
    prizeTitle: string;
    prizeImage?: string;
    prizeValue?: number;
    ticketNumber: number;
    competitionName?: string;
  }>
> {
  const { userId, assignedNumbers, deps, session, logPrefix, competitionTitles } = options;
  if (assignedNumbers.length === 0) return [];

  const userIdObj = new Types.ObjectId(userId);
  const instantWinEmailItems: Array<{
    prizeTitle: string;
    prizeImage?: string;
    prizeValue?: number;
    ticketNumber: number;
    competitionName?: string;
  }> = [];

  for (const { competitionId, ticketNumbers, entryIds } of assignedNumbers) {
    if (ticketNumbers.length === 0) continue;

    const wins = await deps.checkInstantWins(new Types.ObjectId(competitionId), ticketNumbers);
    const competitionTitle = competitionTitles?.get(competitionId);

    for (const win of wins) {
      const ticketIdx = ticketNumbers.indexOf(win.entryNumber);
      if (ticketIdx === -1) {
        throw new Error(
          `Instant win ticket ${win.entryNumber} not found in assigned numbers for competition ${competitionId}`
        );
      }
      const ticketId = entryIds[ticketIdx];
      const winResult = await deps.createInstantPrizeWin({
        competitionInstantPrizeId: win.competitionInstantPrizeId,
        userId: userIdObj,
        entryId: new Types.ObjectId(ticketId),
        ticketNumber: win.entryNumber,
        claimed: false,
        wonAt: new Date(),
        session,
      });
      try {
        await deps.updateCompetitionInstantPrizeClaimedCount(
          win.competitionInstantPrizeId,
          session
        );
      } catch (countErr) {
        console.error(
          `[${logPrefix}] updateCompetitionInstantPrizeClaimedCount failed for CIP ${win.competitionInstantPrizeId} — claimedCount may be stale:`,
          countErr
        );
      }

      if (win.prizeType === "competition_ticket" && win.linkedCompetitionId) {
        const cip = await deps.findCipById(win.competitionInstantPrizeId.toString());
        if (!cip?.grantedTicketIds?.length) {
          throw new Error(
            `Inconsistent instant prize state: CIP ${win.competitionInstantPrizeId.toString()} has no grantedTicketIds ` +
              `but prize type is competition_ticket for win on ticket ${win.entryNumber}. ` +
              `Manual intervention required.`
          );
        }

        const grantedTicketIds = await deps.transferHeldTicketsToOwner(
          win.competitionInstantPrizeId,
          win.winIndex,
          win.ticketCount ?? 1,
          userIdObj,
          winResult._id,
          cip.grantedTicketIds,
          session
        );

        await deps.updateInstantPrizeWinGrantedTickets(
          winResult._id,
          grantedTicketIds.map((id) => new Types.ObjectId(id)),
          session
        );
        await deps.markInstantPrizeWinClaimed(winResult._id, session);
      }

      instantWinEmailItems.push({
        prizeTitle: win.instantPrize.title,
        prizeImage: win.instantPrize.images?.[0],
        prizeValue: win.instantPrize.value,
        ticketNumber: win.entryNumber,
        competitionName: competitionTitle,
      });
    }
  }

  return instantWinEmailItems;
}

export async function processOrderFulfillment(options: ProcessOrderFulfillmentOptions): Promise<{
  emailItems: Array<{
    competitionTitle: string;
    quantity: number;
    unitPrice: number;
    ticketNumbers: number[];
    totalPrice: number;
  }>;
  allAssignedNumbers: Array<{
    competitionId: string;
    ticketNumbers: number[];
    entryIds: string[];
  }>;
  totalQuantity: number;
}> {
  const { orderId, userId, competitionIds, items, logPrefix, deps, session } = options;
  logFulfillmentEvent("fulfillment.order_started", {
    logPrefix,
    orderId,
    userId,
    competitionIds,
    itemCount: items.length,
    hasTransactionSession: Boolean(session),
  });
  log.debug(
    `[fulfill.start] logPrefix=${logPrefix} orderId=${orderId} userId=${userId} competitionIds=${JSON.stringify(competitionIds)} items.length=${items.length} subtotal=${options.subtotal} discount=${options.discountAmount} total=${options.total} referralBalanceUsed=${options.referralBalanceUsed ?? 0}`
  );
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    log.debug(
      `[fulfill.start] items[${i}] compId=${it?.competitionId} qty=${it?.quantity} paidQty=${it?.paidQty ?? "<undef>"} walletQty=${it?.walletQty ?? "<undef>"} answerIndex=${it?.answerIndex} positionalMatch=${it?.competitionId === competitionIds[i]}`
    );
  }

  if (items.length === 0 || competitionIds.length === 0) {
    console.error(`[${logPrefix}] Order ${orderId} has no items to fulfill`);
    logFulfillmentEvent(
      "fulfillment.order_failed",
      {
        logPrefix,
        orderId,
        userId,
        reason: "missing_items_or_competitions",
        itemCount: items.length,
        competitionCount: competitionIds.length,
      },
      "error"
    );
    throw new Error("No items to fulfill");
  }

  const emailItems: Array<{
    competitionTitle: string;
    quantity: number;
    unitPrice: number;
    ticketNumbers: number[];
    totalPrice: number;
  }> = [];

  const allAssignedNumbers: Array<{
    competitionId: string;
    ticketNumbers: number[];
    entryIds: string[];
  }> = [];

  const userIdObj = new Types.ObjectId(userId);
  const orderIdObj = new Types.ObjectId(orderId);
  const promoCode = options.metadata.promoCode as string | undefined;

  const competitionMap = await deps.findCompetitionsByIds(competitionIds);

  // Validate all competitions are still active before fulfilling
  for (const competitionId of competitionIds) {
    const competition = competitionMap.get(competitionId);
    if (competition && competition.status !== "active") {
      throw new Error(`Competition ${competition.title} is no longer active, cannot fulfill order`);
    }
  }

  let totalProfileEntries = 0;
  let totalProfileSpent = 0;
  let ticketsClaimed = false;

  try {
    for (let i = 0; i < competitionIds.length; i++) {
      const competitionId = competitionIds[i] ?? "";
      const competition = competitionMap.get(competitionId);
      if (!competition) {
        throw new Error(
          `Competition ${competitionId} not found during fulfillment for order ${orderId}`
        );
      }

      const item = items[i];
      const qty = item?.quantity ?? 1;
      const paidQty = item?.paidQty ?? qty;
      const answerIdx = normalizeAnswerIndex(item?.answerIndex, competition.questionOptions);

      log.debug(
        `[fulfill.iter] i=${i} compId=${competitionId} competitionTitle="${competition.title}" ticketPrice=${competition.ticketPrice} qty=${qty} paidQty=${paidQty} walletQty=${item?.walletQty ?? 0} answerIdx=${answerIdx} alignOk=${item?.competitionId === competitionId}`
      );

      const { ticketIds, numbers } = await deps.claimTicketsForOrder({
        competitionId,
        userId,
        orderId,
        qty,
        answerIndex: answerIdx,
        session,
      });
      ticketsClaimed = true;
      log.debug(
        `[fulfill.claim] i=${i} compId=${competitionId} requested=${qty} claimed=${numbers.length} ticketIds.length=${ticketIds.length} sampleNumbers=${JSON.stringify(numbers.slice(0, 10))}`
      );
      const spent = (Number(competition.ticketPrice) || 0) * (Number(paidQty) || 0);
      totalProfileEntries += qty;

      allAssignedNumbers.push({
        competitionId,
        ticketNumbers: numbers,
        entryIds: ticketIds,
      });

      emailItems.push({
        competitionTitle: competition.title,
        quantity: qty,
        unitPrice: competition.ticketPrice,
        ticketNumbers: numbers,
        totalPrice: spent,
      });
    }

    // Profile.totalSpent tracks the net amount actually charged (order total
    // after discounts), not the gross ticket value. order-fulfillment is
    // provider-agnostic so it receives the net total via options.total.
    totalProfileSpent = options.total ?? 0;

    log.debug(
      `[fulfill.profile] totalProfileEntries=${totalProfileEntries} totalProfileSpent=${totalProfileSpent} ticketsClaimed=${ticketsClaimed}`
    );

    if (totalProfileEntries > 0 || totalProfileSpent > 0) {
      await deps.updateProfileStats(userIdObj, totalProfileEntries, totalProfileSpent, session);
      log.debug(
        `[fulfill.profile] updateProfileStats DONE delta.entries=${totalProfileEntries} delta.spent=${totalProfileSpent}`
      );
    }

    const referralBalanceUsed = options.referralBalanceUsed ?? 0;
    if (referralBalanceUsed > 0) {
      if (!deps.debitReferralWallet) {
        throw new Error("Referral wallet debit handler is not configured");
      }
      const debited = await deps.debitReferralWallet(userIdObj, referralBalanceUsed, session);
      log.debug(
        `[fulfill.wallet] debitReferralWallet amount=${referralBalanceUsed} success=${debited}`
      );
      if (!debited) {
        throw new Error("Insufficient referral wallet balance during fulfillment");
      }
    }

    if (options.shippingAddress?.addressLine1) {
      await deps.updateProfileAddress(userIdObj, options.shippingAddress);
      log.debug(`[fulfill.profile] updateProfileAddress DONE city=${options.shippingAddress.city}`);
    }
  } catch (fulfillmentErr) {
    logFulfillmentEvent(
      "fulfillment.order_failed",
      {
        logPrefix,
        orderId,
        userId,
        stage: "ticket_claim_and_profile_updates",
        error:
          fulfillmentErr instanceof Error
            ? { message: fulfillmentErr.message, stack: fulfillmentErr.stack }
            : String(fulfillmentErr),
      },
      "error"
    );
    if (deps.rollbackOrderFulfillment) {
      try {
        await deps.rollbackOrderFulfillment({
          orderId,
          userId,
          profileStatsDelta:
            ticketsClaimed && (totalProfileEntries > 0 || totalProfileSpent > 0)
              ? { entries: totalProfileEntries, spent: totalProfileSpent }
              : undefined,
          referralBalanceUsed:
            ticketsClaimed && (options.referralBalanceUsed ?? 0) > 0
              ? options.referralBalanceUsed
              : undefined,
          promoCode,
          session,
        });
      } catch (rollbackErr) {
        console.error(
          `[${logPrefix}] rollbackOrderFulfillment failed for order ${orderId}:`,
          rollbackErr
        );
      }
    } else {
      try {
        await deps.releaseByOrderId(orderId, session);
      } catch (rollbackErr) {
        console.error(`[${logPrefix}] releaseByOrderId failed for order ${orderId}:`, rollbackErr);
      }

      if (totalProfileEntries > 0 || totalProfileSpent > 0) {
        try {
          await deps.updateProfileStats(userIdObj, -totalProfileEntries, -totalProfileSpent);
        } catch (rollbackErr) {
          console.error(
            `[${logPrefix}] Profile stats rollback failed for order ${orderId}:`,
            rollbackErr
          );
        }
      }
    }

    throw fulfillmentErr;
  }

  try {
    const instantWinEmailItems = await grantInstantPrizeWinsForAssignedNumbers({
      userId,
      assignedNumbers: allAssignedNumbers,
      deps,
      session,
      logPrefix,
      competitionTitles: new Map(
        [...competitionMap.entries()].map(([competitionId, competition]) => [
          competitionId,
          competition.title,
        ])
      ),
    });

    if (instantWinEmailItems.length > 0) {
      logFulfillmentEvent("fulfillment.instant_wins_created", {
        logPrefix,
        orderId,
        userId,
        winsCount: instantWinEmailItems.length,
        competitionIds: allAssignedNumbers.map((entry) => entry.competitionId),
      });
      void deps.sendInstantWinEmail({ userId, wins: instantWinEmailItems }).catch((emailErr) => {
        console.error(`[${logPrefix}] sendInstantWinEmail failed for order ${orderId}:`, emailErr);
      });
      deps.onInstantWinGranted?.({
        userId,
        wins: instantWinEmailItems.map((w) => ({
          prizeTitle: w.prizeTitle,
          prizeValue: w.prizeValue,
        })),
      });
    }
  } catch (winErr) {
    logFulfillmentEvent(
      "fulfillment.order_failed",
      {
        logPrefix,
        orderId,
        userId,
        stage: "instant_win_grant",
        error:
          winErr instanceof Error
            ? { message: winErr.message, stack: winErr.stack }
            : String(winErr),
      },
      "error"
    );
    if (deps.rollbackOrderFulfillment) {
      try {
        await deps.rollbackOrderFulfillment({
          orderId,
          userId,
          profileStatsDelta: { entries: totalProfileEntries, spent: totalProfileSpent },
          referralBalanceUsed:
            (options.referralBalanceUsed ?? 0) > 0 ? options.referralBalanceUsed : undefined,
          promoCode,
          session,
        });
      } catch (rollbackErr) {
        console.error(
          `[${logPrefix}] rollbackOrderFulfillment failed for order ${orderId}:`,
          rollbackErr
        );
      }
    }
    throw winErr;
  }

  // Process bonus award milestone fires
  if (deps.notifyPendingBonusAwardFires) {
    try {
      await deps.notifyPendingBonusAwardFires({
        userId,
        assignedNumbers: allAssignedNumbers,
        session,
      });
    } catch (bonusAwardErr) {
      logFulfillmentEvent(
        "fulfillment.bonus_award_failed",
        {
          logPrefix,
          orderId,
          userId,
          competitionIds: allAssignedNumbers.map((entry) => entry.competitionId),
          error:
            bonusAwardErr instanceof Error
              ? { message: bonusAwardErr.message, stack: bonusAwardErr.stack }
              : String(bonusAwardErr),
        },
        "error"
      );
    }
  }

  const orderItemDocs = competitionIds
    .map((competitionId, i) => {
      const competition = competitionMap.get(competitionId);
      if (!competition) return null;
      const item = items[i];
      const qty = item?.quantity ?? 1;
      const paidQty = item?.paidQty ?? qty;
      return {
        orderId: orderIdObj,
        competitionId,
        quantity: qty,
        unitPrice: competition.ticketPrice,
        totalPrice: competition.ticketPrice * paidQty,
        ticketNumbers: allAssignedNumbers[i]?.ticketNumbers ?? [],
        entryIds: allAssignedNumbers[i]?.entryIds ?? [],
        answerIndex: item?.answerIndex ?? 0,
      };
    })
    .filter((doc): doc is NonNullable<typeof doc> => doc !== null);

  log.debug(`[fulfill.orderItems] building docs count=${orderItemDocs.length}`);
  for (let i = 0; i < orderItemDocs.length; i++) {
    const d = orderItemDocs[i]!;
    log.debug(
      `[fulfill.orderItems] doc[${i}] orderId=${d.orderId} compId=${d.competitionId} qty=${d.quantity} unitPrice=${d.unitPrice} totalPrice=${d.totalPrice} ticketNumbers.length=${d.ticketNumbers.length} entryIds.length=${d.entryIds.length}`
    );
  }

  if (orderItemDocs.length > 0) {
    try {
      await deps.createOrderItems(orderItemDocs, session);
      log.debug(`[fulfill.orderItems] createOrderItems DONE inserted=${orderItemDocs.length}`);
    } catch (orderItemErr) {
      logFulfillmentEvent(
        "fulfillment.order_failed",
        {
          logPrefix,
          orderId,
          userId,
          stage: "order_item_creation",
          error:
            orderItemErr instanceof Error
              ? { message: orderItemErr.message, stack: orderItemErr.stack }
              : String(orderItemErr),
        },
        "error"
      );
      if (deps.rollbackOrderFulfillment) {
        try {
          await deps.rollbackOrderFulfillment({
            orderId,
            userId,
            profileStatsDelta: { entries: totalProfileEntries, spent: totalProfileSpent },
            referralBalanceUsed:
              (options.referralBalanceUsed ?? 0) > 0 ? options.referralBalanceUsed : undefined,
            promoCode,
            session,
          });
        } catch (rollbackErr) {
          console.error(
            `[${logPrefix}] rollbackOrderFulfillment failed for order ${orderId}:`,
            rollbackErr
          );
        }
      }
      throw orderItemErr;
    }
  }

  const totalQuantity = items.reduce((sum, item) => sum + (item?.quantity ?? 1), 0);
  try {
    await deps.recordReferralPurchase({
      buyerUserId: userId,
      orderId,
      quantity: totalQuantity,
      orderTotal: options.total,
    });
    log.debug(
      `[fulfill.referral] recordReferralPurchase DONE buyerUserId=${userId} orderId=${orderId} quantity=${totalQuantity}`
    );
  } catch (refErr) {
    const refErrorMessage = refErr instanceof Error ? refErr.message : String(refErr);
    console.error(`[${logPrefix}] recordReferralPurchase failed for order ${orderId}:`, refErr);
    log.debug(`[fulfill.referral] recordReferralPurchase FAILED error=${refErrorMessage}`);
    if (deps.recordFailedReferral) {
      void deps.recordFailedReferral({ orderId, error: refErrorMessage }).catch((metaErr) => {
        console.error(`[${logPrefix}] recordFailedReferral failed for order ${orderId}:`, metaErr);
      });
    }
  }

  void deps
    .sendOrderConfirmationEmail({
      userId,
      orderId,
      orderNumber: options.orderNumber,
      orderDate: formatOrderDate(),
      items: emailItems,
      subtotal: options.subtotal,
      discount: options.discountAmount,
      total: options.total,
      orderEmail: options.orderEmail,
    })
    .catch((emailErr) => {
      console.error(
        `[${logPrefix}] sendOrderConfirmationEmail failed for order ${orderId}:`,
        emailErr
      );
    });

  logFulfillmentEvent("fulfillment.order_completed", {
    logPrefix,
    orderId,
    userId,
    competitionIds,
    totalQuantity,
    assignedCompetitionCount: allAssignedNumbers.length,
  });
  log.debug(
    `[fulfill.complete] orderId=${orderId} userId=${userId} totalQuantity=${totalQuantity} assignedCompetitions=${allAssignedNumbers.length} emailItems=${emailItems.length}`
  );

  return { emailItems, allAssignedNumbers, totalQuantity };
}

export interface ProcessBalanceTopUpOptions {
  orderId: string;
  userId: string;
  total: number;
  transactionId?: string;
  logPrefix: string;
  deps: BalanceTopUpDeps;
  session?: ClientSession;
}

export async function processBalanceTopUp(options: ProcessBalanceTopUpOptions): Promise<void> {
  const { orderId, userId, total, transactionId, logPrefix, deps, session } = options;

  const updated = await deps.updateBalance(new Types.ObjectId(userId), total, session);

  if (!updated) {
    logFulfillmentEvent(
      "fulfillment.balance_topup_failed",
      { logPrefix, orderId, userId, total },
      "error"
    );
    throw new Error(`Balance top-up failed for order ${orderId}: updateBalance returned null`);
  }

  if (transactionId) {
    await deps.updateBalanceTransaction(
      new Types.ObjectId(transactionId),
      "completed",
      updated.available,
      session
    );
  }

  console.log(`[${logPrefix}] Balance top-up completed for order ${orderId}`);
}

const log = createLogger("fulfillment");
