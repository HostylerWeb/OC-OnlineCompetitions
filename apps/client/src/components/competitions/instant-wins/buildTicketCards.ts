import type { CompetitionInstantPrizePublicDTO } from "@oc/api-client";
import type { TicketCardData } from "./types";

export function buildTicketCards(
  prize: CompetitionInstantPrizePublicDTO,
  ticketsPerRow: number,
  startPosition: number
): TicketCardData[] {
  const cards: TicketCardData[] = [];

  for (let col = 0; col < ticketsPerRow; col++) {
    const position = startPosition + col;
    if (position >= prize.quantity) break;

    const entryAtPosition = prize.winningEntryNumbers?.[position] || 0;
    const ticketNumber = entryAtPosition ?? position + 1;

    let state: TicketCardData["state"] = "available";
    let winnerName: string | undefined;
    if (entryAtPosition === null || entryAtPosition === undefined) {
      state = "invalid";
    } else if (entryAtPosition) {
      const winnerEntry = prize.winnerEntries?.find(
        (w: { ticketNumber?: number }) => w.ticketNumber === entryAtPosition
      );
      if (winnerEntry) {
        state = "won-claimed";
        winnerName = winnerEntry.userFullName;
      } else {
        state = "won-unclaimed";
      }
    }
    cards.push({
      ticketNumber,
      state,
      winnerName,
      position,
    });
  }

  return cards;
}
