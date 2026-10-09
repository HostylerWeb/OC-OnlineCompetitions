import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const __merge = vi.hoisted(() => ({
  profileFindByIdResult: null as Record<string, unknown> | null,
  profileUpdateCalls: [] as Array<{ id: string; update: Record<string, unknown> }>,
  profileDeleteCalls: [] as string[],
  referralPurchaseUpdateCalls: [] as Array<{
    filter: Record<string, unknown>;
    update: Record<string, unknown>;
  }>,
  cartFindOneResults: {} as Record<string, unknown>,
  cartSaveCalls: [] as unknown[],
  cartDeleteCalls: [] as unknown[],
  ensureReferralDiscountOnCart: vi.fn(async () => {}),
}));

const __apply = vi.hoisted(() => ({
  profileDoc: null as Record<string, unknown> | null,
  profileSaveCalls: [] as unknown[],
  profileCreateCalls: [] as unknown[],
}));

const __profile = vi.hoisted(() => ({
  findById: (_id: string) => ({ lean: async () => null }),
  findByIdAndUpdate: async (_id: string, _update: Record<string, unknown>) => ({}),
  deleteOne: async (_query: Record<string, unknown>) => ({}),
  deleteMany: async (_query: Record<string, unknown>) => ({ deletedCount: 0 }),
  findOne: (_query: Record<string, unknown>) => ({ lean: async () => null }),
  find: (_query: Record<string, unknown>) => ({
    select: (_fields: string) => ({ lean: async () => [] }),
    lean: async () => [],
  }),
  create: async (_data: Record<string, unknown>) => ({}),
}));

const __referralPurchase = vi.hoisted(() => ({
  updateMany: async (_filter: Record<string, unknown>, _update: Record<string, unknown>) => ({
    modifiedCount: 1,
  }),
}));

const __cart = vi.hoisted(() => ({
  findOne: (_query: Record<string, unknown>) => ({
    exec: async () => null,
    lean: async () => null,
  }),
  updateOne: async (_query: Record<string, unknown>, _update: Record<string, unknown>) => ({
    modifiedCount: 0,
  }),
  findOneAndDeleteCalls: [] as Record<string, unknown>[],
  findOneAndDelete: async (_query: Record<string, unknown>) => {
    __cart.findOneAndDeleteCalls.push(_query);
    return null;
  },
}));

const __balance = vi.hoisted(() => ({
  findOne: (_query: Record<string, unknown>) => ({ lean: async () => null }),
  updateOne: async (_query: Record<string, unknown>, _update: Record<string, unknown>) => ({
    modifiedCount: 0,
  }),
  deleteOne: async (_query: Record<string, unknown>) => ({}),
}));

const __ticket = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ modifiedCount: 8 })),
  countDocuments: vi.fn(() => ({ maxTimeMS: vi.fn(() => Promise.resolve(0)) })),
}));

const __shopCart = vi.hoisted(() => ({
  findOne: (_query: Record<string, unknown>) => ({ exec: async () => null }),
}));

const __shopOrder = vi.hoisted(() => ({
  updateMany: async (_filter: Record<string, unknown>, _update: Record<string, unknown>) => ({
    modifiedCount: 0,
  }),
}));

const __order = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ modifiedCount: 3 })),
  aggregate: vi.fn(() => ({
    maxTimeMS: vi.fn(() => Promise.resolve([])),
    exec: vi.fn(() => Promise.resolve([])),
  })),
}));

vi.mock("@oc/api-db", () => ({
  dbConnect: vi.fn(async () => {}),
}));

vi.mock("@oc/api-infra/db", () => ({
  default: vi.fn(async () => {}),
}));

vi.mock("@oc/api-tickets/cart", async () => {
  const actual = await vi.importActual("@oc/api-tickets/cart");
  return {
    ...actual,
    mergeCartItem: (items: unknown[], item: unknown) => [...(items as unknown[]), item],
    finalizeCart: async () => {},
    ensureReferralDiscountOnCart: __merge.ensureReferralDiscountOnCart,
  };
});

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: (id: string) => __profile.findById(id),
    findByIdAndUpdate: (id: string, update: Record<string, unknown>) =>
      __profile.findByIdAndUpdate(id, update),
    deleteOne: (query: Record<string, unknown>) => __profile.deleteOne(query),
    deleteMany: (query: Record<string, unknown>) => __profile.deleteMany(query),
    findOne: (query: Record<string, unknown>) => __profile.findOne(query),
    find: (query: Record<string, unknown>) => __profile.find(query),
    create: (data: Record<string, unknown>) => __profile.create(data),
  },
  ReferralPurchase: {
    updateMany: (filter: Record<string, unknown>, update: Record<string, unknown>) =>
      __referralPurchase.updateMany(filter, update),
  },
  Cart: {
    findOne: (query: Record<string, unknown>) => __cart.findOne(query),
    updateOne: (query: Record<string, unknown>, update: Record<string, unknown>) =>
      __cart.updateOne(query, update),
    deleteOne: (query: Record<string, unknown>) => __cart.deleteOne(query),
    findOneAndDelete: (query: Record<string, unknown>) => __cart.findOneAndDelete(query),
  },
  Balance: {
    findOne: (query: Record<string, unknown>) => __balance.findOne(query),
    updateOne: (query: Record<string, unknown>, update: Record<string, unknown>) =>
      __balance.updateOne(query, update),
    deleteOne: (query: Record<string, unknown>) => __balance.deleteOne(query),
  },
  Order: {
    updateMany: __order.updateMany,
    aggregate: __order.aggregate,
  },
  Ticket: {
    updateMany: __ticket.updateMany,
    countDocuments: __ticket.countDocuments,
  },
  Winner: {
    updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
    countDocuments: vi.fn(() => ({ maxTimeMS: () => Promise.resolve(0) })),
  },
  InstantPrizeWin: {
    updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
    countDocuments: vi.fn(() => ({ maxTimeMS: () => Promise.resolve(0) })),
  },
  BonusAwardWin: {
    updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
    countDocuments: vi.fn(() => ({ maxTimeMS: () => Promise.resolve(0) })),
  },
  PushSubscription: {
    updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
    countDocuments: vi.fn(() => ({ maxTimeMS: () => Promise.resolve(0) })),
  },
  PaymentAttempt: {
    updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
    countDocuments: vi.fn(() => ({ maxTimeMS: () => Promise.resolve(0) })),
  },
  SelfExclusionOverrideRequest: {
    updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
    countDocuments: vi.fn(() => ({ maxTimeMS: () => Promise.resolve(0) })),
  },
  ComplianceAuditLog: {
    updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
    countDocuments: vi.fn(() => ({ maxTimeMS: () => Promise.resolve(0) })),
  },
  ShopCart: {
    findOne: (query: Record<string, unknown>) => __shopCart.findOne(query),
  },
  ShopOrder: {
    updateMany: (filter: Record<string, unknown>, update: Record<string, unknown>) =>
      __shopOrder.updateMany(filter, update),
  },
}));

vi.mock("@oc/api-db/models/Order", () => ({
  default: {
    updateMany: vi.fn(async () => ({ modifiedCount: 1 })),
    findById: vi.fn(() => null),
  },
  Order: {
    updateMany: vi.fn(async () => ({ modifiedCount: 1 })),
    findById: vi.fn(() => null),
  },
}));

describe("mergeAnonymousAccount", () => {
  const anonId = new Types.ObjectId().toString();
  const newId = new Types.ObjectId().toString();
  const referrerId = new Types.ObjectId();

  beforeEach(async () => {
    __merge.profileFindByIdResult = null;
    __merge.profileUpdateCalls = [];
    __merge.profileDeleteCalls = [];
    __merge.referralPurchaseUpdateCalls = [];
    __merge.cartFindOneResults = {};
    __merge.cartSaveCalls = [];
    __merge.cartDeleteCalls = [];
    __cart.findOneAndDeleteCalls = [];

    __profile.findById = (id: string) => ({
      lean: async () => {
        if (id === anonId) {
          return (
            __merge.profileFindByIdResult ?? {
              _id: anonId,
              email: `guest-${anonId}@guest.onlinecompetitions.local`,
              referredBy: referrerId,
              referredByCode: "ABC123",
            }
          );
        }
        if (id === newId) {
          return { _id: newId, email: "user@example.com" };
        }
        return null;
      },
    });

    __profile.findByIdAndUpdate = async (id: string, update: Record<string, unknown>) => {
      __merge.profileUpdateCalls.push({ id, update });
      return {};
    };

    __profile.deleteOne = async (query: Record<string, unknown>) => {
      __merge.profileDeleteCalls.push(query._id as string);
      return {};
    };

    __referralPurchase.updateMany = async (
      filter: Record<string, unknown>,
      update: Record<string, unknown>
    ) => {
      __merge.referralPurchaseUpdateCalls.push({ filter, update });
      return { modifiedCount: 1 };
    };

    __cart.findOne = (query) => ({
      exec: async () =>
        __merge.cartFindOneResults[(query.userId as Types.ObjectId).toString()] ?? null,
    });

    __cart.deleteOne = async (query) => {
      __merge.cartDeleteCalls.push(query);
      return {};
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function loadMergeAnonymousAccount() {
    const mod = await import("@oc/auth-admin/auth-hooks");
    return mod.mergeAnonymousAccount;
  }

  test("re-keys referral purchases and deletes guest profile without cart", async () => {
    const mergeAnonymousAccount = await loadMergeAnonymousAccount();

    await mergeAnonymousAccount({
      anonymousUser: { id: anonId, email: `guest-${anonId}@guest.onlinecompetitions.local` },
      newUser: { id: newId, email: "user@example.com" },
    });

    expect(__merge.referralPurchaseUpdateCalls.length).toBeGreaterThanOrEqual(1);
    expect(__merge.profileDeleteCalls).toEqual([anonId]);
    expect(__merge.profileUpdateCalls.length).toBeGreaterThanOrEqual(1);
    expect(__merge.profileUpdateCalls[0]?.update).toMatchObject({
      referredBy: referrerId,
      referredByCode: "ABC123",
    });
  });

  test("merges anonymous cart into existing user cart", async () => {
    const anonCart = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(anonId),
      items: [{ competitionId: new Types.ObjectId(), quantity: 2 }],
      save: async function save(this: { userId: Types.ObjectId }) {
        __merge.cartSaveCalls.push(this);
      },
    };
    const userCart = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(newId),
      items: [] as unknown[],
      save: async function save(this: unknown) {
        __merge.cartSaveCalls.push(this);
      },
    };

    __merge.cartFindOneResults[anonId] = anonCart;
    __merge.cartFindOneResults[newId] = userCart;

    const mergeAnonymousAccount = await loadMergeAnonymousAccount();

    await mergeAnonymousAccount({
      anonymousUser: { id: anonId, email: `guest-${anonId}@guest.onlinecompetitions.local` },
      newUser: { id: newId, email: "user@example.com" },
    });

    expect(userCart.items).toHaveLength(1);
    expect(__cart.findOneAndDeleteCalls).toHaveLength(1);
    expect(__merge.profileDeleteCalls).toEqual([anonId]);
  });
});

describe("applyReferralToProfile", () => {
  const userId = new Types.ObjectId().toString();
  const referrerAId = new Types.ObjectId();
  const referrerBId = new Types.ObjectId();

  beforeEach(() => {
    __apply.profileDoc = null;
    __apply.profileSaveCalls = [];
    __apply.profileCreateCalls = [];

    __profile.findById = (id: string) => {
      if (id !== userId) return null;
      return __apply.profileDoc;
    };

    __profile.findOne = (query: Record<string, unknown>) => ({
      lean: async () => {
        const code = (query.referralCode as string)?.toUpperCase();
        if (code === "CODEA") return { _id: referrerAId };
        if (code === "CODEB") return { _id: referrerBId };
        return null;
      },
    });

    __profile.create = async (data: Record<string, unknown>) => {
      __apply.profileCreateCalls.push(data);
      __apply.profileDoc = { ...data };
      return __apply.profileDoc;
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function loadApplyReferralToProfile() {
    const mod = await import("@oc/auth-admin/auth-hooks");
    return mod.applyReferralToProfile;
  }

  test("creates guest profile and applies first referral code", async () => {
    const applyReferralToProfile = await loadApplyReferralToProfile();
    const result = await applyReferralToProfile(userId, "codea");

    expect(result).toEqual({
      applied: true,
      referredByCode: "CODEA",
      referredBySignupCode: "CODEA",
    });
    expect(__apply.profileCreateCalls).toHaveLength(1);
    expect(__apply.profileCreateCalls[0]).toMatchObject({
      _id: userId,
      referredBy: referrerAId,
      referredByCode: "CODEA",
      referredBySignup: referrerAId,
      referredBySignupCode: "CODEA",
    });
  });

  test("blocks overwrite when referredBySignup is set (signup referrer is canonical)", async () => {
    __apply.profileDoc = {
      _id: userId,
      email: `guest-${userId}@guest.onlinecompetitions.local`,
      referredBy: referrerAId,
      referredByCode: "CODEA",
      referredBySignup: referrerAId,
      referredBySignupCode: "CODEA",
      save: async function save(this: Record<string, unknown>) {
        __apply.profileSaveCalls.push(this);
        __apply.profileDoc = this;
        return this;
      },
    };

    const applyReferralToProfile = await loadApplyReferralToProfile();
    const result = await applyReferralToProfile(userId, "codeb");

    expect(result).toEqual({
      applied: false,
      referredByCode: "CODEA",
    });
    expect(__apply.profileSaveCalls).toHaveLength(0);
  });

  test("overwrites an existing referral code when no signup referrer is set", async () => {
    __apply.profileDoc = {
      _id: userId,
      email: `guest-${userId}@guest.onlinecompetitions.local`,
      referredBy: referrerAId,
      referredByCode: "CODEA",
      save: async function save(this: Record<string, unknown>) {
        __apply.profileSaveCalls.push(this);
        __apply.profileDoc = this;
        return this;
      },
    };

    const applyReferralToProfile = await loadApplyReferralToProfile();
    const result = await applyReferralToProfile(userId, "codeb");

    expect(result).toEqual({
      applied: true,
      referredByCode: "CODEB",
      overwritten: true,
    });
    expect(__apply.profileSaveCalls).toHaveLength(1);
    expect((__apply.profileDoc as { referredByCode?: string }).referredByCode).toBe("CODEB");
  });

  test("returns existing code without overwrite when code is unchanged", async () => {
    __apply.profileDoc = {
      _id: userId,
      referredBy: referrerAId,
      referredByCode: "CODEA",
    };

    const applyReferralToProfile = await loadApplyReferralToProfile();
    const result = await applyReferralToProfile(userId, "codea");

    expect(result).toEqual({ applied: false, referredByCode: "CODEA" });
  });
});

describe("createGuestCheckoutProfile", () => {
  const userId = new Types.ObjectId().toString();
  const guestEmail = "guest@example.com";

  beforeEach(() => {
    __merge.profileUpdateCalls = [];
    __apply.profileCreateCalls = [];

    __profile.findById = (id: string) => ({
      lean: async () => (id === userId ? null : null),
    });
    __profile.findByIdAndUpdate = async (_id: string, _update: Record<string, unknown>) => ({});
    __profile.create = async (data: Record<string, unknown>) => {
      __apply.profileCreateCalls.push(data);
      return data;
    };
  });

  test("creates profile with guest email and isGuestCheckout flag", async () => {
    const { createGuestCheckoutProfile } = await import("@oc/auth-admin/auth-hooks");
    await createGuestCheckoutProfile(userId, { guestEmail });

    expect(__apply.profileCreateCalls).toHaveLength(1);
    const created = __apply.profileCreateCalls[0] as Record<string, unknown>;
    expect(created._id).toBe(userId);
    expect(created.email).toBe(guestEmail);
    expect(created.isGuestCheckout).toBe(true);
    expect(created.country).toBe("GB");
    expect(created.isVerified).toBe(false);
  });

  test("updates existing profile when one already exists", async () => {
    __profile.findById = (id: string) => ({
      lean: async () => (id === userId ? { _id: userId, email: guestEmail } : null),
    });
    __profile.findByIdAndUpdate = async (id: string, update: Record<string, unknown>) => {
      __merge.profileUpdateCalls.push({ id, update });
      return {};
    };

    const { createGuestCheckoutProfile } = await import("@oc/auth-admin/auth-hooks");
    await createGuestCheckoutProfile(userId, { guestEmail });

    expect(__merge.profileUpdateCalls).toHaveLength(1);
    expect(__merge.profileUpdateCalls[0]!.update).toMatchObject({
      email: guestEmail,
    });
  });

  test("reuses existing verified Gmail account despite dot-variant email", async () => {
    // Regression: a guest entering alexandru.chiriacc@gmail.com must match a
    // verified profile stored as alexandruchiriacc@gmail.com (canonicalized).
    // Before the fix, the dot-stripped lookup missed the dotted stored email.
    const verifiedId = new Types.ObjectId().toString();
    __profile.findOne = (query: Record<string, unknown>) => ({
      lean: async () => {
        if (query.email === "alexandruchiriacc@gmail.com" && query.isVerified === true) {
          return { _id: verifiedId, email: "alexandru.chiriacc@gmail.com", isVerified: true };
        }
        return null;
      },
    });

    const { createGuestCheckoutProfile } = await import("@oc/auth-admin/auth-hooks");
    const result = await createGuestCheckoutProfile(userId, {
      guestEmail: "alexandru.chiriacc@gmail.com",
    });

    // orderUserId points at the existing verified account, no new guest created
    expect(result.orderUserId).toBe(verifiedId);
    expect(__apply.profileCreateCalls).toHaveLength(0);
  });
});

describe("mergeAnonymousAccount — guest profile with real email", () => {
  const anonId = new Types.ObjectId().toString();
  const newId = new Types.ObjectId().toString();

  async function loadMergeAnon() {
    return (await import("@oc/auth-admin/auth-hooks")).mergeAnonymousAccount;
  }

  const anonProfile = {
    _id: anonId,
    email: "real@example.com",
    firstName: "John",
    lastName: "Doe",
    country: "GB",
    isGuestCheckout: true,
    isVerified: false,
    dateOfBirth: new Date("1990-01-01"),
    marketingConsent: false,
  };

  beforeEach(() => {
    __merge.profileDeleteCalls = [];
    __merge.profileUpdateCalls = [];
    __apply.profileCreateCalls = [];

    __profile.findById = (id: string) => ({
      lean: async () => {
        if (id === anonId) return anonProfile;
        if (id === newId) return null;
        return null;
      },
    });
    __profile.findByIdAndUpdate = async (id: string, update: Record<string, unknown>) => {
      __merge.profileUpdateCalls.push({ id, update });
      return {};
    };
    __profile.deleteOne = async (query: Record<string, unknown>) => {
      __merge.profileDeleteCalls.push(query._id as string);
      return {};
    };
    __profile.create = async (data: Record<string, unknown>) => {
      __apply.profileCreateCalls.push(data);
      return data;
    };
    __referralPurchase.updateMany = async () => ({ modifiedCount: 1 });
    __cart.findOne = () => ({ exec: async () => null });
  });

  test("transfers profile data and deletes old guest profile", async () => {
    const mergeAnonymousAccount = await loadMergeAnon();
    await mergeAnonymousAccount({
      anonymousUser: { id: anonId, email: anonProfile.email },
      newUser: { id: newId, email: "real@example.com" },
    });

    // New profile created with transferred data
    expect(__apply.profileCreateCalls).toHaveLength(1);
    const created = __apply.profileCreateCalls[0] as Record<string, unknown>;
    expect(created._id).toBe(newId);
    expect(created.email).toBe("real@example.com");
    expect(created.isGuestCheckout).toBe(false);
    expect(created.isVerified).toBe(false);
    expect(created.firstName).toBe("John");

    // Old guest profile deleted
    expect(__merge.profileDeleteCalls).toEqual([anonId]);
  });

  test("does not create duplicate profile when newId already has one", async () => {
    __profile.findById = (id: string) => ({
      lean: async () => {
        if (id === anonId) return anonProfile;
        if (id === newId) return { _id: newId, email: "real@example.com" };
        return null;
      },
    });

    const mergeAnonymousAccount = await loadMergeAnon();
    await mergeAnonymousAccount({
      anonymousUser: { id: anonId, email: anonProfile.email },
      newUser: { id: newId, email: "real@example.com" },
    });

    // Should NOT create a new profile (existing one found)
    expect(__apply.profileCreateCalls).toHaveLength(0);
    // But should still delete the old guest profile
    expect(__merge.profileDeleteCalls).toEqual([anonId]);
  });
});

describe("isGuestProfileEmail", () => {
  test("detects guest profile emails", async () => {
    const { isGuestProfileEmail } = await import("@oc/auth-admin/auth-hooks");
    expect(isGuestProfileEmail("guest-abc@guest.onlinecompetitions.local")).toBe(true);
    expect(isGuestProfileEmail("user@example.com")).toBe(false);
  });
});

describe("mergeGuestProfileIntoVerifiedUser", () => {
  const guestEmail = "guest@example.com";
  const guestId = new Types.ObjectId().toString();
  const verifiedId = new Types.ObjectId().toString();

  beforeEach(() => {
    __order.updateMany.mockClear();
    __ticket.updateMany.mockClear();
    __merge.profileDeleteCalls = [];
    __merge.profileUpdateCalls = [];

    __profile.findById = (id: string) => ({
      lean: async () => {
        if (id === guestId) {
          return {
            _id: guestId,
            email: guestEmail,
            isGuestCheckout: true,
            firstName: "Guest",
            lastName: "User",
            phone: "+1234567890",
            addressLine1: "123 Main St",
            city: "London",
            postcode: "SW1A 1AA",
            totalEntries: 10,
            totalSpent: 50,
            winsCount: 2,
          };
        }
        if (id === verifiedId) return { _id: verifiedId, email: guestEmail };
        return null;
      },
    });

    __profile.findOne = (query: Record<string, unknown>) => ({
      lean: async () => {
        if (query.email === guestEmail && query.isGuestCheckout) {
          return {
            _id: guestId,
            email: guestEmail,
            isGuestCheckout: true,
            firstName: "Guest",
            lastName: "User",
            phone: "+1234567890",
            addressLine1: "123 Main St",
            city: "London",
            postcode: "SW1A 1AA",
            totalEntries: 10,
            totalSpent: 50,
            winsCount: 2,
          };
        }
        return null;
      },
    });

    __profile.deleteOne = async (query: Record<string, unknown>) => {
      __merge.profileDeleteCalls.push(query._id as string);
      return {};
    };

    __profile.findByIdAndUpdate = async (id: string, update: Record<string, unknown>) => {
      __merge.profileUpdateCalls.push({ id, update });
      return {};
    };
  });

  test("transfers orders, tickets, and profile data from guest to verified user", async () => {
    // computeProfileStats reads ground truth: owned tickets w/ order + net
    // completed order totals. Configure the mocks to reflect a post-transfer
    // snapshot so the assertion proves recompute (not stale guest counters).
    (__ticket.countDocuments as ReturnType<typeof vi.fn>).mockReturnValue({
      maxTimeMS: vi.fn(() => Promise.resolve(12)),
    });
    __order.aggregate.mockReturnValue({
      maxTimeMS: vi.fn(() => Promise.resolve([{ total: 55 }])),
      exec: vi.fn(() => Promise.resolve([{ total: 55 }])),
    });

    const { mergeGuestProfileIntoVerifiedUser } = await import("@oc/auth-admin/auth-hooks");
    const result = await mergeGuestProfileIntoVerifiedUser(guestEmail, verifiedId);

    expect(result.merged).toBe(true);
    expect(result.guestId).toBe(guestId);
    expect(result.firstName).toBe("Guest");
    expect(result.lastName).toBe("User");

    expect(__order.updateMany).toHaveBeenCalledTimes(1);
    expect(__ticket.updateMany).toHaveBeenCalledTimes(1);
    expect(__merge.profileDeleteCalls).toEqual([guestId]);

    expect(__merge.profileUpdateCalls).toHaveLength(1);
    const profileUpdate = __merge.profileUpdateCalls[0]?.update;
    expect(profileUpdate).toHaveProperty("$set");
    expect((profileUpdate as Record<string, unknown>).$set).toMatchObject({
      phone: "+1234567890",
      addressLine1: "123 Main St",
      totalEntries: 12,
      totalSpent: 55,
    });
  });

  test("returns {merged: false} when no guest profile matches", async () => {
    __profile.findOne = () => ({ lean: async () => null });

    const { mergeGuestProfileIntoVerifiedUser } = await import("@oc/auth-admin/auth-hooks");
    const result = await mergeGuestProfileIntoVerifiedUser("other@example.com", verifiedId);

    expect(result.merged).toBe(false);
    expect(__order.updateMany).not.toHaveBeenCalled();
  });

  test("skips @guest.onlinecompetitions.local synthetic emails", async () => {
    const { mergeGuestProfileIntoVerifiedUser } = await import("@oc/auth-admin/auth-hooks");
    const result = await mergeGuestProfileIntoVerifiedUser(
      "guest-abc@guest.onlinecompetitions.local",
      verifiedId
    );

    expect(result.merged).toBe(false);
    expect(__order.updateMany).not.toHaveBeenCalled();
  });

  test("matches guest profile via Gmail dot-canonicalized email", async () => {
    // Regression: guest profile stored dotless (alexandruchiriacc@gmail.com)
    // must be found when the verified user's email has dots
    // (alexandru.chiriacc@gmail.com).
    (__ticket.countDocuments as ReturnType<typeof vi.fn>).mockReturnValue({
      maxTimeMS: vi.fn(() => Promise.resolve(0)),
    });
    __order.aggregate.mockReturnValue({
      maxTimeMS: vi.fn(() => Promise.resolve([])),
      exec: vi.fn(() => Promise.resolve([])),
    });
    __profile.findOne = (query: Record<string, unknown>) => ({
      lean: async () => {
        if (query.email === "alexandruchiriacc@gmail.com" && query.isGuestCheckout) {
          return {
            _id: guestId,
            email: "alexandruchiriacc@gmail.com",
            isGuestCheckout: true,
            firstName: "Guest",
            lastName: "User",
          };
        }
        return null;
      },
    });

    const { mergeGuestProfileIntoVerifiedUser } = await import("@oc/auth-admin/auth-hooks");
    const result = await mergeGuestProfileIntoVerifiedUser(
      "alexandru.chiriacc@gmail.com",
      verifiedId
    );

    expect(result.merged).toBe(true);
    expect(result.guestId).toBe(guestId);
    expect(__merge.profileDeleteCalls).toEqual([guestId]);
  });
});
