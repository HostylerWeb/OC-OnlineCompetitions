import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const __mocks = vi.hoisted(() => ({
  getComplianceSettings: vi.fn(async () => ({
    masterEnabled: true,
    ageVerificationEnabled: false,
    personalSpendLimitsEnabled: true,
    selfExclusionEnabled: false,
    creditCardMonthlyLimitEnabled: false,
    instantWinCreditCardBanEnabled: false,
  })),
  isComplianceEnforcementActive: vi.fn(() => true),
  reconcileSelfExclusionOnRead: vi.fn(async () => undefined),
  findById: vi.fn(),
  getUserCompletedOrderCount: vi.fn(async () => 1),
  getUserMonthlySpendAllMethods: vi.fn(async () => 0),
  reserveSpendAllowance: vi.fn(async () => true),
  getUserCreditCardSpendThisMonth: vi.fn(async () => 0),
  cartHasInstantWinCompetitions: vi.fn(async () => false),
  assertNotEffectivelySelfExcluded: vi.fn(() => undefined),
  applyPendingSpendLimit: vi.fn(async (profile: unknown) => profile),
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: __mocks.findById,
  },
}));

vi.mock("./settings", () => ({
  getComplianceSettings: __mocks.getComplianceSettings,
  isComplianceEnforcementActive: __mocks.isComplianceEnforcementActive,
}));

vi.mock("./compliance-user-service", () => ({
  assertNotEffectivelySelfExcluded: __mocks.assertNotEffectivelySelfExcluded,
  reconcileSelfExclusionOnRead: __mocks.reconcileSelfExclusionOnRead,
}));

vi.mock("./instant-win", () => ({
  cartHasInstantWinCompetitions: __mocks.cartHasInstantWinCompetitions,
}));

vi.mock("./spend-tracking", () => ({
  getUserCompletedOrderCount: __mocks.getUserCompletedOrderCount,
  getUserMonthlySpendAllMethods: __mocks.getUserMonthlySpendAllMethods,
  reserveSpendAllowance: __mocks.reserveSpendAllowance,
  getUserCreditCardSpendThisMonth: __mocks.getUserCreditCardSpendThisMonth,
}));

import { assertComplianceForCheckout } from "./compliance-checks";

function makeProfile(overrides: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId();
  return {
    _id,
    isGuestCheckout: false,
    isAgeVerified: true,
    selfExcluded: false,
    selfExcludedUntil: null,
    pendingMonthlySpendLimit: null,
    monthlySpendLimitEffectiveAt: null,
    monthlySpendLimit: 10_000,
    reservedSpend: 0,
    ...overrides,
  };
}

describe("assertComplianceForCheckout — personal spend limit (SL-1 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.findById.mockImplementation(() => ({
      lean: async () => makeProfile(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("£10k limit + £100 cart + zero month-spend succeeds (regression for SL-1)", async () => {
    __mocks.getUserMonthlySpendAllMethods.mockResolvedValueOnce(0);
    __mocks.reserveSpendAllowance.mockResolvedValueOnce(true);

    await expect(
      assertComplianceForCheckout({
        userId: new Types.ObjectId().toString(),
        cartTotal: 100,
        competitionIds: [],
        projectedCreditSpend: 0,
      })
    ).resolves.toBeDefined();

    expect(__mocks.reserveSpendAllowance).toHaveBeenCalledTimes(1);
    const call = __mocks.reserveSpendAllowance.mock.calls[0];
    expect(call[1]).toBe(100);
    expect(call[2]).toBe(0);
  });

  test("does NOT pass monthlySpendLimit as currentMonthSpend (the bug)", async () => {
    __mocks.getUserMonthlySpendAllMethods.mockResolvedValueOnce(0);
    __mocks.reserveSpendAllowance.mockResolvedValueOnce(true);

    await assertComplianceForCheckout({
      userId: new Types.ObjectId().toString(),
      cartTotal: 100,
      competitionIds: [],
      projectedCreditSpend: 0,
    });

    const thirdArg = __mocks.reserveSpendAllowance.mock.calls[0][2];
    expect(thirdArg).not.toBe(10_000);
  });
});

describe("assertComplianceForCheckout — order value policy (0-subtotal / minimum order)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.findById.mockImplementation(() => ({
      lean: async () => makeProfile(),
    }));
    __mocks.getComplianceSettings.mockResolvedValue({
      masterEnabled: true,
      ageVerificationEnabled: false,
      personalSpendLimitsEnabled: true,
      selfExclusionEnabled: false,
      creditCardMonthlyLimitEnabled: false,
      instantWinCreditCardBanEnabled: false,
      allowZeroSubtotalOrders: true,
      minimumOrderValue: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("rejects a £0 cart when allowZeroSubtotalOrders is disabled", async () => {
    __mocks.getComplianceSettings.mockResolvedValue({
      masterEnabled: true,
      allowZeroSubtotalOrders: false,
      minimumOrderValue: 0,
    });

    await expect(
      assertComplianceForCheckout({
        userId: new Types.ObjectId().toString(),
        cartTotal: 0,
        competitionIds: [],
        projectedCreditSpend: 0,
      })
    ).rejects.toMatchObject({ code: "ZERO_SUBTOTAL_DISABLED", status: 400 });
  });

  test("rejects a cart below the minimum order value", async () => {
    __mocks.getComplianceSettings.mockResolvedValue({
      masterEnabled: true,
      allowZeroSubtotalOrders: true,
      minimumOrderValue: 5,
    });

    await expect(
      assertComplianceForCheckout({
        userId: new Types.ObjectId().toString(),
        cartTotal: 3,
        competitionIds: [],
        projectedCreditSpend: 0,
      })
    ).rejects.toMatchObject({ code: "MINIMUM_ORDER_NOT_MET", status: 400 });
  });

  test("allows a £0 cart when allowZeroSubtotalOrders is enabled", async () => {
    await expect(
      assertComplianceForCheckout({
        userId: new Types.ObjectId().toString(),
        cartTotal: 0,
        competitionIds: [],
        projectedCreditSpend: 0,
      })
    ).resolves.toBeDefined();
  });

  test("allows a cart above the minimum order value", async () => {
    __mocks.getComplianceSettings.mockResolvedValue({
      masterEnabled: true,
      allowZeroSubtotalOrders: true,
      minimumOrderValue: 5,
    });

    await expect(
      assertComplianceForCheckout({
        userId: new Types.ObjectId().toString(),
        cartTotal: 10,
        competitionIds: [],
        projectedCreditSpend: 0,
      })
    ).resolves.toBeDefined();
  });

  test("skips order-value policy when a minimum order is not configured", async () => {
    await expect(
      assertComplianceForCheckout({
        userId: new Types.ObjectId().toString(),
        cartTotal: 100,
        competitionIds: [],
        projectedCreditSpend: 0,
      })
    ).resolves.toBeDefined();
  });
});
