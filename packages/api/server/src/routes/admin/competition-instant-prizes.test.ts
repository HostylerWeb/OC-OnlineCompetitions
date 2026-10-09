import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import competitionInstantPrizesApp from "./competition-instant-prizes";

const __mock = vi.hoisted(() => ({
  adminId: "",
  getInstantPrizeCapacity: vi.fn(),
  validateInstantPrizeAssignment: vi.fn(),
  freeGrantedTickets: vi.fn(),
  releaseHeldByCip: vi.fn(),
  holdTickets: vi.fn(),
  competitionFindById: vi.fn(),
  competitionFindByIdAndUpdate: vi.fn(),
  competitionCreate: vi.fn(),
  cipFindById: vi.fn(),
  cipFindByIdAndUpdate: vi.fn(),
  cipCreate: vi.fn(),
  instantPrizeFindById: vi.fn(),
  instantPrizeWinFind: vi.fn(),
  instantPrizeWinCreate: vi.fn(),
}));

vi.mock("@oc/api-infra/db", () => ({ default: vi.fn(async () => {}) }));

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
    c.set("userId", __mock.adminId);
    await next();
  },
  requireAdmin: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set("userId", __mock.adminId);
    await next();
  },
  requireManager: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set("userId", __mock.adminId);
    await next();
  },
}));

vi.mock("@oc/api-tickets/validate-instant-prize-assignment", () => ({
  getInstantPrizeCapacity: (...args: unknown[]) => __mock.getInstantPrizeCapacity(...args),
  validateInstantPrizeAssignment: (...args: unknown[]) =>
    __mock.validateInstantPrizeAssignment(...args),
  isCipInvariantError: () => false,
}));

vi.mock("@oc/api-tickets/instant-prize-allocation", () => ({
  AllocationError: class AllocationError extends Error {},
  computeArchiveState: () => ({ isArchived: false }),
  computeSlotRemoval: () => ({ removedNumbers: [], removedSlotIndices: [] }),
  expandGrantedTicketsForIncrease: () => ({ ticketsNeeded: 2 }),
  expandGrantedTicketsForTicketCountChange: () => ({ rebuiltGrantedTicketIds: [] }),
  freeGrantedTickets: (...args: unknown[]) => __mock.freeGrantedTickets(...args),
  getTicketIdsToFreeForRemovedSlots: () => [],
  rebuildGrantedTicketIds: () => [],
  shrinkGrantedTicketsForTicketCountChange: () => ({
    rebuiltGrantedTicketIds: [],
    ticketIdsToFree: [],
  }),
}));

vi.mock("@oc/api-tickets/instant-prize-utils", () => ({
  generateWinningEntryNumbers: vi.fn(async () => [101, 102]),
}));

vi.mock("@oc/api-tickets/ticket-service", () => ({
  buildExcludeSetForInstantPrizes: vi.fn(async () => new Set()),
  holdTickets: (...args: unknown[]) => __mock.holdTickets(...args),
  pickAvailableNumbers: vi.fn(async () => [501, 502]),
  provisionTickets: vi.fn(async () => 0),
  releaseHeldByCip: (...args: unknown[]) => __mock.releaseHeldByCip(...args),
}));

vi.mock("@oc/api-infra/mongo-capabilities", () => ({
  withMongoTransactionOptional: vi.fn(async (fn: (session: null) => Promise<unknown>) => fn(null)),
}));

vi.mock("@oc/api-db/models", () => ({
  Competition: {
    collection: { name: "competitions" },
    findById: (...args: unknown[]) => __mock.competitionFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => __mock.competitionFindByIdAndUpdate(...args),
    create: (...args: unknown[]) => __mock.competitionCreate(...args),
  },
  CompetitionInstantPrize: {
    collection: { name: "competitioninstantprizes" },
    findById: (...args: unknown[]) => __mock.cipFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => __mock.cipFindByIdAndUpdate(...args),
    create: (...args: unknown[]) => __mock.cipCreate(...args),
  },
  InstantPrize: {
    collection: { name: "instantprizes" },
    findById: (...args: unknown[]) => __mock.instantPrizeFindById(...args),
  },
  InstantPrizeWin: {
    find: (...args: unknown[]) => __mock.instantPrizeWinFind(...args),
    create: (...args: unknown[]) => __mock.instantPrizeWinCreate(...args),
    countDocuments: vi.fn(async () => 0),
  },
}));

describe("admin competition instant prize routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("GET /capacity returns quantity validation payload", async () => {
    __mock.adminId = new Types.ObjectId().toString();
    const competitionId = new Types.ObjectId().toString();
    const instantPrizeId = new Types.ObjectId().toString();
    __mock.getInstantPrizeCapacity = vi.fn(async () => ({
      maxTickets: 100,
      assignedSlots: 20,
      remainingSlots: 80,
      availableTickets: 80,
      maxAssignableQty: 3,
      maxQty: 3,
    }));
    __mock.validateInstantPrizeAssignment = vi.fn(async () => ({
      ok: false,
      message: "Only 3 slots available",
    }));

    const res = await competitionInstantPrizesApp.request(
      `http://localhost/capacity?competitionId=${competitionId}&instantPrizeId=${instantPrizeId}&quantity=5`
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(__mock.getInstantPrizeCapacity).toHaveBeenCalledTimes(1);
    expect(__mock.validateInstantPrizeAssignment).toHaveBeenCalledTimes(1);
    expect(body.data).toMatchObject({
      maxAssignableQty: 3,
      requestedQuantity: 5,
      quantityValid: false,
      quantityMessage: "Only 3 slots available",
    });
  });

  test("PATCH /assign/:id rejects reducing below claimed count", async () => {
    __mock.adminId = new Types.ObjectId().toString();
    const cipId = new Types.ObjectId();
    const competitionId = new Types.ObjectId();
    const instantPrizeId = new Types.ObjectId();

    __mock.getInstantPrizeCapacity = vi.fn(async () => ({}));
    __mock.validateInstantPrizeAssignment = vi.fn(async () => ({ ok: true }));
    __mock.competitionFindById = vi.fn(() => ({
      lean: async () => ({ _id: competitionId, maxTickets: 100, status: "active" }),
    }));
    __mock.cipFindById = vi.fn(() => ({
      lean: async () => ({
        _id: cipId,
        competitionId,
        instantPrizeId,
        quantity: 5,
        claimedCount: 2,
        winningEntryNumbers: [11, 22, 33, 44, 55],
        grantedTicketIds: [],
        isArchived: false,
      }),
    }));
    __mock.instantPrizeFindById = vi.fn(() => ({
      lean: async () => ({
        _id: instantPrizeId,
        type: "prize",
      }),
    }));
    __mock.instantPrizeWinFind = vi.fn(() => ({
      select: () => ({
        lean: async () => [],
      }),
    }));

    const res = await competitionInstantPrizesApp.request(
      `http://localhost/assign/${cipId.toString()}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity: 1, absolute: true }),
      }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toContain("Cannot reduce quantity below 2");
  });

  test("POST /assign rolls back held tickets when hold fails mid-transaction", async () => {
    __mock.adminId = new Types.ObjectId().toString();
    const competitionId = new Types.ObjectId().toString();
    const instantPrizeId = new Types.ObjectId().toString();
    const linkedCompetitionId = new Types.ObjectId();
    __mock.freeGrantedTickets = vi.fn(async () => 2);
    __mock.releaseHeldByCip = vi.fn(async () => 0);
    __mock.holdTickets = vi.fn(async () => {
      throw new Error("Only 0/2 tickets held");
    });
    __mock.competitionFindById = vi.fn(() => ({
      lean: async () => ({ _id: competitionId, maxTickets: 100, status: "active" }),
    }));
    __mock.instantPrizeFindById = vi.fn(() => ({
      lean: async () => ({
        _id: instantPrizeId,
        type: "competition_ticket",
        linkedCompetitionId,
        ticketCount: 1,
      }),
    }));
    __mock.cipCreate = vi.fn(async () => {
      throw new Error("should not persist CIP when hold fails");
    });

    const res = await competitionInstantPrizesApp.request("http://localhost/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        competitionId,
        instantPrizeId,
        quantity: 2,
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(__mock.holdTickets).toHaveBeenCalled();
    expect(__mock.releaseHeldByCip).toHaveBeenCalled();
  });
});
