import type { Competition } from "@oc/types";
import { getProgress, getTicketsSold } from "@oc/utils";

export function getCompetitionHref(comp: Competition): string {
  return `/competitions/${comp.slug ?? comp._id}`;
}

export function getCompetitionImageUrl(comp: Competition): string | undefined {
  return comp.prizeImageUrl ?? comp.imageUrl;
}

export function getCompetitionMaxTickets(comp: Competition): number {
  return comp.maxTickets ?? comp.totalTickets ?? 0;
}

export function getCompetitionSoldTickets(comp: Competition): number {
  return getTicketsSold(comp);
}

export function getCompetitionProgress(comp: Competition): number {
  return getProgress(getCompetitionSoldTickets(comp), getCompetitionMaxTickets(comp));
}

export function getCompetitionTicketPrice(comp: Competition): number {
  return comp.ticketPrice ?? 0;
}

export function getCompetitionPrizeValue(comp: Competition): number {
  return comp.prizeValue ?? 0;
}
