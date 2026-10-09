import { beforeEach, describe, expect, test, vi } from "vitest";

const mockError = vi.hoisted(() => vi.fn());

vi.mock("@oc/api-infra/response", () => ({
  error: mockError,
}));

vi.mock("@oc/api-compliance/compliance-user-service", () => ({
  reconcileSelfExclusionOnRead: vi.fn(async () => {}),
  resolveEffectiveSelfExclusion: vi.fn(() => ({ effective: false })),
}));

vi.mock("@oc/api-compliance/settings", () => ({
  getComplianceSettings: vi.fn(async () => ({})),
  isComplianceEnforcementActive: vi.fn(() => false),
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {},
}));

vi.mock("@oc/api-infra/error-codes", () => ({
  ErrorCodes: {
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
  },
}));

import { requireManager, requireStaff } from "./auth";

function makeContext(role: string | undefined, method = "GET") {
  const resolveSession = vi.fn(async () => {});
  return {
    ctx: {
      req: {
        method,
        path: "/api/admin/foo",
        raw: { headers: {} },
        header: vi.fn(),
      },
      get: vi.fn((key: string) => {
        if (key === "user") return role ? { id: "u1", role } : null;
        if (key === "session") return { createdAt: new Date() };
        if (key === "isAdmin") return role === "admin" || role === "manager";
        if (key === "requestId") return "req1";
        if (key === "userId") return "u1";
        return undefined;
      }),
      set: vi.fn(),
      setEmptySession: vi.fn(),
    } as any,
    resolveSession,
  };
}

describe("requireStaff", () => {
  beforeEach(() => vi.clearAllMocks());

  test("allows admin", async () => {
    const { ctx } = makeContext("admin");
    const next = vi.fn();
    await requireStaff(ctx, next as any);
    expect(next).toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  test("allows manager", async () => {
    const { ctx } = makeContext("manager");
    const next = vi.fn();
    await requireStaff(ctx, next as any);
    expect(next).toHaveBeenCalled();
  });

  test("rejects user role", async () => {
    const { ctx } = makeContext("user");
    const next = vi.fn();
    await requireStaff(ctx, next as any);
    expect(next).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith(ctx, "FORBIDDEN", expect.any(String), 403);
  });

  test("rejects unauthenticated", async () => {
    const { ctx } = makeContext(undefined);
    const next = vi.fn();
    await requireStaff(ctx, next as any);
    expect(next).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith(ctx, "UNAUTHORIZED", expect.any(String), 401);
  });

  test("passes OPTIONS through", async () => {
    const { ctx } = makeContext("user", "OPTIONS");
    const next = vi.fn();
    await requireStaff(ctx, next as any);
    expect(next).toHaveBeenCalled();
  });
});

describe("requireManager", () => {
  beforeEach(() => vi.clearAllMocks());

  test("allows admin to write", async () => {
    const { ctx } = makeContext("admin", "POST");
    const next = vi.fn();
    await requireManager(ctx, next as any);
    expect(next).toHaveBeenCalled();
  });

  test("allows manager GET", async () => {
    const { ctx } = makeContext("manager", "GET");
    const next = vi.fn();
    await requireManager(ctx, next as any);
    expect(next).toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  test("blocks manager POST (read-only)", async () => {
    const { ctx } = makeContext("manager", "POST");
    const next = vi.fn();
    await requireManager(ctx, next as any);
    expect(next).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith(ctx, "FORBIDDEN", expect.any(String), 403);
  });

  test("blocks manager PUT (read-only)", async () => {
    const { ctx } = makeContext("manager", "PUT");
    const next = vi.fn();
    await requireManager(ctx, next as any);
    expect(next).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalled();
  });

  test("allows manager OPTIONS", async () => {
    const { ctx } = makeContext("manager", "OPTIONS");
    const next = vi.fn();
    await requireManager(ctx, next as any);
    expect(next).toHaveBeenCalled();
  });

  test("rejects non-staff", async () => {
    const { ctx } = makeContext("user", "GET");
    const next = vi.fn();
    await requireManager(ctx, next as any);
    expect(next).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith(ctx, "FORBIDDEN", expect.any(String), 403);
  });
});
