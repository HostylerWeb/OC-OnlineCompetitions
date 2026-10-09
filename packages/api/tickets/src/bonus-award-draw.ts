import {
  BonusAward,
  BonusAwardFire,
  BonusAwardWin,
  Competition,
  CompetitionBonusAwardAssignment,
  type IBonusAwardWin,
  Ticket,
} from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import { type ClientSession, Types } from "mongoose";

function sessionOpts(session?: ClientSession) {
  return session ? { session } : {};
}

export async function checkBonusAwardMilestones(
  competitionId: Types.ObjectId,
  ticketsSold: number,
  session?: ClientSession
): Promise<Types.ObjectId[]> {
  console.log(
    "[bonus-award] checkBonusAwardMilestones: competitionId=%s ticketsSold=%d",
    competitionId,
    ticketsSold
  );
  let assignments = await CompetitionBonusAwardAssignment.find({
    competitionId,
    isArchived: false,
    firedAt: { $exists: false },
    thresholdNumber: { $lte: ticketsSold },
  })
    .session(session ?? null)
    .lean();

  for (const a of assignments) {
    console.log(
      "[bonus-award] checkBonusAwardMilestones: assignmentId=%s bonusAwardId=%s milestonePct=%d thresholdNumber=%d ticketsSold=%d",
      a._id,
      a.bonusAwardId,
      a.milestonePct,
      a.thresholdNumber,
      ticketsSold
    );
  }

  const allAssignments = await CompetitionBonusAwardAssignment.find({
    competitionId,
  })
    .select("milestonePct thresholdNumber isArchived firedAt")
    .sort({ milestonePct: 1 })
    .lean();
  for (const a of allAssignments) {
    console.log(
      "[BONUS-DIAG] checkBonusAwardMilestones: compId=%s allAssignment pct=%d threshold=%d archived=%s firedAt=%s",
      competitionId,
      a.milestonePct,
      a.thresholdNumber,
      a.isArchived,
      a.firedAt ?? "null"
    );
  }

  console.log(
    "[bonus-award] checkBonusAwardMilestones: qualifyingAssignments=%d totalAssignments=%d",
    assignments.length,
    allAssignments.length
  );

  if (assignments.length > 0) {
    const awardIds = [...new Set(assignments.map((a) => a.bonusAwardId))];
    const activeAwards = await BonusAward.find(
      { _id: { $in: awardIds }, isActive: true },
      { _id: 1 }
    )
      .session(session ?? null)
      .lean();
    const activeAwardIds = new Set(activeAwards.map((a) => a._id.toString()));
    assignments = assignments.filter((a) => activeAwardIds.has(a.bonusAwardId.toString()));
    console.log(
      "[bonus-award] checkBonusAwardMilestones: passingAssignments=%s",
      assignments.map((a) => a._id).join(",")
    );
  }

  console.log("[bonus-award] checkBonusAwardMilestones: afterActiveFilter=%d", assignments.length);

  const firedIds: Types.ObjectId[] = [];

  for (const assignment of assignments) {
    // Phase 1: Check if fire already exists (avoid upsert race entirely)
    let fire = await BonusAwardFire.findOne({ assignmentId: assignment._id })
      .session(session ?? null)
      .lean();

    if (!fire) {
      // Phase 2: Create the fire using updateOne with upsert (no new:true/returnDocument issue)
      try {
        await BonusAwardFire.updateOne(
          { assignmentId: assignment._id },
          {
            $setOnInsert: {
              assignmentId: assignment._id,
              bonusAwardId: assignment.bonusAwardId,
              competitionId,
              milestonePct: assignment.milestonePct,
              ticketsSoldAtFire: ticketsSold,
              firedAt: new Date(),
              status: "pending",
            },
          },
          { upsert: true, ...sessionOpts(session) }
        );
        fire = await BonusAwardFire.findOne({ assignmentId: assignment._id })
          .session(session ?? null)
          .lean();
      } catch (err: unknown) {
        const mongoErr = err as { code?: number; message?: string };
        if (mongoErr.code === 11000) {
          console.warn(
            "[bonus-award] checkBonusAwardMilestones: E11000 race on assignmentId=%s, fetching existing fire",
            assignment._id
          );
          fire = await BonusAwardFire.findOne({ assignmentId: assignment._id })
            .session(session ?? null)
            .lean();
        } else {
          console.error(
            "[bonus-award] checkBonusAwardMilestones: unexpected error creating fire for assignmentId=%s: code=%s message=%s",
            assignment._id,
            mongoErr.code,
            mongoErr.message ?? "unknown"
          );
          throw err;
        }
      }
      if (!fire) {
        console.error(
          "[bonus-award] checkBonusAwardMilestones: fire creation failed for assignmentId=%s — fire not found after upsert",
          assignment._id
        );
        continue;
      }
    }

    if (fire.status !== "pending") continue;

    console.log(
      "[bonus-award] checkBonusAwardMilestones: creatingFire assignmentId=%s fireId=%s",
      assignment._id,
      fire._id
    );

    await CompetitionBonusAwardAssignment.updateOne(
      { _id: assignment._id, firedAt: { $exists: false } },
      { $set: { firedAt: fire.firedAt } },
      sessionOpts(session)
    );

    firedIds.push(fire._id);
  }

  console.log(
    "[bonus-award] checkBonusAwardMilestones: firesCreated=%d firedIds=%s",
    firedIds.length,
    firedIds.join(",")
  );
  void invalidateByChannelSafe(
    CH.bonusAwardAssignments,
    CH.bonusAwardTemplates,
    CH.bonusAwardWins,
    CH.competitions,
    CH.competitionDetail,
    CH.landingPage
  ).catch(() => {});

  console.log(
    "[bonus-award] checkBonusAwardMilestones: complete returnedFiredIds=%s",
    firedIds.join(",")
  );

  return firedIds;
}

export async function pickPendingBonusAwardWinners(
  fireIds: Types.ObjectId[],
  notifier: (wins: IBonusAwardWin[]) => Promise<void>,
  session?: ClientSession,
  isGuest?: boolean
): Promise<void> {
  for (const fireId of fireIds) {
    console.log("[bonus-award] pickPendingBonusAwardWinners: fireId=%s", fireId);
    const fire = await BonusAwardFire.findOneAndUpdate(
      { _id: fireId, status: "pending" },
      { $set: { status: "drawing" } },
      { returnDocument: "after", ...sessionOpts(session) }
    ).lean();
    console.log("[bonus-award] pickPendingBonusAwardWinners: fireId=%s status=drawing", fireId);
    if (!fire) continue;

    const assignment = await CompetitionBonusAwardAssignment.findById(fire.assignmentId)
      .session(session ?? null)
      .lean();
    console.log(
      "[bonus-award] pickPendingBonusAwardWinners: fireId=%s assignmentFound=%s",
      fireId,
      assignment?._id ?? null
    );
    if (!assignment) {
      await BonusAwardFire.updateOne(
        { _id: fireId, status: "drawing" },
        {
          $set: {
            status: "failed",
            error: "CompetitionBonusAwardAssignment not found",
            drawnAt: new Date(),
          },
        },
        sessionOpts(session)
      );
      continue;
    }

    const award = await BonusAward.findById(fire.bonusAwardId)
      .session(session ?? null)
      .lean();
    console.log(
      "[bonus-award] pickPendingBonusAwardWinners: fireId=%s awardFound=%s",
      fireId,
      award?._id ?? null
    );
    if (!award) {
      await BonusAwardFire.updateOne(
        { _id: fireId, status: "drawing" },
        {
          $set: {
            status: "failed",
            error: "BonusAward not found",
            drawnAt: new Date(),
          },
        },
        sessionOpts(session)
      );
      continue;
    }

    const prizeTitle = award.title;
    const prizeValue = award.value ?? 0;
    const prizeImage = award.images?.[0];

    console.log(
      "[bonus-award] pickPendingBonusAwardWinners: fireId=%s aggregatingTickets competitionId=%s thresholdNumber=%d quantity=%d",
      fireId,
      fire.competitionId,
      assignment.thresholdNumber,
      assignment.quantity
    );

    const allSoldTickets: Array<{ number: number; ownerId?: Types.ObjectId; soldAt?: Date }> =
      await Ticket.find({
        competitionId: fire.competitionId,
        status: "sold",
      })
        .select("number ownerId soldAt")
        .sort({ number: 1 })
        .lean();
    const eligibleSoldTickets = await Ticket.find({
      competitionId: fire.competitionId,
      status: "sold",
      soldAt: { $lte: fire.firedAt },
    })
      .select("number ownerId")
      .sort({ number: 1 })
      .lean();
    console.log(
      "[BONUS-DIAG] pickPendingBonusAwardWinners: fireId=%s threshold=%d firedAt=%s all=%d eligible=%d soldTickets=%s",
      fireId,
      assignment.thresholdNumber,
      fire.firedAt.toISOString(),
      allSoldTickets.length,
      eligibleSoldTickets.length,
      allSoldTickets
        .map((t) => `#${t.number}[soldAt=${t.soldAt?.toISOString() ?? "null"}]`)
        .join(",")
    );

    const existingWinNumbers = await BonusAwardWin.distinct("ticketNumber", {
      competitionId: fire.competitionId,
      deletedAt: null,
    }).session(session ?? null);

    const candidates = await Ticket.aggregate<{
      _id: Types.ObjectId;
      number: number;
      ownerId: Types.ObjectId;
    }>(
      [
        {
          $match: {
            competitionId: fire.competitionId,
            status: "sold",
            soldAt: { $lte: fire.firedAt },
            number: { $nin: existingWinNumbers },
          },
        },
        { $sort: { number: 1 } },
        { $limit: assignment.thresholdNumber },
        { $sample: { size: assignment.quantity } },
        { $project: { number: 1, ownerId: 1, _id: 1 } },
      ],
      session ? { session } : {}
    );

    for (const [i, c] of candidates.entries()) {
      console.log(
        "[bonus-award] pickPendingBonusAwardWinners: fireId=%s candidate[%d] ticketId=%s ticketNumber=%d ownerId=%s",
        fireId,
        i,
        c._id,
        c.number,
        c.ownerId
      );
    }

    console.log(
      "[bonus-award] pickPendingBonusAwardWinners: fireId=%s eligibleCandidates=%d",
      fireId,
      candidates.length
    );

    if (candidates.length < assignment.quantity) {
      await BonusAwardFire.updateOne(
        { _id: fireId, status: "drawing" },
        {
          $set: {
            status: "no_eligible_tickets",
            drawnAt: new Date(),
            error: `Only ${candidates.length} eligible tickets found, needed ${assignment.quantity}`,
          },
        },
        sessionOpts(session)
      );
      console.log(
        "[bonus-award] pickPendingBonusAwardWinners: fireId=%s no_eligible_tickets (found=%d needed=%d)",
        fireId,
        candidates.length,
        assignment.quantity
      );
      continue;
    }

    const winDocs = candidates.map((c) => ({
      bonusAwardFireId: fireId,
      assignmentId: fire.assignmentId,
      bonusAwardId: fire.bonusAwardId,
      competitionId: fire.competitionId,
      userId: c.ownerId,
      entryId: c._id,
      ticketNumber: c.number,
      prizeTitle,
      prizeValue,
      ...(prizeImage ? { prizeImage } : {}),
      wonAt: new Date(),
      claimed: false,
    }));

    let wins: Awaited<ReturnType<typeof BonusAwardWin.insertMany>>;
    try {
      wins = await BonusAwardWin.insertMany(winDocs, sessionOpts(session));
    } catch (err) {
      const mongoErr = err as { code?: number; writeErrors?: Array<{ code: number }> };
      if (mongoErr.code === 11000) {
        console.warn(
          "[bonus-award] pickPendingBonusAwardWinners: fireId=%s E11000 duplicate key, marking as no_eligible_tickets",
          fireId
        );
        await BonusAwardFire.updateOne(
          { _id: fireId, status: "drawing" },
          {
            $set: {
              status: "no_eligible_tickets",
              drawnAt: new Date(),
              error: `Duplicate key error: ${(err as Error).message}`,
            },
          },
          sessionOpts(session)
        );
        continue;
      }
      throw err;
    }
    console.log(
      "[bonus-award] pickPendingBonusAwardWinners: fireId=%s insertingWins count=%d",
      fireId,
      wins.length
    );

    await BonusAwardFire.updateOne(
      { _id: fireId, status: "drawing" },
      { $set: { status: "drawn", drawnAt: new Date() } },
      sessionOpts(session)
    );
    console.log(
      "[bonus-award] pickPendingBonusAwardWinners: fireId=%s status=drawn drawnAt=%s",
      fireId,
      new Date().toISOString()
    );

    await CompetitionBonusAwardAssignment.updateOne(
      { _id: fire.assignmentId },
      { $inc: { wonCount: wins.length } },
      sessionOpts(session)
    );

    await BonusAward.updateOne(
      { _id: fire.bonusAwardId },
      { $inc: { totalWins: wins.length } },
      sessionOpts(session)
    );

    const winIds = wins.map((w) => w._id);
    if (isGuest) {
      await BonusAwardWin.updateMany(
        { _id: { $in: winIds } },
        { $set: { claimed: true, claimedAt: new Date() } },
        sessionOpts(session)
      );
      console.log(
        "[bonus-award] pickPendingBonusAwardWinners: fireId=%s autoClaimed for isGuest=%s",
        fireId,
        isGuest
      );
    }

    console.log("[bonus-award] pickPendingBonusAwardWinners: fireId=%s calling notifier", fireId);
    await notifier(wins as unknown as IBonusAwardWin[]);
    console.log("[bonus-award] pickPendingBonusAwardWinners: fireId=%s notifier complete", fireId);

    console.log(
      "[bonus-award] pickPendingBonusAwardWinners: fireId=%s winnersDrawn=%d",
      fireId,
      wins.length
    );
  }

  console.log(
    "[bonus-award] pickPendingBonusAwardWinners: complete processedFires=%d",
    fireIds.length
  );

  void invalidateByChannelSafe(
    CH.bonusAwardAssignments,
    CH.bonusAwardTemplates,
    CH.bonusAwardWins,
    CH.competitions,
    CH.competitionDetail,
    CH.landingPage
  ).catch(() => {});
}

export async function processBonusAwardFires(params: {
  competitionIds: string[];
  session?: ClientSession;
  isGuest?: boolean;
  onWins?: (
    wins: IBonusAwardWin[],
    pendingFires: Array<{ _id: Types.ObjectId; milestonePct: number }>,
    competitionName: string
  ) => Promise<void>;
}): Promise<void> {
  const { competitionIds, session, isGuest, onWins } = params;

  for (const compIdStr of competitionIds) {
    console.log("[bonus-award] processBonusAwardFires: compId=%s", compIdStr);
    try {
      const compId = new Types.ObjectId(compIdStr);

      const comp = await Competition.findById(compId).select("ticketsSold status title").lean();
      if (comp?.status !== "active") {
        console.log(
          "[bonus-award] processBonusAwardFires: compId=%s skipping (not found or not active)",
          compIdStr
        );
        continue;
      }

      console.log(
        "[bonus-award] processBonusAwardFires: compId=%s safety-net checkBonusAwardMilestones ticketsSold=%d",
        compIdStr,
        comp.ticketsSold
      );
      await checkBonusAwardMilestones(compId, comp.ticketsSold, session);

      const pendingFires = await BonusAwardFire.find({
        competitionId: compId,
        status: "pending",
      })
        .session(session ?? null)
        .lean();

      for (const pf of pendingFires) {
        console.log(
          "[bonus-award] processBonusAwardFires: compId=%s pendingFireId=%s milestonePct=%d",
          compIdStr,
          pf._id,
          pf.milestonePct
        );
      }

      console.log(
        "[bonus-award] processBonusAwardFires: compId=%s pendingFires=%d",
        compIdStr,
        pendingFires.length
      );

      if (pendingFires.length === 0) continue;

      const competitionName = comp.title ?? "Competition";
      console.log(
        "[bonus-award] processBonusAwardFires: compId=%s competitionName=%s",
        compIdStr,
        competitionName
      );
      const fireIds = pendingFires.map((f) => f._id);

      await pickPendingBonusAwardWinners(
        fireIds,
        async (wins) => {
          if (onWins) {
            await onWins(wins as unknown as IBonusAwardWin[], pendingFires, competitionName);
          }
        },
        session,
        isGuest
      );
      console.log("[bonus-award] processBonusAwardFires: compId=%s completed", compIdStr);
    } catch (err) {
      console.error("[bonus-award] processBonusAwardFires error:", err);
    }
  }
}
