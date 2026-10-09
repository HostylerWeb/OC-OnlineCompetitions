import type { CompetitionInstantPrizePublicDTO } from "@oc/api-client";
import type { PrizeTicketState } from "@/components/shared/TicketCard";
import {
  TICKET_ROW_GAP as ROW_GAP,
  PRIZE_TICKET_ROW_HEIGHT as ROW_HEIGHT,
  TICKET_COL_GAP,
} from "@/components/shared/ticketCardShared";

export interface InstantWinsSectionProps {
  competitionId: string;
}

export type TicketState = PrizeTicketState;

export interface TicketCardData {
  ticketNumber: number;
  state: TicketState;
  winnerName?: string;
  position: number;
}

export interface TicketRowProps {
  prize: CompetitionInstantPrizePublicDTO;
  ticketsPerRow?: number;
  ticketWidth?: number;
}

export { ROW_GAP, ROW_HEIGHT, TICKET_COL_GAP };
