import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ticketsApp from "./tickets";

const __mock = vi.hoisted(() => ({
  authUserId: "",
  claimTicketsForOrder: vi.fn(),
  rollbackOrderFulfillment: vi.fn(),
  profileRollback: vi.fn(),
  grantInstantPrizes: vi.fn(async () => []),
}));

vi.mock("@oc/api-infra/db", () => ({
  default: vi.fn(async () => {}),
}));

vi.mock("@oc/api-referrals/referral-ticket-validation", () => ({
  validateReferralTicketSpend: vi.fn(async () => ({ ok: true as const })),
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
  auth: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set("userId", __mock.authUserId);
    await next();
  },
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock("@oc/api-tickets/ticket-service", () => {
  class TicketAvailabilityError extends Error {
    code = "TICKETS_SOLD_OUT";
  }
  async function claimTicketsForOrder(...args: unknown[]) {
    try {
      return await __mock.claimTicketsForOrder(...args);
    } catch (err: unknown) {
      if ((err as Error).message === "sold out") {
        throw new TicketAvailabilityError("sold out");
      }
      throw err;
    }
  }
  return { claimTicketsForOrder, TicketAvailabilityError };
});

vi.mock("@oc/api-server/lib/payment/rollback-order-fulfillment", () => ({
  rollbackOrderFulfillment: (...args: unknown[]) => __mock.rollbackOrderFulfillment(...args),
}));

vi.mock("@oc/api-payment-core", () => ({
  grantInstantPrizeWinsForAssignedNumbers: (...args: unknown[]) =>
    __mock.grantInstantPrizes(...args),
}));

vi.mock("@oc/api-db/models", () => ({
  Competition: {
    findById: vi.fn(() => ({
      lean: async () => ({
        status: "active",
        title: "Referral Competition",
        endDate: new Date(Date.now() + 60_000),
      }),
    })),
  },
  Profile: {
    findById: vi.fn(() => ({
      lean: async () => ({}),
    })),
    findOneAndUpdate: vi.fn(() => ({
      lean: async () => ({
        referralTierAwardedTickets: 3,
        totalEntries: 12,
      }),
    })),
    findByIdAndUpdate: (...args: unknown[]) => __mock.profileRollback(...args),
  },
  InstantPrizeWin: {
    create: vi.fn(async () => ({ _id: new Types.ObjectId() })),
  },
  CompetitionInstantPrize: {
    findById: vi.fn(() => ({ lean: async () => null })),
    findByIdAndUpdate: vi.fn(async () => ({})),
  },
  BonusAwardWin: {
    find: vi.fn(() => ({ lean: async () => [] })),
    updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
  },
  Order: {
    findOne: vi.fn(async () => null),
    findOneAndUpdate: vi.fn(async () => ({})),
    create: vi.fn(async () => ({ _id: new Types.ObjectId() })),
  },
}));

describe("POST /me/tickets/redeem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  test("allocates referral tickets and returns assigned numbers", async () => {
    __mock.authUserId = new Types.ObjectId().toString();
    const competitionId = new Types.ObjectId().toString();
    __mock.claimTicketsForOrder = vi.fn(async () => ({
      ticketIds: [new Types.ObjectId().toString(), new Types.ObjectId().toString()],
      numbers: [12, 34],
    }));

    const response = await ticketsApp.request("http://localhost/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ competitionId, quantity: 2 }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(__mock.claimTicketsForOrder).toHaveBeenCalledTimes(1);
    expect(body.data.ticketNumbers).toEqual([12, 34]);
  });

  test("rolls back referral counters when ticket allocation fails", async () => {
    __mock.authUserId = new Types.ObjectId().toString();
    const competitionId = new Types.ObjectId().toString();
    __mock.claimTicketsForOrder = vi.fn(async () => {
      throw new Error("sold out");
    });
    __mock.rollbackOrderFulfillment = vi.fn(async () => {});
    __mock.profileRollback = vi.fn(async () => ({}));

    const response = await ticketsApp.request("http://localhost/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ competitionId, quantity: 1 }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toBe("Not enough tickets available in this competition");
    expect(__mock.rollbackOrderFulfillment).toHaveBeenCalledTimes(1);
    expect(__mock.profileRollback).toHaveBeenCalledTimes(1);
  });

  test("rolls back tickets and profile when instant win grant fails after claim", async () => {
    __mock.authUserId = new Types.ObjectId().toString();
    const competitionId = new Types.ObjectId().toString();
    __mock.claimTicketsForOrder = vi.fn(async () => ({
      ticketIds: [new Types.ObjectId().toString()],
      numbers: [7],
    }));
    __mock.rollbackOrderFulfillment = vi.fn(async () => {});
    __mock.profileRollback = vi.fn(async () => ({}));
    __mock.grantInstantPrizes = vi.fn(async () => {
      throw new Error("instant win grant failed");
    });

    const response = await ticketsApp.request("http://localhost/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ competitionId, quantity: 1 }),
    });

    expect(response.status).toBe(400);
    expect(__mock.rollbackOrderFulfillment).toHaveBeenCalledTimes(1);
    expect(__mock.profileRollback).toHaveBeenCalledTimes(1);
  });
});
