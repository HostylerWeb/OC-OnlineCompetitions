import { Competition } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { captureRouteError } from "@oc/api-infra/sentry";

export type CheckCompetitionsForDrawSummary = {
  checkedAt: string;
  modifiedCount: number;
  matchedCount: number;
  pendingEndCount: number;
};

/** Competitions whose ticket sales should close (earliest of endDate / drawDate). */
const salesClosedFilter = (now: Date) => ({
  $or: [{ endDate: { $lte: now } }, { drawDate: { $lte: now } }],
});

/** Ended competitions ready to enter the draw queue. */
const readyForPendingDrawFilter = (now: Date) => ({
  $or: [
    { drawDate: { $lte: now } },
    {
      $and: [
        {
          $or: [{ drawDate: null }, { drawDate: { $exists: false } }],
        },
        { endDate: { $lte: now } },
      ],
    },
  ],
});

export async function runCheckCompetitionsForDraw(): Promise<CheckCompetitionsForDrawSummary> {
  console.log("[check-competitions-for-draw] Running competition draw status check...");
  const now = new Date();

  try {
    await dbConnect();

    await Competition.updateMany(
      { status: "active", deletedAt: null, ...salesClosedFilter(now) },
      { $set: { status: "ended", updatedAt: now } }
    );

    const result = await Competition.updateMany(
      {
        status: "ended",
        deletedAt: null,
        ...readyForPendingDrawFilter(now),
      },
      {
        $set: { status: "pending_draw", updatedAt: now },
      }
    );

    const pendingEndCount =
      result.matchedCount > 0
        ? 0
        : await Competition.countDocuments({
            status: "ended",
            deletedAt: null,
            ...readyForPendingDrawFilter(now),
          });

    if (result.modifiedCount > 0) {
      console.log(
        `[check-competitions-for-draw] Transitioned ${result.modifiedCount} competition(s) to pending_draw`,
        { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }
      );

      await invalidateByChannelSafe(
        CH.competitions,
        CH.entries,
        CH.competitionFeatured,
        CH.competitionDetail,
        CH.stats,
        CH.landingPage,
        CH.competitionAvailability,
        CH.competitionsAvailabilityBatch
      );
    } else {
      console.log("[check-competitions-for-draw] No competitions require status update", {
        checkedAt: now.toISOString(),
        pendingEndCount,
      });
    }

    const stalePendingCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const stalePendingDraw = await Competition.countDocuments({
      status: "pending_draw",
      updatedAt: { $lte: stalePendingCutoff },
      deletedAt: null,
    });
    if (stalePendingDraw > 0) {
      console.warn(
        `[check-competitions-for-draw] SLA alert: ${stalePendingDraw} competition(s) stuck in pending_draw for >7 days`
      );
    }

    return {
      checkedAt: now.toISOString(),
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      pendingEndCount,
    };
  } catch (err: unknown) {
    console.error("[check-competitions-for-draw] Error during competition status check:", {
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      checkedAt: now.toISOString(),
    });
    captureRouteError(err, {
      domain: "jobs",
      jobName: "check-competitions-for-draw",
      operation: "runInternalJob",
    });
    throw err;
  }
}
