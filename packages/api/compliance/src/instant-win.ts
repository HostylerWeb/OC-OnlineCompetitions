import { CompetitionInstantPrize } from "@oc/api-db/models";

export async function cartHasInstantWinCompetitions(competitionIds: string[]): Promise<boolean> {
  if (competitionIds.length === 0) return false;

  const count = await CompetitionInstantPrize.countDocuments({
    competitionId: { $in: competitionIds },
    isArchived: { $ne: true },
    $expr: { $lt: ["$claimedCount", "$quantity"] },
  }).maxTimeMS(5000);

  return count > 0;
}
