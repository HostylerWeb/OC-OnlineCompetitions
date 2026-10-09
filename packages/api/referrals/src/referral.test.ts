import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { recordReferralPurchase } from "./referral";

const state = vi.hoisted(() => ({
  profiles: new Map<string, any>(),
  existingReferralPurchase: null as any,
  referralExistsResult: false,
  settings: null as any,
  awardResult: {
    ticketsGranted: 0,
    purchasesCredited: 0,
    validCount: 0,
    allocations: [] as any[],
  },
  createShouldThrow: null as string | null,
  createCall: null as any,
  profileUpdateCalls: [] as Record<string, unknown>[],
  sendEmailCalls: [] as any[],
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: vi.fn((id: any) => ({
      lean: async () => state.profiles.get(id.toString()) ?? null,
    })),
    findByIdAndUpdate: vi.fn(async (_id: any, update: Record<string, unknown>) => {
      state.profileUpdateCalls.push(update);
    }),
  },
  ReferralPurchase: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: async () => [],
      })),
      lean: async () => [],
    })),
    findOne: vi.fn(() => ({
      lean: async () => state.existingReferralPurchase,
    })),
    exists: vi.fn(async () => state.referralExistsResult),
    countDocuments: vi.fn(async () => (state.referralExistsResult ? 1 : 0)),
    findByIdAndUpdate: vi.fn(async () => {}),
    create: vi.fn(async (data: Record<string, unknown>) => {
      if (state.createShouldThrow) {
        throw new Error(state.createShouldThrow);
      }
      state.createCall = data;
    }),
  },
  ReferralSettings: {
    findById: vi.fn(() => ({
      lean: async () => state.settings,
    })),
  },
}));

vi.mock("@oc/api-email", () => ({
  sendEmail: vi.fn(async () => {}),
}));

vi.mock("@oc/api-email/config", () => ({
  getEmailConfig: vi.fn(async () => ({})),
}));

vi.mock("@oc/api-email/templates/referral-tickets-awarded", () => ({
  ReferralTicketsAwardedEmail: vi.fn(() => null),
}));

vi.mock("@oc/api-email/templates/referral-tickets-allocated", () => ({
  ReferralTicketsAllocatedEmail: vi.fn(() => null),
}));

vi.mock("@oc/api-infra/env", () => ({
  getCurrentContext: vi.fn(() => ({ frontendUrl: "http://localhost:3111" })),
}));

vi.mock("@react-email/render", () => ({
  render: vi.fn(async () => "<html></html>"),
}));

vi.mock("./referral-award", () => ({
  awardPendingReferralTickets: vi.fn(async () => state.awardResult),
}));

function setupHappyPath(): void {
  const now = new Date();
  state.profiles.set("buyer-1", {
    _id: "buyer-1",
    referredBy: "referrer-1",
    totalSpent: 100,
    email: "buyer@test.com",
    firstName: "Buyer",
    createdAt: new Date(now.getTime() - 86400000),
  });
  state.profiles.set("referrer-1", {
    _id: "referrer-1",
    email: "referrer@test.com",
    firstName: "Referrer",
    referralMultiplier: 1,
    referralTierAwardedTickets: 0,
  });
  state.settings = {
    _id: "referral_settings",
    minFirstOrderSpend: 1,
    activityWindowDays: 30,
    activityWindowMode: "rolling",
    monthlyCutoffDay: 25,
    tiers: [
      { threshold: 5, tickets: 2 },
      { threshold: 10, tickets: 5 },
      { threshold: 15, tickets: 10 },
    ],
    calculusMethod: "gross",
    gracePeriod: { enabled: false, days: 3, countsToward: "current_tier" },
    refereeReward: { enabled: true, discountPercent: 20, minOrderValue: 0 },
    distribution: { mode: "wallet" },
    guardrails: {
      maxReferralsPerRefereePerDay: 0,
      blockSelfReferral: true,
      requireEmailVerification: false,
    },
  };
  state.existingReferralPurchase = null;
  state.referralExistsResult = false;
}

function resetState(): void {
  state.profiles = new Map();
  state.existingReferralPurchase = null;
  state.referralExistsResult = false;
  state.settings = null;
  state.awardResult = {
    ticketsGranted: 0,
    purchasesCredited: 0,
    validCount: 0,
    allocations: [],
  };
  state.createShouldThrow = null;
  state.createCall = null;
  state.profileUpdateCalls = [];
  state.sendEmailCalls = [];
}

describe("recordReferralPurchase", () => {
  beforeEach(() => {
    resetState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("skips when buyer has no referredBy", async () => {
    state.profiles.set("buyer-1", {
      _id: "buyer-1",
      referredBy: null,
      totalSpent: 100,
    });

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(0);
    expect(state.createCall).toBeNull();
  });

  test("skips when ReferralPurchase already exists for this orderId", async () => {
    state.profiles.set("buyer-1", {
      _id: "buyer-1",
      referredBy: "referrer-1",
      totalSpent: 100,
    });
    state.existingReferralPurchase = { orderId: "order-1" };

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(0);
    expect(state.createCall).toBeNull();
  });

  test("skips when post-purchase totalSpent < minFirstOrderSpend", async () => {
    state.profiles.set("buyer-1", {
      _id: "buyer-1",
      referredBy: "referrer-1",
      totalSpent: 10,
    });
    state.settings = { minFirstOrderSpend: 50, activityWindowDays: 30 };

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(0);
    expect(state.createCall).toBeNull();
  });

  test("skips when referrer profile not found", async () => {
    state.profiles.set("buyer-1", {
      _id: "buyer-1",
      referredBy: "referrer-1",
      totalSpent: 100,
    });

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(0);
    expect(state.createCall).toBeNull();
  });

  test("skips when purchase is outside activity window", async () => {
    state.profiles.set("buyer-1", {
      _id: "buyer-1",
      referredBy: "referrer-1",
      totalSpent: 100,
      createdAt: new Date("2020-01-01"),
    });
    state.profiles.set("referrer-1", {
      _id: "referrer-1",
      email: "referrer@test.com",
    });
    state.settings = { activityWindowDays: 30, minFirstOrderSpend: 1 };

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(0);
    expect(state.createCall).toBeNull();
  });

  test("records purchase and increments referralCount for first qualifying purchase", async () => {
    setupHappyPath();

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(1);
    expect(state.profileUpdateCalls[0]).toEqual({
      $inc: { referralCount: 1 },
    });
    expect(state.createCall).not.toBeNull();
    expect(state.createCall.orderId).toBe("order-1");
  });

  test("does not increment referralCount for second qualifying purchase from same referred user", async () => {
    setupHappyPath();
    state.referralExistsResult = true;

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-2",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(0);
    expect(state.createCall).not.toBeNull();
    expect(state.createCall.orderId).toBe("order-2");
  });

  test("only increments referralCount in all-competitions mode (no pending counter)", async () => {
    setupHappyPath();
    state.settings.distribution = { mode: "all_competitions" };

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(1);
    expect(state.profileUpdateCalls[0]).toEqual({
      $inc: { referralCount: 1 },
    });
  });

  test("calls onAwarded callback with competitionCount: 0 in wallet mode", async () => {
    setupHappyPath();
    state.awardResult = {
      ticketsGranted: 4,
      purchasesCredited: 1,
      validCount: 1,
      allocations: [],
    };

    const onAwarded = vi.fn();
    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
      onAwarded,
    });

    expect(onAwarded).toHaveBeenCalledTimes(1);
    expect(onAwarded).toHaveBeenCalledWith({
      ticketsGranted: 4,
      referrerUserId: "referrer-1",
      competitionCount: 0,
    });
  });

  test("calls onAwarded callback with competitionCount from allocations in all_competitions mode", async () => {
    setupHappyPath();
    state.settings.distribution = { mode: "all_competitions" };
    state.awardResult = {
      ticketsGranted: 4,
      purchasesCredited: 1,
      validCount: 1,
      allocations: [
        {
          purchaseId: "purchase1",
          orderId: "order-1",
          allocations: [
            {
              competitionId: "comp1",
              competitionTitle: "Comp 1",
              ticketIds: ["t1"],
              numbers: [101],
              qty: 1,
            },
            {
              competitionId: "comp2",
              competitionTitle: "Comp 2",
              ticketIds: ["t2"],
              numbers: [102],
              qty: 1,
            },
          ],
        },
      ],
    };

    const onAwarded = vi.fn();
    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
      onAwarded,
    });

    expect(onAwarded).toHaveBeenCalledTimes(1);
    expect(onAwarded).toHaveBeenCalledWith({
      ticketsGranted: 4,
      referrerUserId: "referrer-1",
      competitionCount: 2,
    });
  });

  test("does not call onAwarded when no tickets granted", async () => {
    setupHappyPath();
    state.awardResult = {
      ticketsGranted: 0,
      purchasesCredited: 0,
      validCount: 1,
      allocations: [],
    };

    const onAwarded = vi.fn();
    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
      onAwarded,
    });

    expect(onAwarded).not.toHaveBeenCalled();
  });

  test("does not call onAwarded when validCount is 0", async () => {
    setupHappyPath();
    state.awardResult = {
      ticketsGranted: 4,
      purchasesCredited: 1,
      validCount: 0,
      allocations: [],
    };

    const onAwarded = vi.fn();
    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
      onAwarded,
    });

    expect(onAwarded).not.toHaveBeenCalled();
  });

  test("does not update profile on non-duplicate-key error (create-first semantics)", async () => {
    setupHappyPath();
    state.createShouldThrow = "Database connection error";

    await expect(
      recordReferralPurchase({
        buyerUserId: "buyer-1",
        orderId: "order-1",
        quantity: 1,
        orderTotal: 1,
      })
    ).rejects.toThrow("Database connection error");

    expect(state.profileUpdateCalls).toHaveLength(0);
  });

  test("returns silently on duplicate key error without updating profile", async () => {
    setupHappyPath();
    state.createShouldThrow = "duplicate key error";

    await recordReferralPurchase({
      buyerUserId: "buyer-1",
      orderId: "order-1",
      quantity: 1,
      orderTotal: 1,
    });

    expect(state.profileUpdateCalls).toHaveLength(0);
    expect(state.createCall).toBeNull();
  });

  test(
    "records purchase when buyerProfile.totalSpent is 0 but orderTotal covers minSpend " +
      "(regression: in-transaction Profile.totalSpent is stale, orderTotal is authoritative)",
    async () => {
      state.profiles.set("buyer-1", {
        _id: "buyer-1",
        referredBy: "referrer-1",
        totalSpent: 0,
        email: "buyer@test.com",
        firstName: "Buyer",
        createdAt: new Date(Date.now() - 86400000),
      });
      state.profiles.set("referrer-1", {
        _id: "referrer-1",
        email: "referrer@test.com",
        firstName: "Referrer",
        referralMultiplier: 1,
        referralTierAwardedTickets: 0,
      });
      state.settings = {
        _id: "referral_settings",
        minFirstOrderSpend: 1,
        activityWindowDays: 30,
        activityWindowMode: "rolling",
        monthlyCutoffDay: 25,
        tiers: [{ threshold: 1, tickets: 1 }],
        calculusMethod: "gross",
        gracePeriod: { enabled: false, days: 3, countsToward: "current_tier" },
        refereeReward: { enabled: true, discountPercent: 20, minOrderValue: 0 },
        distribution: { mode: "wallet" },
        guardrails: {
          maxReferralsPerRefereePerDay: 0,
          blockSelfReferral: true,
          requireEmailVerification: false,
        },
      };

      await recordReferralPurchase({
        buyerUserId: "buyer-1",
        orderId: "order-1",
        quantity: 1,
        orderTotal: 2,
      });

      expect(state.createCall).not.toBeNull();
      expect(state.createCall.orderId).toBe("order-1");
      expect(state.profileUpdateCalls).toHaveLength(1);
      expect(state.profileUpdateCalls[0]).toEqual({
        $inc: { referralCount: 1 },
      });
    }
  );
});
