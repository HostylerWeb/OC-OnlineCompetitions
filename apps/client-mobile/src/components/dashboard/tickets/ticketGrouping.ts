import type { Entry } from "@oc/types";
import { getCompetitionId } from "./ticketOutcomeStyles";

type CompetitionInfo = Exclude<Entry["competitionId"], string>;

export const ORPHANED_COMPETITION_ID = "__orphaned__";

export interface CompetitionGroup {
  comp: NonNullable<CompetitionInfo>;
  entries: Entry[];
}

function getOrphanedCompetitionTitle(entries: Entry[], t?: (key: string) => string): string {
  const tf = t ?? ((key: string) => key);
  return (
    entries.find((entry) => entry.competitionTitle)?.competitionTitle ??
    tf("dashboard.tickets.unknownCompetition")
  );
}

export function groupEntriesByCompetition(entries: Entry[]): CompetitionGroup[] {
  const map: Record<string, CompetitionGroup> = {};
  const orphaned: Entry[] = [];

  for (const entry of entries) {
    const comp = entry.competitionId;
    if (typeof comp === "object" && comp !== null) {
      const key = comp._id;
      if (!map[key]) map[key] = { comp, entries: [] };
      map[key].entries.push(entry);
    } else {
      orphaned.push(entry);
    }
  }

  const groups = Object.values(map);
  if (orphaned.length > 0) {
    groups.push({
      comp: {
        _id: ORPHANED_COMPETITION_ID,
        title: getOrphanedCompetitionTitle(orphaned),
        status: "ended",
      } as NonNullable<CompetitionInfo>,
      entries: orphaned,
    });
  }

  return groups;
}

export function sortCompetitionGroups(groups: CompetitionGroup[]): CompetitionGroup[] {
  return [...groups].sort((a, b) => {
    const aMax = Math.max(...a.entries.map((entry) => new Date(entry.createdAt).getTime()));
    const bMax = Math.max(...b.entries.map((entry) => new Date(entry.createdAt).getTime()));
    return bMax - aMax;
  });
}

export function getLastCompetitionIdForInfiniteScroll(
  groups: CompetitionGroup[]
): string | undefined {
  return groups.filter((group) => group.comp._id !== ORPHANED_COMPETITION_ID).at(-1)?.comp._id;
}

export { getCompetitionId };
