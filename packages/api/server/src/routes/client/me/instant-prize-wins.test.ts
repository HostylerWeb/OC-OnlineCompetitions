import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import instantPrizeWinsApp, {
  DEFAULT_INSTANT_WIN_LIMIT,
  MAX_INSTANT_WIN_IDS,
  parseInstantPrizeWinIds,
} from "./instant-prize-wins";

const __mock = vi.hoisted(() => ({
  fetchAndMapWins: vi.fn(),
  authUserId: "",
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
  auth: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set("userId", __mock.authUserId);
    await next();
  },
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock("./instant-prize-wins.mapper", () => ({
  fetchAndMapWins: (...args: unknown[]) => __mock.fetchAndMapWins(...args),
}));

vi.mock("@oc/api-db/models", () => ({
  InstantPrizeWin: { countDocuments: vi.fn(async () => 0) },
}));

describe("parseInstantPrizeWinIds", () => {
  test("dedupes and trims ids", () => {
    const id1 = new Types.ObjectId().toString();
    const id2 = new Types.ObjectId().toString();

    expect(parseInstantPrizeWinIds(` ${id1},${id2},${id1} `)).toEqual({
      ok: true,
      ids: [id1, id2],
    });
  });

  test("rejects more than max ids", () => {
    const ids = Array.from({ length: MAX_INSTANT_WIN_IDS + 1 }, () =>
      new Types.ObjectId().toString()
    ).join(",");

    expect(parseInstantPrizeWinIds(ids)).toEqual({
      ok: false,
      message: `ids query parameter accepts up to ${MAX_INSTANT_WIN_IDS} ids`,
    });
  });
});

describe("GET /me/instant-prize-wins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("applies default limit and filters by ids query param", async () => {
    __mock.authUserId = new Types.ObjectId().toString();
    const winId = new Types.ObjectId().toString();
    __mock.fetchAndMapWins = vi.fn(
      async (filter: Record<string, unknown>, _options?: { skip?: number; limit?: number }) => {
        expect(filter.userId?.toString()).toBe(__mock.authUserId);
        expect(filter._id).toEqual({ $in: [new Types.ObjectId(winId)] });
        // When ids are present, options are not passed (no pagination)
        return [{ _id: winId }];
      }
    );

    const response = await instantPrizeWinsApp.request(`http://localhost/?ids=${winId}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(__mock.fetchAndMapWins).toHaveBeenCalledTimes(1);
    expect(body.data).toEqual([{ _id: winId }]);
  });

  test("applies DEFAULT_INSTANT_WIN_LIMIT when no pagination or ids are provided", async () => {
    __mock.authUserId = new Types.ObjectId().toString();
    __mock.fetchAndMapWins = vi.fn(
      async (_filter: unknown, options?: { skip?: number; limit?: number }) => {
        expect(options).toEqual({ skip: 0, limit: DEFAULT_INSTANT_WIN_LIMIT });
        return [{ _id: "win-1" }];
      }
    );

    const response = await instantPrizeWinsApp.request("http://localhost/");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(__mock.fetchAndMapWins).toHaveBeenCalledTimes(1);
    expect(body.data).toEqual([{ _id: "win-1" }]);
  });
});
