import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const __makeThenable = vi.hoisted(() => {
  return (value: number) => {
    const promise = Promise.resolve(value);
    const thenable = Object.assign(promise, {
      maxTimeMS: () => thenable,
    });
    return thenable;
  };
});

const __mocks = vi.hoisted(() => ({
  promoFindOneResult: undefined as unknown,
  promoFindOneAndUpdateResult: undefined as unknown,
  profileFindOneResult: undefined as unknown,
  referralSettingsResult: undefined as unknown,
  completedOrderCount: 0,
}));

vi.mock("@oc/api-db/models", () => ({
  PromoCode: {
    findOne: vi.fn(() => ({
      lean: vi.fn(async () => __mocks.promoFindOneResult),
    })),
    findOneAndUpdate: vi.fn(async () => __mocks.promoFindOneAndUpdateResult),
  },
  Profile: {
    findOne: vi.fn(() => ({
      lean: vi.fn(async () => __mocks.profileFindOneResult),
    })),
  },
  ReferralSettings: {
    findById: vi.fn(() => ({
      lean: vi.fn(async () => __mocks.referralSettingsResult),
    })),
  },
  Order: {
    countDocuments: vi.fn((_filter: unknown) => {
      const thenable = __makeThenable(__mocks.completedOrderCount);
      return Object.assign(thenable, {
        maxTimeMS: vi.fn(() => thenable),
      });
    }),
  },
  PromoRedemption: {
    create: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ deletedCount: 0 })),
    findOneAndUpdate: vi.fn(async () => null),
  },
}));

import { calculateReferralDiscountAmount } from "@oc/api-tickets/promo-codes";

describe("calculateReferralDiscountAmount", () => {
  test("applies percentage to subtotal", () => {
    expect(calculateReferralDiscountAmount(50, 20)).toBe(10);
    expect(calculateReferralDiscountAmount(0, 20)).toBe(0);
  });
});

describe("validatePromoCode", () => {
  beforeEach(() => {
    __mocks.promoFindOneResult = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function loadValidatePromoCode() {
    const mod = await import("@oc/api-tickets/promo-codes");
    return mod.validatePromoCode;
  }

  test("rejects unknown promo code", async () => {
    const validate = await loadValidatePromoCode();
    const result = await validate("MISSING", 20);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid promo code");
  });

  test("accepts active percentage promo", async () => {
    __mocks.promoFindOneResult = {
      code: "E2ETEST20",
      discountType: "percentage",
      discountValue: 20,
      currentUses: 0,
      isActive: true,
    };

    const validate = await loadValidatePromoCode();
    const result = await validate("e2etest20", 50);

    expect(result.valid).toBe(true);
    expect(result.code).toBe("E2ETEST20");
    expect(result.discountAmount).toBe(10);
  });

  test("rejects promo below minimum order value", async () => {
    __mocks.promoFindOneResult = {
      code: "MIN10",
      discountType: "fixed",
      discountValue: 5,
      minOrderValue: 10,
      currentUses: 0,
      isActive: true,
    };

    const validate = await loadValidatePromoCode();
    const result = await validate("MIN10", 5);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Minimum order value");
  });
});

describe("validateReferralCode", () => {
  const referrerId = new Types.ObjectId();
  const buyerId = new Types.ObjectId().toString();

  beforeEach(() => {
    __mocks.profileFindOneResult = null;
    __mocks.referralSettingsResult = {
      refereeReward: { enabled: true, discountPercent: 20, minOrderValue: 0 },
    };
    __mocks.completedOrderCount = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function loadValidateReferralCode() {
    const mod = await import("@oc/api-tickets/promo-codes");
    return mod.validateReferralCode;
  }

  test("blocks self-referral", async () => {
    __mocks.profileFindOneResult = {
      _id: referrerId,
      referralCode: "E2EREF",
    };

    const validate = await loadValidateReferralCode();
    const result = await validate("E2EREF", 20, referrerId.toString());

    expect(result.valid).toBe(false);
    expect(result.error).toBe("You cannot use your own referral code");
  });

  test("blocks referral promo when refereeReward.enabled is false", async () => {
    __mocks.profileFindOneResult = {
      _id: referrerId,
      referralCode: "E2EREF",
    };
    __mocks.referralSettingsResult = {
      refereeReward: { enabled: false, discountPercent: 20, minOrderValue: 0 },
    };

    const validate = await loadValidateReferralCode();
    const result = await validate("E2EREF", 20, buyerId);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Referral discounts are currently disabled");
  });

  test("blocks referral on second completed order", async () => {
    __mocks.profileFindOneResult = {
      _id: referrerId,
      referralCode: "E2EREF",
    };
    __mocks.completedOrderCount = 1;

    const validate = await loadValidateReferralCode();
    const result = await validate("E2EREF", 20, buyerId);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Referral code has already been used");
  });

  test("accepts first-order referral discount", async () => {
    __mocks.profileFindOneResult = {
      _id: referrerId,
      referralCode: "E2EREF",
    };

    const validate = await loadValidateReferralCode();
    const result = await validate("E2EREF", 50, buyerId);

    expect(result.valid).toBe(true);
    expect(result.code).toBe("E2EREF");
    expect(result.discountAmount).toBe(10);
    expect(result.discountType).toBe("percentage");
  });
});

describe("reservePromoCodeUsage", () => {
  beforeEach(() => {
    __mocks.promoFindOneResult = {
      _id: new Types.ObjectId(),
      code: "TEST20",
      discountType: "percentage",
      discountValue: 20,
      maxUses: 10,
      currentUses: 0,
      maxUsesPerUser: 1,
      usedBy: [],
      isActive: true,
      validFrom: new Date(Date.now() - 86400000),
      validUntil: new Date(Date.now() + 86400000),
    };
    __mocks.promoFindOneAndUpdateResult = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function loadReservePromoCodeUsage() {
    const mod = await import("@oc/api-tickets/promo-codes");
    return mod.reservePromoCodeUsage;
  }

  test("returns the promo code on successful first reservation", async () => {
    const userId = new Types.ObjectId().toString();
    __mocks.promoFindOneAndUpdateResult = {
      ...__mocks.promoFindOneResult,
      currentUses: 1,
      usedBy: [userId],
    };

    const reserve = await loadReservePromoCodeUsage();
    const result = await reserve("TEST20", userId);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("TEST20");
  });

  test("prevents double-reservation for the same user", async () => {
    const userId = new Types.ObjectId().toString();
    const reserve = await loadReservePromoCodeUsage();
    const result = await reserve("TEST20", userId);

    expect(result).toBeNull();
  });

  test("respects maxUses when limit is reached", async () => {
    __mocks.promoFindOneResult = {
      ...__mocks.promoFindOneResult,
      currentUses: 10,
      maxUses: 10,
    };

    const reserve = await loadReservePromoCodeUsage();
    const result = await reserve("TEST20", new Types.ObjectId().toString());

    expect(result).toBeNull();
  });
});
