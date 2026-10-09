import { beforeEach, describe, expect, test, vi } from "vitest";

const mockGetRedis = vi.hoisted(() => vi.fn());

vi.mock("@oc/api-infra/cache/redis", () => ({
  getRedis: mockGetRedis,
}));

import { paymentRateLimit } from "./rate-limit";

function mockContext(overrides: Record<string, unknown> = {}) {
  return {
    req: {
      url: "http://localhost/api/payments/session",
      method: "POST",
      header: vi.fn((name: string) => {
        if (name === "x-forwarded-for") return "1.2.3.4";
        return undefined;
      }),
      ...((overrides.req as Record<string, unknown>) ?? {}),
    },
    get: vi.fn((key: string) => {
      if (key === "userId") return "user_123";
      return undefined;
    }),
    json: vi.fn().mockReturnValue({}),
    ...overrides,
  } as any;
}

describe("paymentRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("allows requests within limit", async () => {
    const mockRedis = { incr: vi.fn(), pexpire: vi.fn() };
    mockGetRedis.mockResolvedValue(mockRedis);
    mockRedis.incr.mockResolvedValue(1);

    const c = mockContext();
    const next = vi.fn();
    const handler = paymentRateLimit();

    await handler(c, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(c.json).not.toHaveBeenCalled();
  });

  test("returns 429 when user count exceeds limit", async () => {
    const mockRedis = { incr: vi.fn(), pexpire: vi.fn() };
    mockGetRedis.mockResolvedValue(mockRedis);
    mockRedis.incr.mockResolvedValue(11);

    const c = mockContext();
    const next = vi.fn();
    const handler = paymentRateLimit();

    await handler(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "RATE_LIMITED" }),
      }),
      429
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("per-IP limiting works when no userId", async () => {
    const mockRedis = { incr: vi.fn(), pexpire: vi.fn() };
    mockGetRedis.mockResolvedValue(mockRedis);
    mockRedis.incr.mockResolvedValue(21);

    const c = mockContext({
      get: vi.fn(() => undefined),
    });
    const next = vi.fn();
    const handler = paymentRateLimit();

    await handler(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "RATE_LIMITED" }),
      }),
      429
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("non-payment routes pass through", async () => {
    const c = mockContext({
      req: { url: "http://localhost/api/auth/login", method: "POST" },
    });
    const next = vi.fn();
    const handler = paymentRateLimit();

    await handler(c, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("non-POST cart routes pass through", async () => {
    const c = mockContext({
      req: { url: "http://localhost/api/cart/discount", method: "GET" },
    });
    const next = vi.fn();
    const handler = paymentRateLimit();

    await handler(c, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("when Redis is unavailable, pass through", async () => {
    mockGetRedis.mockResolvedValue(null);

    const c = mockContext();
    const next = vi.fn();
    const handler = paymentRateLimit();

    await handler(c, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("sets pexpire on first request", async () => {
    const mockRedis = { incr: vi.fn(), pexpire: vi.fn() };
    mockGetRedis.mockResolvedValue(mockRedis);
    mockRedis.incr.mockResolvedValue(1);

    const c = mockContext();
    const next = vi.fn();
    const handler = paymentRateLimit();

    await handler(c, next);

    expect(mockRedis.pexpire).toHaveBeenCalledWith(expect.any(String), 60_000);
  });

  test("does not set pexpire on subsequent requests", async () => {
    const mockRedis = { incr: vi.fn(), pexpire: vi.fn() };
    mockGetRedis.mockResolvedValue(mockRedis);
    mockRedis.incr.mockResolvedValue(5);

    const c = mockContext();
    const next = vi.fn();
    const handler = paymentRateLimit();

    await handler(c, next);

    expect(mockRedis.pexpire).not.toHaveBeenCalled();
  });
});
