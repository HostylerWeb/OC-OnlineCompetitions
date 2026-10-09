"use client";

import type { Entry } from "@oc/types";
import { TicketNumberPill } from "@/components/shared/TicketNumberPill";

export interface EntryTicketRowProps {
  entries: Entry[];
  className?: string;
}

export function EntryTicketRow({ entries, className }: EntryTicketRowProps) {
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-2 ${className ?? ""}`.trim()}>
      {entries.map((entry) => {
        const value = entry.ticketNumber ?? entry.entryNumber;
        if (typeof value !== "number") return null;
        return <TicketNumberPill key={entry._id ?? value} value={value} />;
      })}
    </div>
  );
}
