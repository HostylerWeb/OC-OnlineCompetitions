import type { Winner } from "@oc/types";

export const HOMEPAGE_WINNERS_LIMIT = 6;

export function takeRecentWinners(
  winners: Winner[],
  limit = HOMEPAGE_WINNERS_LIMIT
): Winner[] {
  return [...winners]
    .sort(
      (a, b) =>
        new Date(b.drawnAt ?? 0).getTime() - new Date(a.drawnAt ?? 0).getTime()
    )
    .slice(0, limit);
}
