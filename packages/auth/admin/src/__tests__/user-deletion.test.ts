import mongoose from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockUserId = "507f1f77bcf86cd799439011";

function chainable(resolveValue: unknown) {
  const obj = {
    session: vi.fn(() => obj),
    // biome-ignore lint/suspicious/noThenProperty: thenable for Mongoose query chain mock
    then: (resolve: (v: unknown) => void) => Promise.resolve(resolveValue).then(resolve),
  };
  return obj;
}

const sessionMocks = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  endSession: vi.fn(),
};

const mockRemoveUser = vi.fn(async () => {});

const mockDb = {
  collection: vi.fn(() => ({
    deleteMany: vi.fn(async () => ({ deletedCount: 1 })),
  })),
};

const modelCalls: Record<string, unknown[]> = {};

function pushCall(name: string, ...args: unknown[]) {
  if (!modelCalls[name]) modelCalls[name] = [];
  modelCalls[name].push(...args);
}

vi.mock("@oc/api-db", () => ({
  dbConnect: vi.fn(async () => {}),
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: vi.fn(async () => null),
    updateOne: vi.fn((filter: any, update: any) => {
      pushCall("profileUpdateOne", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  Cart: {
    deleteOne: vi.fn((query: any) => {
      pushCall("cartDeleteOne", query);
      return chainable({ deletedCount: 1 });
    }),
  },
  Order: {
    find: vi.fn(() => ({
      session: vi.fn(() => ({
        select: vi.fn(() => ({
          lean: vi.fn(async () => [{ _id: "order-id-1" }, { _id: "order-id-2" }]),
        })),
      })),
    })),
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("orderUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  OrderItem: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("orderItemUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  Ticket: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("ticketUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  Balance: {
    deleteOne: vi.fn((query: any) => {
      pushCall("balanceDeleteOne", query);
      return chainable({ deletedCount: 1 });
    }),
  },
  BalanceTransaction: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("balanceTransactionUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  Winner: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("winnerUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  ReferralPurchase: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("referralPurchaseUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  ComplianceAuditLog: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("complianceAuditLogUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  InstantPrizeWin: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("instantPrizeWinUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  PushSubscription: {
    deleteMany: vi.fn((query: any) => {
      pushCall("pushSubscriptionDeleteMany", query);
      return chainable({ deletedCount: 1 });
    }),
  },
  SelfExclusionOverrideRequest: {
    deleteMany: vi.fn((query: any) => {
      pushCall("selfExclusionDeleteMany", query);
      return chainable({ deletedCount: 1 });
    }),
  },
  PaymentAttempt: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("paymentAttemptUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
  Notification: {
    deleteMany: vi.fn((query: any) => {
      pushCall("notificationDeleteMany", query);
      return chainable({ deletedCount: 1 });
    }),
  },
  ShopCart: {
    deleteMany: vi.fn((query: any) => {
      pushCall("shopCartDeleteMany", query);
      return chainable({ deletedCount: 1 });
    }),
  },
  ShopOrder: {
    updateMany: vi.fn((filter: any, update: any) => {
      pushCall("shopOrderUpdateMany", { filter, update });
      return chainable({ modifiedCount: 1 });
    }),
  },
}));

vi.mock("@oc/api-infra/cache", () => ({
  CH: {
    competitionAvailability: "competitionAvailability",
    competitionsAvailabilityBatch: "competitionsAvailabilityBatch",
    competitionBuyingPower: "competitionBuyingPower",
    competitionsBuyingPowerBatch: "competitionsBuyingPowerBatch",
    competitions: "competitions",
    competitionDetail: "competitionDetail",
    competitionFeatured: "competitionFeatured",
    winners: "winners",
    winnersByCompetition: "winnersByCompetition",
    entries: "entries",
    stats: "stats",
  },
  invalidateUser: vi.fn(async () => {}),
  invalidateByChannelSafe: vi.fn(async () => {}),
}));

vi.mock("@oc/auth-admin/admin-auth", () => ({
  getAdminAuth: vi.fn(async () => ({
    api: { removeUser: mockRemoveUser },
  })),
}));

vi.mock("@oc/auth-admin/auth-mongo", () => ({
  getMongoDb: vi.fn(() => mockDb),
}));

async function loadDeleteUserAccount() {
  const mod = await import("@oc/auth-admin/user-deletion");
  return mod.deleteUserAccount;
}

describe("deleteUserAccount", () => {
  let deleteUserAccount: (userId: string, headers?: Headers) => Promise<void>;

  const mockProfile: Record<string, any> = {
    _id: mockUserId,
    email: "user@example.com",
    firstName: "John",
    lastName: "Doe",
    phone: "1234567890",
    dateOfBirth: new Date("1990-01-01"),
    addressLine1: "123 Main St",
    addressLine2: "Apt 4",
    city: "London",
    postcode: "SW1A 1AA",
    avatarUrl: "https://example.com/avatar.jpg",
    instagram: "@john",
    facebook: "john",
    twitter: "@john",
    tiktok: "@john",
    youtube: "john",
    websiteUrl: "https://john.com",
    isAdmin: true,
    isVerified: true,
    marketingConsent: true,
    referralCode: "ABC123",
    referredBy: "referrer-id",
    referredByCode: "REF123",
    referredBySignup: "signup-referrer-id",
    referredBySignupCode: "SIGNUP123",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset model calls
    for (const key of Object.keys(modelCalls)) {
      modelCalls[key] = [];
    }

    // Reset profile mock
    const models = await import("@oc/api-db/models");
    (models.Profile as any).findById = vi.fn(async () => ({
      ...mockProfile,
      save: vi.fn(async function (this: any) {
        modelCalls.profileSave = this;
        return this;
      }),
    }));

    vi.spyOn(mongoose, "startSession").mockImplementation(async () => sessionMocks as any);

    deleteUserAccount = await loadDeleteUserAccount();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("successfully deletes a user — all cleanup operations called", async () => {
    await deleteUserAccount(mockUserId);

    expect(sessionMocks.startTransaction).toHaveBeenCalled();
    expect(mockRemoveUser).toHaveBeenCalledWith({
      body: { userId: mockUserId },
      headers: undefined,
    });
    expect(mockDb.collection).toHaveBeenCalledWith("session");
    expect(mockDb.collection).toHaveBeenCalledWith("account");
    expect(modelCalls.cartDeleteOne).toHaveLength(1);
    expect(modelCalls.orderUpdateMany).toHaveLength(1);
    expect(modelCalls.orderItemUpdateMany).toHaveLength(1);
    expect(modelCalls.ticketUpdateMany).toHaveLength(1);
    expect(modelCalls.balanceDeleteOne).toHaveLength(1);
    expect(modelCalls.balanceTransactionUpdateMany).toHaveLength(1);
    expect(modelCalls.winnerUpdateMany).toHaveLength(1);
    expect(modelCalls.referralPurchaseUpdateMany).toHaveLength(2);
    expect(modelCalls.complianceAuditLogUpdateMany).toHaveLength(2);
    expect(modelCalls.instantPrizeWinUpdateMany).toHaveLength(1);
    expect(modelCalls.pushSubscriptionDeleteMany).toHaveLength(1);
    expect(modelCalls.selfExclusionDeleteMany).toHaveLength(1);
    expect(modelCalls.paymentAttemptUpdateMany).toHaveLength(1);
    expect(modelCalls.notificationDeleteMany).toHaveLength(1);
    expect(modelCalls.shopCartDeleteMany).toHaveLength(1);
    expect(modelCalls.shopOrderUpdateMany).toHaveLength(1);
    expect(sessionMocks.commitTransaction).toHaveBeenCalled();
    expect(sessionMocks.endSession).toHaveBeenCalled();
  });

  test("ticket update uses ownerId not userId", async () => {
    await deleteUserAccount(mockUserId);

    const call = modelCalls.ticketUpdateMany[0] as any;
    expect(call.filter).toEqual({ ownerId: mockUserId });
    expect(call.update).toEqual({ $set: { status: "released", ownerId: null } });
  });

  test("order item update is called with order IDs", async () => {
    await deleteUserAccount(mockUserId);

    const call = modelCalls.orderItemUpdateMany[0] as any;
    expect(call.filter).toEqual({ orderId: { $in: ["order-id-1", "order-id-2"] } });
    expect(call.update).toEqual({ $set: { deletedAt: expect.any(Date) } });
  });

  test("throws if profile not found", async () => {
    const models = await import("@oc/api-db/models");
    (models.Profile as any).findById = vi.fn(async () => null);

    await expect(deleteUserAccount(mockUserId)).rejects.toThrow("Profile not found");
    expect(mockRemoveUser).not.toHaveBeenCalled();
  });

  test("aborts transaction if auth.removeUser fails", async () => {
    mockRemoveUser.mockRejectedValueOnce(new Error("Auth failure"));

    await expect(deleteUserAccount(mockUserId)).rejects.toThrow("Auth failure");
    expect(sessionMocks.abortTransaction).toHaveBeenCalled();
    expect(sessionMocks.endSession).toHaveBeenCalled();
    expect(sessionMocks.commitTransaction).not.toHaveBeenCalled();
  });

  test("anonymizes profile fields correctly", async () => {
    await deleteUserAccount(mockUserId);

    const savedProfile = modelCalls.profileSave as any;
    expect(savedProfile).toBeDefined();
    expect(savedProfile.email).toBe(`deleted-${mockUserId.slice(0, 8)}@deleted.local`);
    expect(savedProfile.firstName).toBe("Deleted");
    expect(savedProfile.lastName).toBe("User");
    expect(savedProfile.phone).toBeUndefined();
    expect(savedProfile.isAdmin).toBe(false);
    expect(savedProfile.isVerified).toBe(false);
    expect(savedProfile.marketingConsent).toBe(false);
    expect(savedProfile.referralCode).toBeUndefined();
    expect(savedProfile.referredBy).toBeUndefined();
    expect(savedProfile.referredByCode).toBeUndefined();
    expect(savedProfile.referredBySignup).toBeUndefined();
    expect(savedProfile.referredBySignupCode).toBeUndefined();
  });

  test("winner displayName/testimonial/location/winnerPhotoUrl redacted", async () => {
    await deleteUserAccount(mockUserId);

    const call = modelCalls.winnerUpdateMany[0] as any;
    expect(call.update).toEqual({
      $set: {
        displayName: "Deleted User",
        testimonial: "",
        location: "",
        winnerPhotoUrl: "",
        deletedAt: expect.any(Date),
      },
    });
  });

  test("complianceAuditLog actorId nulled", async () => {
    await deleteUserAccount(mockUserId);

    const calls = modelCalls.complianceAuditLogUpdateMany as Array<{
      filter: Record<string, any>;
      update: Record<string, any>;
    }>;
    const targetUserCalls = calls.filter((c: any) => c.filter.targetUserId);
    const actorCalls = calls.filter((c: any) => c.filter.actorId);

    expect(targetUserCalls).toHaveLength(1);
    expect(targetUserCalls[0]?.update).toEqual({ $set: { targetUserId: null } });
    expect(actorCalls).toHaveLength(1);
    expect(actorCalls[0]?.update).toEqual({ $set: { actorId: null } });
  });

  test("pushSubscription deleteMany called", async () => {
    await deleteUserAccount(mockUserId);

    expect(modelCalls.pushSubscriptionDeleteMany[0]).toEqual({ userId: mockUserId });
  });

  test("selfExclusionOverrideRequest deleteMany called", async () => {
    await deleteUserAccount(mockUserId);

    expect(modelCalls.selfExclusionDeleteMany[0]).toEqual({ userId: mockUserId });
  });
});
