import {
  BonusAwardFire,
  Competition,
  CompetitionBonusAwardAssignment,
  CompetitionInstantPrize,
  ComplianceAuditLog,
  InstantPrizeWin,
  Order,
} from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import {
  aggregateScopedTicketStatusGroups,
  groupScopedRowsByCompetition,
} from "@oc/api-tickets/scoped-ticket-stats";
import { getNum } from "@oc/env/server";

const DEFAULT_CLAIMED_COUNT_SAMPLE_LIMIT = 20;
const DEFAULT_STUCK_ORDER_SAMPLE_LIMIT = 20;
const DEFAULT_SOLD_MISMATCH_SAMPLE_LIMIT = 20;
const DEFAULT_STUCK_PROCESSING_THRESHOLD_MS = 10 * 60 * 1000;

type LogLevel = "info" | "warn" | "error";

function logTicketingEvent(
  event: string,
  payload: Record<string, unknown>,
  level: LogLevel = "info"
): void {
  const entry = {
    event,
    domain: "ticketing_observability",
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

interface ClaimedCountDrift {
  cipId: string;
  competitionId: string;
  quantity: number;
  claimedCount: number;
  winsCount: number;
  expectedClaimedCount: number;
}

async function detectClaimedCountDrift(limit: number): Promise<ClaimedCountDrift[]> {
  const cips = await CompetitionInstantPrize.find({ isArchived: { $ne: true } })
    .select("_id competitionId quantity claimedCount")
    .lean();

  if (cips.length === 0) return [];

  const cipIds = cips.map((cip) => cip._id);
  const winCounts = await InstantPrizeWin.aggregate<{ _id: unknown; count: number }>([
    { $match: { competitionInstantPrizeId: { $in: cipIds } } },
    { $group: { _id: "$competitionInstantPrizeId", count: { $sum: 1 } } },
  ]);
  const winsByCip = new Map(winCounts.map((row) => [String(row._id), row.count]));

  const drifts: ClaimedCountDrift[] = [];
  for (const cip of cips) {
    const winsCount = winsByCip.get(cip._id.toString()) ?? 0;
    const expectedClaimedCount = Math.min(Math.max(winsCount, 0), cip.quantity);
    if (cip.claimedCount !== expectedClaimedCount) {
      drifts.push({
        cipId: cip._id.toString(),
        competitionId: cip.competitionId.toString(),
        quantity: cip.quantity,
        claimedCount: cip.claimedCount,
        winsCount,
        expectedClaimedCount,
      });
      if (drifts.length >= limit) break;
    }
  }

  return drifts;
}

interface StuckProcessingOrder {
  orderId: string;
  userId: string;
  status: string;
  providerSessionId?: string;
  updatedAt?: string;
  lockToken?: string;
  lockExpiresAt?: string;
}

async function detectStuckProcessingOrders(
  limit: number,
  thresholdMs: number
): Promise<StuckProcessingOrder[]> {
  const threshold = new Date(Date.now() - thresholdMs);

  const orders = await Order.find({
    status: "processing",
    updatedAt: { $lt: threshold },
  })
    .select("_id userId status providerSessionId updatedAt metadata.fulfillmentLock")
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();

  return orders.map((order) => {
    const metadata = (order.metadata ?? {}) as Record<string, unknown>;
    const lock = (metadata.fulfillmentLock ?? {}) as Record<string, unknown>;

    return {
      orderId: order._id.toString(),
      userId: order.userId.toString(),
      status: order.status,
      providerSessionId:
        typeof order.providerSessionId === "string" ? order.providerSessionId : undefined,
      updatedAt: order.updatedAt?.toISOString(),
      lockToken: typeof lock.token === "string" ? lock.token : undefined,
      lockExpiresAt: lock.expiresAt ? new Date(String(lock.expiresAt)).toISOString() : undefined,
    };
  });
}

interface SoldCountMismatch {
  competitionId: string;
  title: string;
  maxTickets: number;
  soldScoped: number;
  soldRaw: number;
  heldScoped: number;
  heldRaw: number;
}

async function detectSoldCountMismatches(limit: number): Promise<SoldCountMismatch[]> {
  const { groups, competitions } = await aggregateScopedTicketStatusGroups();
  if (competitions.length === 0) return [];

  const compMap = new Map(
    competitions.map((competition) => [competition._id.toString(), competition])
  );
  const byCompetition = groupScopedRowsByCompetition(groups);

  const mismatches: SoldCountMismatch[] = [];
  for (const [competitionId, counts] of byCompetition) {
    if (counts.soldRaw !== counts.soldScoped || counts.heldRaw !== counts.heldScoped) {
      const competition = compMap.get(competitionId);
      if (!competition) continue;

      mismatches.push({
        competitionId,
        title: competition.title ?? "",
        maxTickets: competition.maxTickets,
        soldScoped: counts.soldScoped,
        soldRaw: counts.soldRaw,
        heldScoped: counts.heldScoped,
        heldRaw: counts.heldRaw,
      });

      const driftSold = counts.soldRaw - counts.soldScoped;
      const driftHeld = counts.heldRaw - counts.heldScoped;
      const autoRepair = process.env.TICKETING_ANOMALY_AUTO_REPAIR === "1";
      if (autoRepair) {
        if (driftSold !== 0) {
          await Competition.findByIdAndUpdate(competitionId, {
            $set: { ticketsSold: counts.soldRaw },
          });
        }
        if (driftHeld !== 0) {
          await Competition.findByIdAndUpdate(competitionId, {
            $set: { ticketsHeld: counts.heldRaw },
          });
        }
        void ComplianceAuditLog.create({
          actorId: null,
          targetUserId: null,
          action: "ticketing_anomaly_auto_repair",
          reason: `Repaired sold/held counters for competition ${competitionId}`,
          before: {
            soldScoped: counts.soldScoped,
            soldRaw: counts.soldRaw,
            heldScoped: counts.heldScoped,
            heldRaw: counts.heldRaw,
          },
          after: {
            ticketsSold: counts.soldRaw,
            ticketsHeld: counts.heldRaw,
          },
          source: "admin",
        }).catch(() => {});
        void invalidateByChannelSafe(
          CH.competitionAvailability,
          CH.competitionsAvailabilityBatch
        ).catch(() => {});
      } else if (driftSold !== 0 || driftHeld !== 0) {
        logTicketingEvent(
          "ticketing.sold_count_drift_detected",
          {
            competitionId,
            soldScoped: counts.soldScoped,
            soldRaw: counts.soldRaw,
            heldScoped: counts.heldScoped,
            heldRaw: counts.heldRaw,
          },
          "warn"
        );
      }

      if (mismatches.length >= limit) break;
    }
  }

  return mismatches;
}

async function checkBonusAwardDrift(): Promise<string> {
  const competitions = await Competition.find(
    { status: "active", deletedAt: null },
    { _id: 1, ticketsSold: 1, title: 1 }
  ).lean();

  console.log("[bonus-award-drift] checking %d active competitions", competitions.length);

  let driftedCount = 0;
  for (const comp of competitions) {
    console.log("[bonus-award-drift] comp=%s ticketsSold=%d", comp.title, comp.ticketsSold);

    const driftedAssignments = await CompetitionBonusAwardAssignment.find({
      competitionId: comp._id,
      isArchived: false,
      firedAt: { $exists: false },
      thresholdNumber: { $lte: comp.ticketsSold },
    })
      .populate("bonusAwardId")
      .lean();

    console.log(
      "[bonus-award-drift] comp=%s driftedAssignments=%d",
      comp.title,
      driftedAssignments.length
    );

    for (const assignment of driftedAssignments) {
      const awardTitle = (assignment.bonusAwardId as unknown as { title?: string })?.title ?? "";
      console.log(
        "[bonus-award-drift] drifted: assignmentId=%s milestonePct=%d thresholdNumber=%d awardTitle=%s",
        assignment._id,
        assignment.milestonePct,
        assignment.thresholdNumber,
        awardTitle
      );
      console.warn(
        `[bonus-award-drift] Competition "${comp.title}" (${comp._id}) has unfired bonus award ` +
          `at ${assignment.milestonePct}% (threshold ${assignment.thresholdNumber}, ` +
          `tickets sold ${comp.ticketsSold})` +
          (awardTitle ? ` — prize: ${awardTitle}` : "")
      );
      driftedCount++;
    }
  }
  console.log(
    "[bonus-award-drift] complete: checked=%d drifted=%d",
    competitions.length,
    driftedCount
  );
  return `checked bonus awards for ${competitions.length} competitions, found ${driftedCount} drifted assignments`;
}

export async function runTicketingAnomalyChecks(): Promise<void> {
  const claimedCountSampleLimit = getNum(
    "TICKETING_ANOMALY_CLAIMED_COUNT_SAMPLE_LIMIT",
    DEFAULT_CLAIMED_COUNT_SAMPLE_LIMIT
  );
  const stuckOrderSampleLimit = getNum(
    "TICKETING_ANOMALY_STUCK_ORDER_SAMPLE_LIMIT",
    DEFAULT_STUCK_ORDER_SAMPLE_LIMIT
  );
  const soldMismatchSampleLimit = getNum(
    "TICKETING_ANOMALY_SOLD_MISMATCH_SAMPLE_LIMIT",
    DEFAULT_SOLD_MISMATCH_SAMPLE_LIMIT
  );
  const stuckThresholdMs = getNum(
    "TICKETING_ANOMALY_STUCK_PROCESSING_THRESHOLD_MS",
    DEFAULT_STUCK_PROCESSING_THRESHOLD_MS
  );

  const startedAt = Date.now();
  await dbConnect();

  const [claimedCountDrift, stuckProcessingOrders, soldCountMismatches, bonusAwardDriftSummary] =
    await Promise.all([
      detectClaimedCountDrift(claimedCountSampleLimit),
      detectStuckProcessingOrders(stuckOrderSampleLimit, stuckThresholdMs),
      detectSoldCountMismatches(soldMismatchSampleLimit),
      checkBonusAwardDrift(),
    ]);

  if (claimedCountDrift.length > 0) {
    logTicketingEvent(
      "ticketing.claimed_count_drift_detected",
      {
        sampleSize: claimedCountDrift.length,
        sample: claimedCountDrift,
      },
      "warn"
    );
  }

  if (stuckProcessingOrders.length > 0) {
    logTicketingEvent(
      "ticketing.stuck_processing_orders_detected",
      {
        thresholdMs: stuckThresholdMs,
        sampleSize: stuckProcessingOrders.length,
        sample: stuckProcessingOrders,
      },
      "warn"
    );
  }

  if (soldCountMismatches.length > 0) {
    logTicketingEvent(
      "ticketing.sold_count_mismatch_detected",
      {
        sampleSize: soldCountMismatches.length,
        sample: soldCountMismatches,
      },
      "warn"
    );
  }

  logTicketingEvent("ticketing.bonus_award_drift_check", {
    summary: bonusAwardDriftSummary,
  });

  const durationMs = Date.now() - startedAt;
  const healthy =
    claimedCountDrift.length === 0 &&
    stuckProcessingOrders.length === 0 &&
    soldCountMismatches.length === 0;

  logTicketingEvent("ticketing.anomaly_check_heartbeat", {
    durationMs,
    healthy,
    claimedCountDrift: claimedCountDrift.length,
    stuckProcessingOrders: stuckProcessingOrders.length,
    soldCountMismatches: soldCountMismatches.length,
    bonusAwardDrift: bonusAwardDriftSummary,
  });

  if (!healthy) {
    logTicketingEvent("ticketing.anomaly_check_completed", {
      durationMs,
      claimedCountDrift: claimedCountDrift.length,
      stuckProcessingOrders: stuckProcessingOrders.length,
      soldCountMismatches: soldCountMismatches.length,
    });
  }
}

export async function checkStuckBonusAwardFires(): Promise<number> {
  const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000);
  const stuckFires = await BonusAwardFire.find({
    status: "pending",
    firedAt: { $lte: stuckThreshold },
  }).lean();

  for (const fire of stuckFires) {
    logTicketingEvent(
      "ticketing.stuck_bonus_award_fire_detected",
      {
        fireId: fire._id.toString(),
        assignmentId: fire.assignmentId.toString(),
        competitionId: fire.competitionId.toString(),
        firedAt: fire.firedAt?.toISOString(),
        status: fire.status,
      },
      "error"
    );
  }

  if (stuckFires.length > 0) {
    logTicketingEvent(
      "ticketing.stuck_bonus_award_fire_summary",
      {
        count: stuckFires.length,
        message: `Found ${stuckFires.length} stuck bonus award fire(s) needing manual intervention`,
      },
      "warn"
    );
  }

  return stuckFires.length;
}
