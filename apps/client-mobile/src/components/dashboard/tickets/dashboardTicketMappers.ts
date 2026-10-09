import type { Entry } from "@oc/types";

export function buildDashboardPillProps(entries: Entry[]): number[] {
  const numbers: number[] = [];
  for (const entry of entries) {
    const value = entry.ticketNumber ?? entry.entryNumber;
    if (typeof value === "number") numbers.push(value);
  }
  return numbers;
}
