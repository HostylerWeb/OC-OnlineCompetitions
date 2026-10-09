import { CompetitionInstantPrize, InstantPrize, Winner } from "@oc/api-db/models";
import type { Types } from "mongoose";

export interface CompetitionWinnerSnapshot {
  prizeTitle?: string;
  prizeValue?: number;
}

/** Update winner snapshots when competition prize display fields change. */
export async function backpropagateCompetitionToWinners(
  competitionId: Types.ObjectId | string,
  snapshot: CompetitionWinnerSnapshot
): Promise<number> {
  const updates: Record<string, string | number> = {};

  if (snapshot.prizeTitle !== undefined) {
    updates.prizeTitle = snapshot.prizeTitle;
  }
  if (snapshot.prizeValue !== undefined) {
    updates.prizeValue = snapshot.prizeValue;
  }

  if (Object.keys(updates).length === 0) {
    return 0;
  }

  const result = await Winner.updateMany({ competitionId }, { $set: updates });

  return result.modifiedCount;
}

export async function countInstantPrizesLinkedToCompetition(
  competitionId: Types.ObjectId | string
): Promise<number> {
  return InstantPrize.countDocuments({ linkedCompetitionId: competitionId }).maxTimeMS(5000);
}

export async function countActiveCompetitionInstantPrizes(
  competitionId: Types.ObjectId | string
): Promise<number> {
  return CompetitionInstantPrize.countDocuments({
    competitionId,
    isArchived: { $ne: true },
  }).maxTimeMS(5000);
}
