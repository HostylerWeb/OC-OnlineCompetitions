import type { Winner } from "@oc/types";

function getCompetitionImageUrl(winner: Winner): string | undefined {
  const comp =
    typeof winner.competitionId === "object" && winner.competitionId !== null
      ? winner.competitionId
      : null;
  return (
    comp?.prizeImageUrl?.trim() ||
    comp?.imageUrl?.trim() ||
    winner.competition?.prizeImageUrl?.trim() ||
    winner.competition?.imageUrl?.trim() ||
    undefined
  );
}

export function getPublicWinnerImageUrl(winner: Winner): string | undefined {
  return (
    winner.prizeImageUrl?.trim() ||
    winner.winnerPhotoUrl?.trim() ||
    getCompetitionImageUrl(winner)
  );
}

export function getPublicWinnerImageUrls(winner: Winner): string[] {
  const urls = [
    winner.prizeImageUrl?.trim(),
    winner.winnerPhotoUrl?.trim(),
    getCompetitionImageUrl(winner),
  ].filter(Boolean) as string[];
  return [...new Set(urls)];
}
