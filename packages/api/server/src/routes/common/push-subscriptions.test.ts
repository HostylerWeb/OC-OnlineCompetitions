import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("web-push", () => ({
  default: {
    sendNotification: vi.fn(),
    setVapidDetails: vi.fn(),
  },
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("@oc/env/server", () => ({
  getEnv: vi.fn((key: string) => {
    if (key === "VAPID_PUBLIC_KEY") return "test-public-key";
    if (key === "VAPID_PRIVATE_KEY") return "test-private-key";
    return undefined;
  }),
}));

vi.mock("@oc/api-infra/db", () => ({
  default: vi.fn(),
}));

vi.mock("@oc/api-logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock("@oc/api-server/lib/push", () => ({
  sendPushNotification: vi.fn(),
}));

const mockUpdateMany = vi.fn();
const mockFindOneAndUpdate = vi.fn();
const mockDeleteMany = vi.fn();

vi.mock("@oc/api-db/models", () => ({
  PushSubscription: {
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
    deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    updateMany: (...args: unknown[]) => mockUpdateMany(...args),
  },
}));

import { Hono } from "hono";
import pushApp from "./push-subscriptions";

function createTestApp() {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("userId", "507f191e810c19729de860ea");
    c.set("requestId", "test-request-id");
    await next();
  });
  app.route("/", pushApp);
  return app;
}

describe("push-subscriptions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /preferences", () => {
    test("saves preferences to all active subscriptions for the user", async () => {
      mockUpdateMany.mockResolvedValue({ modifiedCount: 2 });

      const app = createTestApp();
      const res = await app.request("/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketing: false,
          system: true,
          draw_result: true,
          promotional: false,
          reminder: true,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.success).toBe(true);
      expect(body.data.preferences).toEqual({
        marketing: false,
        system: true,
        draw_result: true,
        promotional: false,
        reminder: true,
      });

      expect(mockUpdateMany).toHaveBeenCalledWith(
        { userId: "507f191e810c19729de860ea", active: true },
        {
          $set: {
            "preferences.marketing": false,
            "preferences.system": true,
            "preferences.draw_result": true,
            "preferences.promotional": false,
            "preferences.reminder": true,
          },
        }
      );
    });

    test("returns 401 when userId is missing", async () => {
      const app = new Hono();
      app.use("*", async (c, next) => {
        c.set("requestId", "test-request-id");
        await next();
      });
      app.route("/", pushApp);

      const res = await app.request("/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketing: false }),
      });

      expect(res.status).toBe(401);
    });

    test("accepts partial preferences update", async () => {
      mockUpdateMany.mockResolvedValue({ modifiedCount: 1 });

      const app = createTestApp();
      const res = await app.request("/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketing: false }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateMany).toHaveBeenCalledWith(
        { userId: "507f191e810c19729de860ea", active: true },
        {
          $set: { "preferences.marketing": false },
        }
      );
    });

    test("returns success with no DB write when body is empty", async () => {
      const app = createTestApp();
      const res = await app.request("/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("POST /subscribe", () => {
    test("creates or updates a push subscription", async () => {
      mockFindOneAndUpdate.mockResolvedValue({ _id: "sub-1" });

      const app = createTestApp();
      const res = await app.request("/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://example.com/push",
          keys: { p256dh: "key123", auth: "auth456" },
        }),
      });

      expect(res.status).toBe(201);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { endpoint: "https://example.com/push" },
        {
          endpoint: "https://example.com/push",
          keys: { p256dh: "key123", auth: "auth456" },
          active: true,
          userId: "507f191e810c19729de860ea",
          userAgent: undefined,
        },
        { upsert: true, new: true }
      );
    });
  });

  describe("DELETE /unsubscribe", () => {
    test("deletes all subscriptions for the user", async () => {
      mockDeleteMany.mockResolvedValue({ deletedCount: 2 });

      const app = createTestApp();
      const res = await app.request("/unsubscribe", { method: "DELETE" });

      expect(res.status).toBe(200);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        userId: "507f191e810c19729de860ea",
      });
    });
  });
});
