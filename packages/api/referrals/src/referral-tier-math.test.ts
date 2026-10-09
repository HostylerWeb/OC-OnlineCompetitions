import { beforeEach, describe, expect, test, vi } from "vitest";
import { validateReferralTicketSpend } from "./referral-ticket-validation";
import {
  computeReferralTierAward,
  countValidReferredUsers,
  formatReferralTierLabel,
  getReferralActivityWindowEnd,
  isQualifyingReferralPurchase,
  isReferralPurchaseWithinActivityWindow,
  type ReferralTier,
  resolveTierTickets,
} from "./referral-tier-math";

const validateState = vi.hoisted(() => ({
  competition: null as any,
  profile: null as any,
  countOwnedByUserResult: 0,
  checkTicketAvailabilityThrowMessage: null as string | null,
}));

vi.mock("@oc/api-db/models", () => ({
  Competition: {
    findById: vi.fn(() => ({
      lean: async () => validateState.competition,
    })),
  },
  Profile: {
    findById: vi.fn(() => ({
      lean: async () => validateState.profile,
    })),
  },
}));

vi.mock("@oc/api-tickets/ticket-service", () => ({
  countOwnedByUser: vi.fn(async () => validateState.countOwnedByUserResult),
}));

vi.mock("@oc/api-tickets/cart", () => ({
  checkTicketAvailability: vi.fn(async () => {
    if (validateState.checkTicketAvailabilityThrowMessage) {
      throw new Error(validateState.checkTicketAvailabilityThrowMessage);
    }
  }),
}));

const TIER_DEFAULT: ReferralTier[] = [
  { threshold: 5, tickets: 2 },
  { threshold: 10, tickets: 5 },
  { threshold: 15, tickets: 10 },
];

describe("referral-tier-math", () => {
  describe("getReferralActivityWindowEnd", () => {
    test("adds N days to the referred user creation date", () => {
      const start = new Date("2026-01-01T00:00:00.000Z");
      const end = getReferralActivityWindowEnd(start, 30);
      expect(end.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    });
  });

  describe("isReferralPurchaseWithinActivityWindow", () => {
    test("returns true for purchases on the start date", () => {
      const start = new Date("2026-01-01");
      const purchase = new Date("2026-01-01T12:00:00");
      expect(isReferralPurchaseWithinActivityWindow(purchase, start, 30)).toBe(true);
    });

    test("returns true for purchases on the last day of the window", () => {
      const start = new Date("2026-01-01");
      const purchase = new Date("2026-01-31T00:00:00");
      expect(isReferralPurchaseWithinActivityWindow(purchase, start, 30)).toBe(true);
    });

    test("returns false for purchases after the window", () => {
      const start = new Date("2026-01-01");
      const purchase = new Date("2026-02-01T00:00:01");
      expect(isReferralPurchaseWithinActivityWindow(purchase, start, 30)).toBe(false);
    });
  });

  describe("isQualifyingReferralPurchase", () => {
    const referredUser = {
      _id: { toString: () => "buyer-1" },
      createdAt: new Date("2026-01-01"),
      totalSpent: 50,
    };
    const purchaseInWindow = {
      purchasedAt: new Date("2026-01-15"),
      referredUserId: { toString: () => "buyer-1" },
    };

    test("returns false when referred user is not found", () => {
      expect(isQualifyingReferralPurchase(purchaseInWindow, undefined, 30, 1)).toBe(false);
    });

    test("returns false when totalSpent is below threshold", () => {
      expect(
        isQualifyingReferralPurchase(purchaseInWindow, { ...referredUser, totalSpent: 0 }, 30, 1)
      ).toBe(false);
    });

    test("returns true when spend and window both qualify", () => {
      expect(isQualifyingReferralPurchase(purchaseInWindow, referredUser, 30, 1)).toBe(true);
    });

    test("uses purchase.purchaseAmount per-order when provided (high totalSpent, low purchaseAmount)", () => {
      // Per-order amount (10) is below threshold (50); should NOT qualify
      // even though referredUser.totalSpent (9999) is far above it.
      const lowOrderPurchase = { ...purchaseInWindow, purchaseAmount: 10 };
      expect(
        isQualifyingReferralPurchase(
          lowOrderPurchase,
          { ...referredUser, totalSpent: 9999 },
          30,
          50
        )
      ).toBe(false);
    });

    test("uses purchase.purchaseAmount per-order when provided (low totalSpent, high purchaseAmount)", () => {
      // Per-order amount (100) meets threshold (50); should qualify
      // even though referredUser.totalSpent (0) is below it.
      const highOrderPurchase = { ...purchaseInWindow, purchaseAmount: 100 };
      expect(
        isQualifyingReferralPurchase(highOrderPurchase, { ...referredUser, totalSpent: 0 }, 30, 50)
      ).toBe(true);
    });

    test("treats purchaseAmount === 0 as authoritative (does not fall back to totalSpent)", () => {
      // Explicit zero on the purchase must not silently fall back to lifetime totalSpent.
      const zeroOrderPurchase = { ...purchaseInWindow, purchaseAmount: 0 };
      expect(
        isQualifyingReferralPurchase(
          zeroOrderPurchase,
          { ...referredUser, totalSpent: 9999 },
          30,
          1
        )
      ).toBe(false);
    });

    test("falls back to referred.totalSpent when purchaseAmount is undefined (legacy data)", () => {
      // No purchaseAmount on the purchase record — use the lifetime totalSpent as fallback.
      const legacyPurchase = { ...purchaseInWindow };
      expect(
        isQualifyingReferralPurchase(legacyPurchase, { ...referredUser, totalSpent: 50 }, 30, 1)
      ).toBe(true);
      expect(
        isQualifyingReferralPurchase(legacyPurchase, { ...referredUser, totalSpent: 0 }, 30, 1)
      ).toBe(false);
    });
  });

  describe("resolveTierTickets", () => {
    test("returns 0 for valid count below the first threshold", () => {
      expect(resolveTierTickets(2, TIER_DEFAULT)).toBe(0);
    });

    test("returns the tier tickets for the highest matching threshold", () => {
      expect(resolveTierTickets(5, TIER_DEFAULT)).toBe(2);
      expect(resolveTierTickets(10, TIER_DEFAULT)).toBe(5);
      expect(resolveTierTickets(15, TIER_DEFAULT)).toBe(10);
      expect(resolveTierTickets(50, TIER_DEFAULT)).toBe(10);
    });
  });

  describe("formatReferralTierLabel", () => {
    test("returns empty string when below all thresholds", () => {
      expect(formatReferralTierLabel(0, TIER_DEFAULT)).toBe("");
    });

    test("formats the matching tier", () => {
      expect(formatReferralTierLabel(7, TIER_DEFAULT)).toBe("2 tickets tier (5+ active referrals)");
      expect(formatReferralTierLabel(20, TIER_DEFAULT)).toBe(
        "10 tickets tier (15+ active referrals)"
      );
    });
  });

  describe("countValidReferredUsers", () => {
    const referredUsers = [
      { _id: { toString: () => "u1" }, createdAt: new Date("2026-01-01"), totalSpent: 50 },
      { _id: { toString: () => "u2" }, createdAt: new Date("2026-01-01"), totalSpent: 0 },
      { _id: { toString: () => "u3" }, createdAt: new Date("2026-01-01"), totalSpent: 200 },
    ];

    test("counts unique qualifying users (deduplicates repeat purchases)", () => {
      const purchases = [
        { referredUserId: { toString: () => "u1" }, purchasedAt: new Date("2026-01-15") },
        { referredUserId: { toString: () => "u1" }, purchasedAt: new Date("2026-01-20") },
        { referredUserId: { toString: () => "u2" }, purchasedAt: new Date("2026-01-15") },
        { referredUserId: { toString: () => "u3" }, purchasedAt: new Date("2026-02-15") }, // outside window
      ];
      expect(countValidReferredUsers(purchases, referredUsers, 30, 1)).toBe(1);
    });

    test("uses purchaseAmount per-purchase (does not trust lifetime totalSpent)", () => {
      // u1's lifetime totalSpent is 50 (would qualify at minSpend=1),
      // but THIS purchase was only £0.50 — must NOT qualify.
      const purchases = [
        {
          referredUserId: { toString: () => "u1" },
          purchasedAt: new Date("2026-01-15"),
          purchaseAmount: 0.5,
        },
      ];
      expect(countValidReferredUsers(purchases, referredUsers, 30, 1)).toBe(0);
    });

    test("per-order purchaseAmount above threshold qualifies even if lifetime totalSpent is 0", () => {
      // u2's lifetime totalSpent is 0 (would fail with legacy check),
      // but THIS purchase was £100 — must qualify.
      const purchases = [
        {
          referredUserId: { toString: () => "u2" },
          purchasedAt: new Date("2026-01-15"),
          purchaseAmount: 100,
        },
      ];
      expect(countValidReferredUsers(purchases, referredUsers, 30, 50)).toBe(1);
    });
  });

  describe("computeReferralTierAward", () => {
    test("multiplies validCount by tierTickets and multiplier, rounded", () => {
      expect(computeReferralTierAward(5, 2, 1)).toBe(10);
      expect(computeReferralTierAward(3, 5, 1.5)).toBe(23);
    });
  });
});

describe("validateReferralTicketSpend", () => {
  beforeEach(() => {
    validateState.competition = {
      status: "active",
      endDate: new Date("2099-12-31"),
      maxTicketsPerUser: 10,
      ticketsSold: 0,
      totalTickets: 100,
    };
    validateState.profile = {
      referralTierAwardedTickets: 5,
    };
    validateState.countOwnedByUserResult = 0;
    validateState.checkTicketAvailabilityThrowMessage = null;
  });

  test("rejects quantity <= 0", async () => {
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 0,
    });
    expect(result).toEqual({
      ok: false,
      code: "INSUFFICIENT_BALANCE",
      message: "Quantity must be positive",
    });
  });

  test("rejects quantity < 0", async () => {
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: -1,
    });
    expect(result).toEqual({
      ok: false,
      code: "INSUFFICIENT_BALANCE",
      message: "Quantity must be positive",
    });
  });

  test("rejects when competition not found", async () => {
    validateState.competition = null;
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      code: "COMPETITION_NOT_FOUND",
      message: "Competition not found",
    });
  });

  test("rejects when competition is not active", async () => {
    validateState.competition.status = "draft";
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      code: "COMPETITION_INACTIVE",
      message: "Competition is not active",
    });
  });

  test("rejects when competition has ended", async () => {
    validateState.competition.endDate = new Date("2020-01-01");
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      code: "COMPETITION_ENDED",
      message: "Competition has ended",
    });
  });

  test("rejects when insufficient balance", async () => {
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 10,
      walletBalance: 5,
    });
    expect(result).toEqual({
      ok: false,
      code: "INSUFFICIENT_BALANCE",
      message: "Insufficient wallet tickets. You have 5 but need 10",
    });
  });

  test("rejects when tickets sold out", async () => {
    validateState.checkTicketAvailabilityThrowMessage = "Only 0 tickets available";
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 1,
    });
    expect(result).toEqual({
      ok: false,
      code: "TICKETS_SOLD_OUT",
      message: "Only 0 tickets available",
    });
  });

  test("rejects when max tickets exceeded", async () => {
    validateState.countOwnedByUserResult = 8;
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 3,
      existingCartQty: 1,
    });
    expect(result).toEqual({
      ok: false,
      code: "MAX_TICKETS_EXCEEDED",
      message: expect.stringContaining("Combined"),
    });
  });

  test("returns ok for valid spend", async () => {
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 3,
      walletBalance: 5,
    });
    expect(result).toEqual({ ok: true });
  });

  test("uses default walletBalance from profile when not provided in params", async () => {
    validateState.profile.referralTierAwardedTickets = 5;
    const result = await validateReferralTicketSpend({
      userId: "u1",
      competitionId: "c1",
      quantity: 5,
    });
    expect(result).toEqual({ ok: true });
  });
});
