import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildSoldEntriesFilter, clearMyEntriesCaches, getMyEntriesStats } from "./entries";

const __mock = vi.hoisted(() => ({
  countDocuments: vi.fn(),
  distinct: vi.fn(),
}));

vi.mock("@oc/api-db/models", () => ({
  Ticket: {
    countDocuments: (...args: unknown[]) => __mock.countDocuments(...args),
    distinct: (...args: unknown[]) => __mock.distinct(...args),
    aggregate: vi.fn(async () => []),
  },
  Winner: {
    find: vi.fn(() => ({
      select: () => ({
        limit: () => ({
          maxTimeMS: () => ({
            lean: async () => [{ entryId: new Types.ObjectId("6a1fd27e887c10350d513bf0") }],
          }),
        }),
      }),
    })),
  },
  Competition: {
    find: vi.fn(() => ({
      select: () => ({
        maxTimeMS: () => ({
          lean: async () => [
            { _id: new Types.ObjectId("6a1fd27e887c10350d513bec") },
            { _id: new Types.ObjectId("6a1fd27e887c10350d513bed") },
          ],
        }),
      }),
    })),
  },
}));

describe("entries route filters", () => {
  test("builds sold-only user filter for /api/me/entries", () => {
    const userId = new Types.ObjectId().toString();
    const filter = buildSoldEntriesFilter(userId);

    expect(filter.ownerId.toString()).toBe(userId);
    expect(filter.status).toBe("sold");
    expect(filter.competitionId).toBeUndefined();
  });

  test("builds sold-only user filter scoped to competition", () => {
    const userId = new Types.ObjectId().toString();
    const competitionId = new Types.ObjectId().toString();
    const filter = buildSoldEntriesFilter(userId, competitionId);

    expect(filter.ownerId.toString()).toBe(userId);
    expect(filter.competitionId?.toString()).toBe(competitionId);
    expect(filter.status).toBe("sold");
  });
});

describe("getMyEntriesStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMyEntriesCaches();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearMyEntriesCaches();
  });

  const ENTRY_ID = new Types.ObjectId("6a1fd27e887c10350d513bf0");
  const ACTIVE_COMP_ID = new Types.ObjectId("6a1fd27e887c10350d513bec");
  const ENDED_COMP_ID = new Types.ObjectId("6a1fd27e887c10350d513bed");

  test("derives counts from distinct competitions without per-ticket lookup", async () => {
    const userId = new Types.ObjectId().toString();

    __mock.countDocuments = vi.fn((filter: Record<string, unknown>) => ({
      maxTimeMS: () => {
        if (filter.competitionId) {
          return Promise.resolve(800);
        }
        if (filter.instantPrizeWinId) {
          return Promise.resolve(25);
        }
        return Promise.resolve(1000);
      },
    }));

    __mock.distinct = vi.fn(
      async (_field: string, _filter: unknown, options?: { maxTimeMS?: number }) => {
        expect(options?.maxTimeMS).toBe(15_000);
        return [ACTIVE_COMP_ID, ENDED_COMP_ID];
      }
    );

    const stats = await getMyEntriesStats(userId);

    expect(stats).toEqual({
      totalTickets: 1000,
      activeTickets: 800,
      competitionCount: 2,
      prizeWins: 25,
      drawWinnerEntryIds: [ENTRY_ID.toString()],
      byCompetition: [],
    });
    expect(__mock.distinct).toHaveBeenCalledTimes(1);
    expect(__mock.countDocuments).toHaveBeenCalledTimes(3);
  });

  test("returns cached stats without re-querying Mongo", async () => {
    const userId = new Types.ObjectId().toString();

    __mock.countDocuments = vi.fn(() => ({
      maxTimeMS: () => Promise.resolve(10),
    }));

    __mock.distinct = vi.fn(async () => [ACTIVE_COMP_ID]);

    await getMyEntriesStats(userId);
    await getMyEntriesStats(userId);

    expect(__mock.distinct).toHaveBeenCalledTimes(1);
    expect(__mock.countDocuments).toHaveBeenCalledTimes(3);
  });
});
