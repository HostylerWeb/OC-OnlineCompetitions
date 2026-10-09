import { Profile, ReferralPurchase } from "@oc/api-db/models";
import { invalidateUser } from "@oc/api-infra/cache";
import mongoose from "mongoose";

async function countActivePairsForReferrer(referrerId: string): Promise<number> {
  const oid = new mongoose.Types.ObjectId(referrerId);
  const result = await ReferralPurchase.aggregate<{ n: number }>([
    { $match: { referrerId: oid, deletedAt: null } },
    {
      $group: {
        _id: { referrerId: "$referrerId", referredUserId: "$referredUserId" },
      },
    },
    { $count: "n" },
  ]);
  return result[0]?.n ?? 0;
}

async function writeReferralCount(referrerId: string, newCount: number): Promise<void> {
  const profile = await Profile.findById(referrerId).select("referralCount").lean();
  const current = profile?.referralCount ?? 0;
  if (newCount === current) return;
  await Profile.findByIdAndUpdate(referrerId, { $set: { referralCount: newCount } });
  void invalidateUser(referrerId).catch(() => {});
}

export async function reconcileReferralCount(referrerId: string): Promise<void> {
  const activePairs = await countActivePairsForReferrer(referrerId);
  await writeReferralCount(referrerId, activePairs);
}

export async function reconcileReferralCountOnDelete(
  referrerId: string,
  _referredUserId: string
): Promise<void> {
  const activePairs = await countActivePairsForReferrer(referrerId);
  await writeReferralCount(referrerId, activePairs);
}

export async function reconcileReferralCountOnRestore(
  referrerId: string,
  _referredUserId: string
): Promise<void> {
  const activePairs = await countActivePairsForReferrer(referrerId);
  await writeReferralCount(referrerId, activePairs);
}

export async function reconcileReferralCountOnReassign(params: {
  userId: string;
  oldReferrerId: string | null;
  newReferrerId: string | null;
}): Promise<void> {
  const { oldReferrerId, newReferrerId } = params;
  if (oldReferrerId === newReferrerId) return;

  const affected = new Set<string>();
  if (oldReferrerId) affected.add(oldReferrerId);
  if (newReferrerId) affected.add(newReferrerId);

  for (const referrerId of affected) {
    const activePairs = await countActivePairsForReferrer(referrerId);
    await writeReferralCount(referrerId, activePairs);
  }
}
