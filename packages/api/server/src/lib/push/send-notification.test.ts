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

const mockFind = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
const mockFindByIdAndDelete = vi.fn();

vi.mock("@oc/api-db/models", () => ({
  PushSubscription: {
    find: (...args: unknown[]) => mockFind(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockFindByIdAndUpdate(...args),
    findByIdAndDelete: (...args: unknown[]) => mockFindByIdAndDelete(...args),
  },
}));

import webpush from "web-push";
import { sendPushNotification } from "./send-notification";

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    _id: overrides._id ?? "sub-1",
    endpoint: "https://example.com/push",
    keys: { p256dh: "key", auth: "auth" },
    active: true,
    preferences: {
      marketing: true,
      system: true,
      draw_result: true,
      promotional: true,
      reminder: true,
    },
    ...overrides,
  };
}

describe("sendPushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("filters subscriptions by type preferences", async () => {
    const subs = [
      makeSub({ _id: "sub-1", preferences: { ...makeSub().preferences, marketing: true } }),
      makeSub({ _id: "sub-2", preferences: { ...makeSub().preferences, marketing: false } }),
      makeSub({ _id: "sub-3", preferences: undefined }),
    ];

    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue(subs),
    });

    vi.mocked(webpush.sendNotification).mockResolvedValue(undefined as never);

    const result = await sendPushNotification(
      { title: "Test", body: "Test body", type: "marketing" },
      {}
    );

    expect(mockFind).toHaveBeenCalledWith({ active: true });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(result.sentCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.totalTargeted).toBe(2);
  });

  test("filters subscriptions by userId", async () => {
    const subs = [makeSub({ _id: "sub-1" }), makeSub({ _id: "sub-2" })];

    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue(subs),
    });

    vi.mocked(webpush.sendNotification).mockResolvedValue(undefined as never);

    const result = await sendPushNotification(
      { title: "Test", body: "Test body" },
      { userId: "507f191e810c19729de860ea" }
    );

    expect(mockFind).toHaveBeenCalled();
    expect(result.sentCount).toBe(2);
  });

  test("handles 410 gone by deactivating subscription", async () => {
    const subs = [makeSub({ _id: "sub-1" }), makeSub({ _id: "sub-2" })];

    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue(subs),
    });

    mockFindByIdAndDelete.mockResolvedValue(undefined);

    const error410 = new Error("gone");
    (error410 as Error & { statusCode?: number }).statusCode = 410;

    vi.mocked(webpush.sendNotification)
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(error410);

    const result = await sendPushNotification({ title: "Test", body: "Test body" }, {});

    expect(result.sentCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(mockFindByIdAndDelete).toHaveBeenCalledWith("sub-2");
  });

  test("sends to all active subscriptions when no type filter and no userId", async () => {
    const subs = [makeSub({ _id: "sub-1" }), makeSub({ _id: "sub-2" }), makeSub({ _id: "sub-3" })];

    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue(subs),
    });

    vi.mocked(webpush.sendNotification).mockResolvedValue(undefined as never);

    const result = await sendPushNotification({ title: "Test", body: "Test body" }, {});

    expect(result.totalTargeted).toBe(3);
    expect(result.sentCount).toBe(3);
  });

  test("returns zero when no active subscriptions match", async () => {
    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });

    const result = await sendPushNotification({ title: "Test", body: "Test body" }, {});

    expect(result.totalTargeted).toBe(0);
    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });
});
