import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import competitionsApp from "./competitions";

vi.mock("@oc/api-infra/db", () => ({
  default: vi.fn(async () => {}),
}));

vi.mock("@oc/api-server/middleware/auth", () => ({
  isPublicRoute: () => false,
  resolveSession: vi.fn(async () => ({})),
  sessionMiddleware: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireSession: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireVerifiedUser: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  getRequiredUserId: () => "test-user-id",
  auth: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireStaff: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock("@oc/api-tickets/competition-stats", () => ({
  enrichCompetitionWithTicketStats: vi.fn(async (comp: unknown) => comp),
  enrichCompetitionsWithTicketStats: vi.fn(async (comps: unknown[]) =>
    comps.map((c) => ({
      ...(c as object),
      ticketsSold: 0,
      ticketsHeld: 0,
      availableTickets: 0,
      percentageTaken: 0,
    }))
  ),
}));

vi.mock("@oc/api-tickets/competitions", () => ({
  backpropagateCompetitionToWinners: vi.fn(async () => 0),
  countInstantPrizesLinkedToCompetition: vi.fn(async () => 0),
}));

vi.mock("@oc/api-tickets/ticket-service", () => ({
  getMinimumAllowedMaxTickets: vi.fn(async () => 80),
  provisionTickets: vi.fn(async () => 0),
}));

const competitionId = new Types.ObjectId();

vi.mock("@oc/api-db/models", () => ({
  Competition: {
    findById: vi.fn(() => ({
      lean: async () => ({
        _id: competitionId,
        maxTickets: 100,
        title: "Test Comp",
      }),
    })),
    findByIdAndUpdate: vi.fn(() => ({
      lean: async () => ({
        _id: competitionId,
        maxTickets: 50,
        title: "Test Comp",
      }),
    })),
  },
}));

describe("PUT /admin/competitions/:id maxTickets validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("rejects maxTickets below sold/held/winning floor", async () => {
    const response = await competitionsApp.request(`http://localhost/${competitionId.toString()}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxTickets: 50 }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toContain("maxTickets cannot be reduced below 80");
  });
});
