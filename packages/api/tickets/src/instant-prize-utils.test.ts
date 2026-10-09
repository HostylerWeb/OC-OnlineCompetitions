import { Types } from "mongoose";
import { afterEach, describe, expect, test, vi } from "vitest";

const mockAggregate = vi.hoisted(() => vi.fn());

vi.mock("@oc/api-db/models", () => ({
  Ticket: {
    aggregate: mockAggregate,
  },
  CompetitionInstantPrize: {},
  InstantPrizeWin: {},
}));

vi.mock("@oc/api-tickets/ticket-service", () => ({
  buildExcludeSetForInstantPrizes: vi.fn(async () => new Set<number>()),
}));

import { generateWinningEntryNumbers } from "@oc/api-tickets/instant-prize-utils";

describe("generateWinningEntryNumbers", () => {
  const competitionId = new Types.ObjectId();

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns unique numbers when no duplicates", async () => {
    mockAggregate.mockResolvedValue([{ number: 1 }, { number: 2 }, { number: 3 }]);

    const result = await generateWinningEntryNumbers(competitionId, 3, 100);
    expect(result).toEqual([1, 2, 3]);
  });

  test("retries when duplicates are found", async () => {
    mockAggregate
      .mockResolvedValueOnce([{ number: 1 }, { number: 1 }, { number: 2 }])
      .mockResolvedValueOnce([{ number: 1 }, { number: 2 }, { number: 3 }]);

    const result = await generateWinningEntryNumbers(competitionId, 3, 100);
    expect(result).toEqual([1, 2, 3]);
    expect(mockAggregate).toHaveBeenCalledTimes(2);
  });

  test("throws after exhausting retries with persistent duplicates", async () => {
    mockAggregate.mockResolvedValue([{ number: 1 }, { number: 1 }, { number: 2 }]);

    await expect(generateWinningEntryNumbers(competitionId, 3, 100)).rejects.toThrow(
      /Failed to generate/
    );
    expect(mockAggregate).toHaveBeenCalledTimes(3);
  });

  test("throws when not enough candidates", async () => {
    mockAggregate.mockResolvedValue([{ number: 1 }]);

    await expect(generateWinningEntryNumbers(competitionId, 3, 100)).rejects.toThrow(
      /Not enough available tickets/
    );
  });
});
