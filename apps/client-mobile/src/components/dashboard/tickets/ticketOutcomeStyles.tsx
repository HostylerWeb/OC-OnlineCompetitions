"use client";

import type { Entry, MyEntriesStats } from "@oc/types";

export type DashboardTicketOutcome = "pending" | "winning" | "non-winning";

export function getCompetitionStatus(entry: Entry): string | undefined {
  const comp = entry.competitionId;
  return typeof comp === "object" && comp !== null ? comp.status : undefined;
}

export function getCompetitionId(entry: Entry): string {
  const comp = entry.competitionId;
  if (typeof comp === "object" && comp !== null) return comp._id;
  if (typeof comp === "string") return comp;
  return "";
}

export function isDrawWinner(entry: Entry, drawWinnerEntryIds: ReadonlySet<string>): boolean {
  return drawWinnerEntryIds.has(entry._id);
}

export function getEntryTicketOutcome(
  entry: Entry,
  drawWinnerEntryIds: ReadonlySet<string>
): DashboardTicketOutcome {
  if (entry.instantPrizeWinId || isDrawWinner(entry, drawWinnerEntryIds)) {
    return "winning";
  }

  const status = getCompetitionStatus(entry);
  if (status === "active") return "pending";
  return "non-winning";
}

export function getOutcomeStatusLabel(
  outcome: DashboardTicketOutcome,
  t: (key: string) => string
): string {
  switch (outcome) {
    case "pending":
      return t("dashboard.tickets.outcomes.pending");
    case "winning":
      return t("dashboard.tickets.outcomes.winner");
    case "non-winning":
      return t("dashboard.tickets.outcomes.noWin");
  }
}

export function buildDrawWinnerEntryIdSet(stats?: MyEntriesStats): ReadonlySet<string> {
  return new Set(stats?.drawWinnerEntryIds ?? []);
}
