import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profile: null as { _id: string; referralMultiplier?: number } | null,
  referredUser: null as Record<string, unknown> | null,
  purchases: [] as Record<string, unknown>[],
  comps: [] as Record<string, unknown>[],
  ticketOwnedCounts: new Map<string, number>(),
  claimResults: Array<{ ticketIds: string[]; numbers: number[] }>,
  claimCalls: Array<Record<string, unknown>>,
  profileUpdates: Array<Record<string, unknown>>,
  updatedPurchases: Array<Record<string, unknown>>,
}));

vi.mock("@oc/api-tickets/ticket-service", () => ({
  claimTicketsForOrder: vi.fn(async (opts: Record<string, unknown>) => {
    state.claimCalls.push(opts);
    return state.claimResults.shift() ?? { ticketIds: [], numbers: [] };
  }),
}));

vi.mock("@oc/api-db/models", () => ({
  Competition: {
    find: vi.fn(() => ({
      select: () => ({
        lean: async () => state.comps,
      }),
    })),
  },
  Ticket: {
    countDocuments: vi.fn(async ({ competitionId }: { competitionId?: { toString(): string } }) => {
      return state.ticketOwnedCounts.get(competitionId?.toString() ?? "") ?? 0;
    }),
  },
  Profile: {
    findById: vi.fn(() => ({
      lean: async () => state.profile,
    })),
    find: vi.fn(() => ({
      select: () => ({
        lean: async () => (state.referredUser ? [state.referredUser] : []),
      }),
    })),
    findByIdAndUpdate: vi.fn(async (_id: unknown, update: Record<string, unknown>) => {
      state.profileUpdates.push(update);
      return {};
    }),
  },
  ReferralPurchase: {
    find: vi.fn(() => ({
      sort: () => ({
        lean: async () => state.purchases,
      }),
    })),
    findOneAndUpdate: vi.fn(async (_filter: unknown, update: Record<string, unknown>) => {
      state.updatedPurchases.push(update);
      if (!state.purchases[0]) return null;
      return {
        ...state.purchases[0],
        ...((update as { $set?: Record<string, unknown> })?.$set ?? {}),
      };
    }),
    aggregate: vi.fn(async () => []),
  },
}));

import { awardPendingReferralTickets } from "./award-tier";
import type { NewReferralSettings } from "./types";

const mockOrderId = "507f1f77bcf86cd799439011";

const baseSettings: NewReferralSettings = {
  _id: "referral_settings",
  tiers: [{ threshold: 1, tickets: 2 }],
  calculusMethod: "net",
  activityWindowDays: 30,
  activityWindowMode: "rolling",
  monthlyCutoffDay: 25,
  minFirstOrderSpend: 1,
  gracePeriod: { enabled: false, days: 0, countsToward: "current_tier" },
  refereeReward: { enabled: true, discountPercent: 0, minOrderValue: 0 },
  distribution: { mode: "wallet" },
  guardrails: {
    maxReferralsPerRefereePerDay: 0,
    blockSelfReferral: true,
    requireEmailVerification: false,
  },
};

function resetState(): void {
  state.profile = null;
  state.referredUser = null;
  state.purchases = [];
  state.comps = [];
  state.ticketOwnedCounts = new Map();
  state.claimResults = [];
  state.claimCalls = [];
  state.profileUpdates = [];
  state.updatedPurchases = [];
}

function setupProfile(): void {
  state.profile = { _id: "user1", referralMultiplier: 1 };
}

function setupReferredUser(): void {
  state.referredUser = {
    _id: "user2",
    createdAt: new Date(Date.now() - 86400000),
    totalSpent: 50,
    isVerified: true,
  };
}

function setupPurchase(): void {
  state.purchases = [
    {
      _id: "purchase1",
      referrerId: "user1",
      referredUserId: "user2",
      orderId: mockOrderId,
      purchaseAmount: 50,
      purchasedAt: new Date(),
      ticketsAwarded: 0,
    },
  ];
}

describe("awardPendingReferralTickets", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns empty result when profile not found", async () => {
    state.profile = null;
    const result = await awardPendingReferralTickets("user1", baseSettings);
    expect(result).toEqual({
      ticketsGranted: 0,
      purchasesCredited: 0,
      validCount: 0,
      allocations: [],
    });
  });

  it("returns empty result when no purchases", async () => {
    setupProfile();
    state.purchases = [];
    const result = await awardPendingReferralTickets("user1", baseSettings);
    expect(result.ticketsGranted).toBe(0);
    expect(result.purchasesCredited).toBe(0);
    expect(result.allocations).toEqual([]);
  });

  it("returns empty result when all purchases already awarded", async () => {
    setupProfile();
    setupPurchase();
    state.purchases[0].ticketsAwarded = 5;
    const result = await awardPendingReferralTickets("user1", baseSettings);
    expect(result.ticketsGranted).toBe(0);
    expect(result.purchasesCredited).toBe(0);
    expect(result.allocations).toEqual([]);
  });

  describe("all_competitions mode", () => {
    const allCompsSettings: NewReferralSettings = {
      ...baseSettings,
      distribution: { mode: "all_competitions" },
    };

    it("distributes tickets per active competition with inherited orderId", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();
      state.comps = [
        { _id: "comp1", title: "Comp 1", maxTickets: 100, ticketsSold: 10, maxTicketsPerUser: 50 },
        { _id: "comp2", title: "Comp 2", maxTickets: 100, ticketsSold: 20, maxTicketsPerUser: 50 },
      ];
      state.claimResults = [
        { ticketIds: ["t1", "t2"], numbers: [101, 102] },
        { ticketIds: ["t3", "t4"], numbers: [103, 104] },
      ];

      const result = await awardPendingReferralTickets("user1", allCompsSettings);

      expect(state.claimCalls).toHaveLength(2);
      expect(state.claimCalls[0]).toMatchObject({
        competitionId: "comp1",
        userId: "user1",
        orderId: mockOrderId,
        qty: 2,
      });
      expect(state.claimCalls[1]).toMatchObject({
        competitionId: "comp2",
        userId: "user1",
        orderId: mockOrderId,
        qty: 2,
      });
      expect(result.ticketsGranted).toBe(4);
      expect(result.purchasesCredited).toBe(1);
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].orderId).toBe(mockOrderId);
      expect(result.allocations[0].purchaseId).toBe("purchase1");
      expect(result.allocations[0].allocations).toHaveLength(2);
    });

    it("skips sold-out competitions", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();
      state.comps = [
        { _id: "comp1", title: "Comp 1", maxTickets: 100, ticketsSold: 10, maxTicketsPerUser: 50 },
        { _id: "comp2", title: "Comp 2", maxTickets: 100, ticketsSold: 100, maxTicketsPerUser: 50 },
      ];
      state.claimResults = [{ ticketIds: ["t1", "t2"], numbers: [101, 102] }];

      const result = await awardPendingReferralTickets("user1", allCompsSettings);

      expect(state.claimCalls).toHaveLength(1);
      expect(state.claimCalls[0].competitionId).toBe("comp1");
      expect(result.ticketsGranted).toBe(2);
    });

    it("skips competitions where user has reached maxTicketsPerUser", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();
      state.comps = [
        { _id: "comp1", title: "Comp 1", maxTickets: 100, ticketsSold: 10, maxTicketsPerUser: 50 },
        { _id: "comp2", title: "Comp 2", maxTickets: 100, ticketsSold: 20, maxTicketsPerUser: 50 },
      ];
      state.ticketOwnedCounts.set("comp2", 50);

      await awardPendingReferralTickets("user1", allCompsSettings);

      expect(state.claimCalls).toHaveLength(1);
      expect(state.claimCalls[0].competitionId).toBe("comp1");
    });

    it("caps allocation to partial availability", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();
      state.comps = [
        { _id: "comp1", title: "Comp 1", maxTickets: 100, ticketsSold: 99, maxTicketsPerUser: 0 },
      ];
      state.claimResults = [{ ticketIds: ["t1"], numbers: [100] }];

      const result = await awardPendingReferralTickets("user1", allCompsSettings);

      expect(state.claimCalls).toHaveLength(1);
      expect(state.claimCalls[0].qty).toBe(1);
      expect(result.ticketsGranted).toBe(1);
    });

    it("discards tickets when no eligible competitions exist", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();
      state.comps = [];

      const result = await awardPendingReferralTickets("user1", allCompsSettings);

      expect(state.claimCalls).toHaveLength(0);
      expect(result.ticketsGranted).toBe(0);
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].allocations).toHaveLength(0);
      const walletUpdate = state.profileUpdates.find(
        (u) =>
          (u as { $inc?: { referralTierAwardedTickets?: number } })?.$inc
            ?.referralTierAwardedTickets
      );
      expect(walletUpdate).toBeUndefined();
    });

    it("returns allocations array with per-purchase structure", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();
      state.comps = [
        { _id: "comp1", title: "My Comp", maxTickets: 100, ticketsSold: 10, maxTicketsPerUser: 50 },
      ];
      state.claimResults = [{ ticketIds: ["t1", "t2"], numbers: [101, 102] }];

      const result = await awardPendingReferralTickets("user1", allCompsSettings);

      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0]).toEqual({
        purchaseId: "purchase1",
        orderId: mockOrderId,
        allocations: [
          {
            competitionId: "comp1",
            competitionTitle: "My Comp",
            ticketIds: ["t1", "t2"],
            numbers: [101, 102],
            qty: 2,
          },
        ],
      });
    });

    it("marks purchase as awarded with ticket count and tier", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();
      state.comps = [
        { _id: "comp1", title: "Comp 1", maxTickets: 100, ticketsSold: 10, maxTicketsPerUser: 50 },
      ];
      state.claimResults = [{ ticketIds: ["t1", "t2"], numbers: [101, 102] }];

      await awardPendingReferralTickets("user1", allCompsSettings);

      expect(state.updatedPurchases).toHaveLength(1);
      const update = state.updatedPurchases[0] as { $set: Record<string, unknown> };
      expect(update.$set.ticketsAwarded).toBe(2);
      expect(update.$set.tierAtAward).toBe(1);
      expect(update.$set.ticketsAwardedAt).toBeInstanceOf(Date);
    });
  });

  describe("wallet mode", () => {
    const walletSettings: NewReferralSettings = {
      ...baseSettings,
      distribution: { mode: "wallet" },
    };

    it("credits referralTierAwardedTickets on profile", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();

      const result = await awardPendingReferralTickets("user1", walletSettings);

      expect(result.ticketsGranted).toBe(2);
      expect(state.profileUpdates).toContainEqual({
        $inc: { referralTierAwardedTickets: 2 },
      });
    });

    it("returns empty allocations array in wallet mode", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();

      const result = await awardPendingReferralTickets("user1", walletSettings);

      expect(result.allocations).toEqual([]);
      expect(state.claimCalls).toHaveLength(0);
    });

    it("does not query competitions in wallet mode", async () => {
      setupProfile();
      setupReferredUser();
      setupPurchase();

      await awardPendingReferralTickets("user1", walletSettings);

      expect(state.claimCalls).toHaveLength(0);
    });
  });
});
