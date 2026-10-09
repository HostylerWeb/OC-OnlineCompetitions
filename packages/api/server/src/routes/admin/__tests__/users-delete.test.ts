import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import usersApp from "../users";

const __mock = vi.hoisted(() => ({
  userId: "",
  deleteUserAccount: vi.fn(),
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
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireManager: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock("@oc/auth-admin/user-deletion", () => ({
  deleteUserAccount: (...args: unknown[]) => __mock.deleteUserAccount(...args),
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: vi.fn(() => null),
  },
  OrderItem: {
    find: vi.fn(() => ({
      select: () => ({
        lean: async () => [],
      }),
    })),
  },
  ReferralPurchase: {
    find: vi.fn(() => ({
      select: () => ({
        populate: () => ({
          lean: async () => [],
        }),
      }),
    })),
  },
  ReferralSettings: {
    findById: vi.fn(() => ({
      lean: async () => null,
    })),
  },
  ComplianceAuditLog: {
    create: vi.fn(async () => ({})),
  },
}));

describe("admin users DELETE /:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mock.userId = new Types.ObjectId().toString();
    __mock.deleteUserAccount = vi.fn(async () => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("valid ObjectId + existing profile returns 200", async () => {
    const models = await import("@oc/api-db/models");
    (models.Profile as any).findById = vi.fn(() => ({
      lean: async () => ({ _id: __mock.userId, email: "user@test.com" }),
    }));

    const res = await usersApp.request(`http://localhost/${__mock.userId}`, {
      method: "DELETE",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(__mock.deleteUserAccount).toHaveBeenCalledTimes(1);
  });

  test("invalid ObjectId returns 400", async () => {
    const res = await usersApp.request("http://localhost/invalid-id", {
      method: "DELETE",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid profile ID format");
    expect(__mock.deleteUserAccount).not.toHaveBeenCalled();
  });

  test("profile not found returns 404", async () => {
    const models = await import("@oc/api-db/models");
    (models.Profile as any).findById = vi.fn(() => ({
      lean: async () => null,
    }));

    const res = await usersApp.request(`http://localhost/${__mock.userId}`, {
      method: "DELETE",
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Profile not found");
    expect(__mock.deleteUserAccount).not.toHaveBeenCalled();
  });

  test("deleteUserAccount throws returns 500", async () => {
    const models = await import("@oc/api-db/models");
    (models.Profile as any).findById = vi.fn(() => ({
      lean: async () => ({ _id: __mock.userId, email: "user@test.com" }),
    }));
    __mock.deleteUserAccount = vi.fn(async () => {
      throw new Error("Unexpected error");
    });

    const res = await usersApp.request(`http://localhost/${__mock.userId}`, {
      method: "DELETE",
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
