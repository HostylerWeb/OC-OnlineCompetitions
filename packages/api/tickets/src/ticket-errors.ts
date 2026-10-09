import { MaxTicketsPerUserExceededError, TicketSoldOutError } from "@oc/api-errors";

export { MaxTicketsPerUserExceededError, TicketSoldOutError } from "@oc/api-errors";

export function formatTicketError(err: unknown): string {
  if (err instanceof TicketSoldOutError) {
    return `TICKETS_SOLD_OUT:${err.message}`;
  }
  if (err instanceof MaxTicketsPerUserExceededError) {
    return `MAX_TICKETS_PER_USER_EXCEEDED:${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}
