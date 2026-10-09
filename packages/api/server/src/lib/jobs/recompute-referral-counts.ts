#!/usr/bin/env bun
/**
 * Recompute `Profile.referralCount` for every user from `ReferralPurchase` documents.
 *
 * `referralCount` is a denormalized counter incremented in `recordReferralPurchase`.
 * It can drift from the source of truth when:
 *   - An admin soft-deletes a referral purchase (counter not decremented)
 *   - An admin restores a soft-deleted purchase (counter not re-incremented)
 *   - An admin reassigns a user's referrer (counter not moved between users)
 *
 * This script walks every Profile and rewrites `referralCount` to equal the count
 * of distinct referred users with at least one non-deleted ReferralPurchase document.
 *
 * Usage:
 *   bun run packages/api/server/src/lib/jobs/recompute-referral-counts.ts
 *   bun run packages/api/server/src/lib/jobs/recompute-referral-counts.ts --dry-run
 *   bun run packages/api/server/src/lib/jobs/recompute-referral-counts.ts --userId=<oid>
 *   bun run packages/api/server/src/lib/jobs/recompute-referral-counts.ts --verbose
 */

import { Profile, ReferralPurchase } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import mongoose from "mongoose";

interface Args {
  dryRun: boolean;
  verbose: boolean;
  userId: string | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = { dryRun: true, verbose: false, userId: null };
  for (const arg of args) {
    if (arg === "--apply") result.dryRun = false;
    if (arg === "--dry-run") result.dryRun = true;
    if (arg === "--verbose" || arg === "-v") result.verbose = true;
    if (arg.startsWith("--userId=")) result.userId = arg.slice("--userId=".length);
  }
  return result;
}

interface UserCountRow {
  _id: mongoose.Types.ObjectId;
  activeCount: number;
}

async function computeLiveCounts(): Promise<Map<string, number>> {
  const rows = await ReferralPurchase.aggregate<UserCountRow>([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: { referrerId: "$referrerId", referredUserId: "$referredUserId" },
      },
    },
    {
      $group: {
        _id: "$_id.referrerId",
        activeCount: { $sum: 1 },
      },
    },
  ]);

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row._id.toString(), row.activeCount);
  }
  return map;
}

async function main() {
  const args = parseArgs();

  console.log(
    `[recompute-referral-counts] starting (dryRun=${args.dryRun}, verbose=${args.verbose})`
  );
  await dbConnect();

  const liveCounts = await computeLiveCounts();

  const profileFilter: Record<string, unknown> = {};
  if (args.userId) {
    if (!mongoose.Types.ObjectId.isValid(args.userId)) {
      console.error(`[recompute-referral-counts] invalid --userId: ${args.userId}`);
      process.exit(1);
    }
    profileFilter._id = new mongoose.Types.ObjectId(args.userId);
  }

  const cursor = Profile.find(profileFilter, { _id: 1, referralCount: 1, email: 1 })
    .lean()
    .cursor();
  let scanned = 0;
  let updated = 0;
  let alreadyCorrect = 0;
  const drifts: Array<{
    userId: string;
    email: string | null;
    oldCount: number;
    newCount: number;
  }> = [];

  for await (const profile of cursor) {
    scanned++;
    const userId = profile._id.toString();
    const liveCount = liveCounts.get(userId) ?? 0;
    const storedCount = profile.referralCount ?? 0;

    if (liveCount === storedCount) {
      alreadyCorrect++;
      if (args.verbose) {
        console.log(`  ✓ ${profile.email ?? userId} → ${storedCount} (unchanged)`);
      }
      continue;
    }

    drifts.push({
      userId,
      email: profile.email ?? null,
      oldCount: storedCount,
      newCount: liveCount,
    });

    if (!args.dryRun) {
      await Profile.updateOne({ _id: profile._id }, { $set: { referralCount: liveCount } });
      updated++;
    }
  }

  console.log(
    `[recompute-referral-counts] scanned=${scanned} alreadyCorrect=${alreadyCorrect} updated=${updated} drifts=${drifts.length}`
  );
  if (drifts.length > 0) {
    console.log("[recompute-referral-counts] drift details (first 50):");
    for (const drift of drifts.slice(0, 50)) {
      const delta = drift.newCount - drift.oldCount;
      const sign = delta > 0 ? "+" : "";
      console.log(
        `  ${drift.email ?? drift.userId}: ${drift.oldCount} → ${drift.newCount} (${sign}${delta})`
      );
    }
    if (drifts.length > 50) {
      console.log(`  ... and ${drifts.length - 50} more`);
    }
  }

  if (args.dryRun) {
    console.log(
      "[recompute-referral-counts] DRY RUN — no changes persisted. Re-run with --apply to commit."
    );
  } else if (updated > 0) {
    console.log(`[recompute-referral-counts] committed ${updated} corrections.`);
  } else {
    console.log("[recompute-referral-counts] nothing to commit.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[recompute-referral-counts] fatal:", err);
  process.exit(1);
});
