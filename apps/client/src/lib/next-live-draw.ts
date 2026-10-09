import type { Competition } from "@oc/types";
import { getCompetitionCountdownTarget } from "@oc/utils";

export type NextLiveDrawGroup = {
  targetIso: string;
  competitions: Competition[];
};

export function findNextLiveDrawGroup(competitions: Competition[]): NextLiveDrawGroup | null {
  const seen = new Set<string>();
  const now = Date.now();
  const upcoming: { competition: Competition; targetIso: string; at: number }[] = [];

  for (const comp of competitions) {
    const id = comp._id ?? comp.id;
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    if (comp.status !== "active") continue;

    const targetIso = getCompetitionCountdownTarget({
      drawDate: comp.drawDate,
      endDate: comp.endDate,
    });
    if (!targetIso) continue;

    const at = new Date(targetIso).getTime();
    if (at <= now) continue;

    upcoming.push({ competition: comp, targetIso, at });
  }

  if (upcoming.length === 0) return null;

  const earliestAt = Math.min(...upcoming.map((row) => row.at));
  const tied = upcoming
    .filter((row) => row.at === earliestAt)
    .map((row) => row.competition)
    .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" }));

  const targetIso = upcoming.find((row) => row.at === earliestAt)?.targetIso;
  if (!targetIso || tied.length === 0) return null;

  return { targetIso, competitions: tied };
}

/** @deprecated Prefer findNextLiveDrawGroup */
export function findNextLiveDraw(
  competitions: Competition[]
): { competition: Competition; targetIso: string } | null {
  const group = findNextLiveDrawGroup(competitions);
  if (!group) return null;
  return { competition: group.competitions[0], targetIso: group.targetIso };
}
