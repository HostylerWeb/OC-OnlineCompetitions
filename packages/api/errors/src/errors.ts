import type { ErrorCode } from "@oc/api-validation";

export class ComplianceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "ComplianceError";
  }
}

export class CheckoutError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export class AllocationError extends Error {
  constructor(
    message: string,
    readonly status = 400 as const
  ) {
    super(message);
    this.name = "AllocationError";
  }
}

export type TicketAvailabilityErrorCode =
  | "TICKETS_SOLD_OUT"
  | "MAX_TICKETS_PER_USER_EXCEEDED"
  | "COMPETITION_INACTIVE";

export class TicketAvailabilityError extends Error {
  constructor(
    message: string,
    readonly code: TicketAvailabilityErrorCode,
    readonly status = 409 as const
  ) {
    super(message);
    this.name = "TicketAvailabilityError";
  }
}

export class TicketSoldOutError extends Error {
  constructor(
    message: string,
    readonly status = 409 as const
  ) {
    super(message);
    this.name = "TicketSoldOutError";
  }
}

export class MaxTicketsPerUserExceededError extends Error {
  constructor(
    message: string,
    readonly status = 400 as const
  ) {
    super(message);
    this.name = "MaxTicketsPerUserExceededError";
  }
}

export class SetupError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "SetupError";
  }
}

export class EmergencyError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "EmergencyError";
  }
}
