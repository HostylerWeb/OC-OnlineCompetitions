import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import userComplianceApp from "./user-compliance";
import usersApp from "./users";

const __mock = vi.hoisted(() => ({
  userId: "000000000000000000000001",
  actorId: "000000000000000000000002",
  mockComplianceState: null as unknown,
  applySpendLimit: vi.fn(),
  getRequiredUserId: () => "test-user-id" as string,
  profileFindByIdAndUpdateImpl: vi.fn(() => ({ lean: async () => ({}) })),
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
  getRequiredUserId: (...args: unknown[]) =>
    (__mock.getRequiredUserId as (...a: unknown[]) => unknown)(...args),
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

vi.mock("@oc/api-compliance/compliance-user-service", () => ({
  buildAdminUserComplianceState: vi.fn(async () => __mock.mockComplianceState),
  applySpendLimit: (...args: unknown[]) => __mock.applySpendLimit(...args),
  cancelPendingSpendIncrease: vi.fn(async () => ({})),
  applySelfExclusion: vi.fn(async () => ({ selfExcludedUntil: null })),
  liftSelfExclusion: vi.fn(async () => ({})),
  setAgeVerified: vi.fn(async () => ({})),
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: vi.fn(() => ({
      select: () => ({
        lean: async () => ({ _id: __mock.userId }),
      }),
    })),
    findByIdAndUpdate: (...args: unknown[]) => __mock.profileFindByIdAndUpdateImpl(...args),
  },
}));

const userId = new Types.ObjectId().toString();

describe("admin user compliance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mock.mockComplianceState = {
      userId,
      email: "user@example.com",
      effectiveSelfExcluded: false,
      selfExcluded: false,
    };
    __mock.applySpendLimit = vi.fn(async () => ({}));
    __mock.getRequiredUserId = () => __mock.actorId;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("GET /:id/compliance returns admin compliance state", async () => {
    const response = await userComplianceApp.request(`http://localhost/${userId}/compliance`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.userId).toBe(userId);
  });

  test("PATCH /:id/compliance rejects invalid action payload", async () => {
    const response = await userComplianceApp.request(`http://localhost/${userId}/compliance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set_spend_limit", reason: "short" }),
    });

    expect(response.status).toBe(400);
  });

  test("PATCH /:id/compliance applies spend limit override", async () => {
    __mock.applySpendLimit = vi.fn(async () => ({}));

    const response = await userComplianceApp.request(`http://localhost/${userId}/compliance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "set_spend_limit",
        reason: "Support request to cap spend immediately",
        monthlySpendLimit: 100,
        bypassCooldown: true,
      }),
    });

    expect(response.status).toBe(200);
    expect(__mock.applySpendLimit).toHaveBeenCalled();
  });

  test("blocks admin from overriding own compliance", async () => {
    __mock.getRequiredUserId = () => userId;

    const response = await userComplianceApp.request(`http://localhost/${userId}/compliance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "set_spend_limit",
        reason: "Attempting self override should fail",
        monthlySpendLimit: 50,
      }),
    });

    expect(response.status).toBe(403);
  });
});

describe("admin users PUT hardening", () => {
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("rejects compliance field mutation via generic PUT", async () => {
    __mock.profileFindByIdAndUpdateImpl = vi.fn(() => ({ lean: async () => ({ _id: userId }) }));

    const response = await usersApp.request(`http://localhost/${userId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ monthlySpendLimit: 500 }),
    });

    expect(response.status).toBe(400);
    expect(__mock.profileFindByIdAndUpdateImpl).not.toHaveBeenCalled();
  });
});
