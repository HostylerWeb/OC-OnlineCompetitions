import type { Types } from "mongoose";

export interface EntryDto {
  _id: string;
  id?: string;
  userId?: string;
  competitionId:
    | string
    | {
        _id: string;
        title?: string;
        slug?: string;
        prizeImageUrl?: string;
        imageUrl?: string;
        status?: string;
        drawDate?: string | Date;
        maxTickets?: number;
        ticketsSold?: number;
      };
  orderId?: string;
  entryNumber: number;
  ticketNumber: number;
  quantity: number;
  answerIndex?: number;
  answerCorrect?: boolean;
  instantPrizeWinId?: string;
  competitionTitle?: string;
  createdAt: string | Date;
}

type PopulatedCompetition = {
  _id?: Types.ObjectId | string;
  title?: string;
  slug?: string;
  prizeImageUrl?: string;
  imageUrl?: string;
  status?: string;
  drawDate?: Date | string;
  maxTickets?: number;
  ticketsSold?: number;
};

export interface TicketLike {
  _id: Types.ObjectId;
  ownerId?: Types.ObjectId;
  competitionId: Types.ObjectId | string | PopulatedCompetition;
  orderId?: Types.ObjectId;
  number: number;
  answerIndex?: number;
  answerCorrect?: boolean;
  instantPrizeWinId?: Types.ObjectId;
  soldAt?: Date;
  createdAt?: Date;
}

function isPopulatedCompetition(value: unknown): value is PopulatedCompetition {
  return typeof value === "object" && value !== null && "_id" in value;
}

/** Maps a sold Ticket to the legacy Entry API shape consumed by onlinecompetitions-web. */
export function ticketToEntryDto(ticket: TicketLike): EntryDto {
  const id = ticket._id.toString();
  const competitionId = isPopulatedCompetition(ticket.competitionId)
    ? {
        _id: ticket.competitionId._id?.toString() ?? "",
        title: ticket.competitionId.title,
        slug: ticket.competitionId.slug,
        prizeImageUrl: ticket.competitionId.prizeImageUrl,
        imageUrl: ticket.competitionId.imageUrl,
        status: ticket.competitionId.status,
        drawDate:
          ticket.competitionId.drawDate instanceof Date
            ? ticket.competitionId.drawDate.toISOString()
            : ticket.competitionId.drawDate,
        maxTickets: ticket.competitionId.maxTickets,
        ticketsSold: ticket.competitionId.ticketsSold,
      }
    : ((ticket.competitionId as string | null)?.toString() ?? "");

  return {
    _id: id,
    id,
    userId: ticket.ownerId?.toString(),
    competitionId,
    competitionTitle: typeof competitionId === "object" ? competitionId.title : undefined,
    orderId: ticket.orderId?.toString(),
    entryNumber: ticket.number,
    ticketNumber: ticket.number,
    quantity: 1,
    answerIndex: ticket.answerIndex,
    answerCorrect: ticket.answerCorrect,
    instantPrizeWinId: ticket.instantPrizeWinId?.toString(),
    createdAt: (ticket.soldAt ?? ticket.createdAt ?? new Date()).toISOString(),
  };
}

export function ticketsToEntryDtos(tickets: TicketLike[]): EntryDto[] {
  return tickets.map(ticketToEntryDto);
}
