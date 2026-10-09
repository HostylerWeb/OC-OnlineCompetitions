import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import bulkActionsApp from "../bulk-actions";

const __mock = vi.hoisted(() => ({
  userId: "",
  deleteUserAccount: vi.fn(),
  profileUpdateMany: vi.fn(),
}));

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
  requireAdmin: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set("userId", __mock.userId);
    await next();
  },
}));

vi.mock("@oc/auth-admin/user-deletion", () => ({
  deleteUserAccount: (...args: unknown[]) => __mock.deleteUserAccount(...args),
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    updateMany: (...args: unknown[]) => __mock.profileUpdateMany(...args),
  },
  Order: {
    softDelete: vi.fn(async () => ({})),
  },
  Winner: {
    softDelete: vi.fn(async () => ({})),
    updateMany: vi.fn(() => ({
      session: vi.fn(() => ({
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve({ modifiedCount: 2 }).then(resolve),
      })),
    })),
  },
  InstantPrizeWin: {
    softDelete: vi.fn(async () => ({})),
    updateMany: vi.fn(() => ({
      session: vi.fn(() => ({
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve({ modifiedCount: 2 }).then(resolve),
      })),
    })),
  },
  PromoCode: {
    softDelete: vi.fn(async () => ({})),
    updateMany: vi.fn(() => ({
      session: vi.fn(() => ({
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve({ modifiedCount: 2 }).then(resolve),
      })),
    })),
  },
}));

describe("admin bulk actions POST /users", () => {
  const userId1 = new Types.ObjectId().toString();
  const userId2 = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
    __mock.userId = new Types.ObjectId().toString();
    __mock.deleteUserAccount = vi.fn(async () => {});
    __mock.profileUpdateMany = vi.fn(async () => ({ modifiedCount: 2 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("all delete actions succeed — correct count", async () => {
    __mock.deleteUserAccount = vi.fn(async () => {});

    const res = await bulkActionsApp.request("http://localhost/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [userId1, userId2], action: "delete" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.count).toBe(2);
    expect(body.data.failed).toBe(0);
    expect(body.data.errors).toHaveLength(0);
    expect(__mock.deleteUserAccount).toHaveBeenCalledTimes(2);
  });

  test("mixed success/failure returns correct counts", async () => {
    __mock.deleteUserAccount = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Profile not found"));

    const res = await bulkActionsApp.request("http://localhost/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [userId1, userId2], action: "delete" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.count).toBe(1);
    expect(body.data.failed).toBe(1);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0]).toBe("Profile not found");
  });

  test("invalid action returns validation error", async () => {
    const res = await bulkActionsApp.request("http://localhost/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [userId1], action: "invalid-action" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("verify action calls Profile.updateMany", async () => {
    const res = await bulkActionsApp.request("http://localhost/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [userId1, userId2], action: "verify" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.count).toBe(2);
    expect(__mock.profileUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: [userId1, userId2] } },
      { isVerified: true }
    );
  });
});
