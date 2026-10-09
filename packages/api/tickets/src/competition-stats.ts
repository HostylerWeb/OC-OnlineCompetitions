import {
  getCompetitionTicketStats,
  getCompetitionTicketStatsBatch,
} from "@oc/api-tickets/ticket-service";

export async function enrichCompetitionWithTicketStats<
  T extends {
    maxTickets?: number;
    status?: string;
    _id?: unknown;
    ticketsSold?: number;
    ticketsHeld?: number;
  },
>(
  competition: T
): Promise<
  T & {
    ticketsSold: number;
    ticketsHeld: number;
    availableTickets: number;
    percentageTaken: number;
  }
> {
  const id = (competition._id as { toString(): string }).toString();
  const stats = await getCompetitionTicketStats(id, {
    maxTickets: competition.maxTickets,
    status: competition.status,
    ticketsSold: competition.ticketsSold,
    ticketsHeld: competition.ticketsHeld,
  });
  return {
    ...competition,
    ticketsSold: stats.sold,
    ticketsHeld: stats.held,
    availableTickets: stats.available,
    percentageTaken: stats.percentageTaken,
  };
}

export async function enrichCompetitionsWithTicketStats<
  T extends {
    maxTickets?: number;
    status?: string;
    _id?: unknown;
    ticketsSold?: number;
    ticketsHeld?: number;
  },
>(
  competitions: T[]
): Promise<
  Array<
    T & {
      ticketsSold: number;
      ticketsHeld: number;
      availableTickets: number;
      percentageTaken: number;
    }
  >
> {
  if (competitions.length === 0) return [];

  const statsMap = await getCompetitionTicketStatsBatch(
    competitions.map((competition) => ({
      id: (competition._id as { toString(): string }).toString(),
      maxTickets: competition.maxTickets,
      status: competition.status,
      ticketsSold: competition.ticketsSold,
      ticketsHeld: competition.ticketsHeld,
    }))
  );

  return competitions.map((competition) => {
    const id = (competition._id as { toString(): string }).toString();
    const stats = statsMap.get(id)!;
    return {
      ...competition,
      ticketsSold: stats.sold,
      ticketsHeld: stats.held,
      availableTickets: stats.available,
      percentageTaken: stats.percentageTaken,
    };
  });
}
