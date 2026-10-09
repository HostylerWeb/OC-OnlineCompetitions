import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const __mocks = vi.hoisted(() => ({
  assignmentsResult: [] as unknown,
  activeAwardsResult: [] as unknown,
  fireFindOneAndUpdateResult: null as unknown,
  fireFindByIdResult: null as unknown,
  assignmentFindByIdResult: null as unknown,
  awardFindByIdResult: null as unknown,
  ticketAggregateResult: [] as unknown,
  insertManyResult: [] as unknown,
  notifierResult: Promise.resolve() as Promise<void>,
}));

vi.mock("@oc/api-db/models", () => ({
  BonusAward: {
    find: vi.fn(() => ({
      session: vi.fn(() => ({
        lean: vi.fn(async () => __mocks.activeAwardsResult),
      })),
    })),
    findById: vi.fn(() => ({
      session: vi.fn(() => ({
        lean: vi.fn(async () => __mocks.awardFindByIdResult),
      })),
    })),
    updateOne: vi.fn(),
  },
  BonusAwardFire: {
    find: vi.fn(),
    findOne: vi.fn(() => {
      const result = __mocks.fireFindOneAndUpdateResult;
      return {
        session: vi.fn(() => ({
          lean: vi.fn(async () => result),
        })),
      };
    }),
    findOneAndUpdate: vi.fn(() => {
      const result = __mocks.fireFindOneAndUpdateResult;
      if (result && typeof result === "object") {
        return Object.assign(result, {
          lean: vi.fn(async () => result),
        });
      }
      return {
        lean: vi.fn(async () => null),
      };
    }),
    findById: vi.fn(() => ({
      session: vi.fn(() => ({
        lean: vi.fn(async () => __mocks.fireFindByIdResult),
      })),
    })),
    updateOne: vi.fn(),
  },
  BonusAwardWin: {
    insertMany: vi.fn(async () => __mocks.insertManyResult),
    updateMany: vi.fn(),
    distinct: vi.fn(() => ({
      session: vi.fn(async () => []),
    })),
  },
  CompetitionBonusAwardAssignment: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        sort: vi.fn(() => ({
          lean: vi.fn(async () => __mocks.assignmentsResult),
        })),
      })),
      session: vi.fn(() => ({
        lean: vi.fn(async () => __mocks.assignmentsResult),
      })),
    })),
    findById: vi.fn(() => ({
      session: vi.fn(() => ({
        lean: vi.fn(async () => __mocks.assignmentFindByIdResult),
      })),
    })),
    updateOne: vi.fn(),
  },
  Ticket: {
    aggregate: vi.fn(async () => __mocks.ticketAggregateResult),
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        sort: vi.fn(() => ({
          lean: vi.fn(async () => []),
        })),
      })),
    })),
  },
  Competition: {
    findById: vi.fn(),
  },
}));

const mockObjectId = () => new Types.ObjectId();

beforeEach(() => {
  __mocks.assignmentsResult = [];
  __mocks.activeAwardsResult = [];
  __mocks.fireFindOneAndUpdateResult = null;
  __mocks.fireFindByIdResult = null;
  __mocks.assignmentFindByIdResult = null;
  __mocks.awardFindByIdResult = null;
  __mocks.ticketAggregateResult = [];
  __mocks.insertManyResult = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("checkBonusAwardMilestones", () => {
  async function loadCheckMilestones() {
    const mod = await import("./bonus-award-draw");
    return mod.checkBonusAwardMilestones;
  }

  test("creates fires when threshold is reached for active awards", async () => {
    const compId = mockObjectId();
    const awardId = mockObjectId();
    const assignId = mockObjectId();
    const fireId = mockObjectId();

    __mocks.assignmentsResult = [
      {
        _id: assignId,
        competitionId: compId,
        bonusAwardId: awardId,
        milestonePct: 50,
        thresholdNumber: 500,
        quantity: 1,
        wonCount: 0,
        isArchived: false,
      },
    ];

    __mocks.activeAwardsResult = [{ _id: awardId }];

    __mocks.fireFindOneAndUpdateResult = {
      _id: fireId,
      assignmentId: assignId,
      bonusAwardId: awardId,
      competitionId: compId,
      status: "pending",
      firedAt: new Date(),
    };

    const check = await loadCheckMilestones();
    const firedIds = await check(compId, 500);

    expect(firedIds).toHaveLength(1);
    expect(firedIds[0]).toEqual(fireId);
  });

  test("does not fire for inactive awards", async () => {
    const compId = mockObjectId();
    const awardId = mockObjectId();
    const assignId = mockObjectId();

    __mocks.assignmentsResult = [
      {
        _id: assignId,
        competitionId: compId,
        bonusAwardId: awardId,
        milestonePct: 50,
        thresholdNumber: 500,
        quantity: 1,
        wonCount: 0,
        isArchived: false,
      },
    ];

    __mocks.activeAwardsResult = [];

    const check = await loadCheckMilestones();
    const firedIds = await check(compId, 500);

    expect(firedIds).toHaveLength(0);
  });

  test("skips assignments where threshold not reached", async () => {
    const compId = mockObjectId();

    __mocks.assignmentsResult = [];

    const check = await loadCheckMilestones();
    const firedIds = await check(compId, 100);

    expect(firedIds).toHaveLength(0);
  });

  test("skips already-fired assignments (non-pending fire)", async () => {
    const compId = mockObjectId();
    const awardId = mockObjectId();
    const assignId = mockObjectId();
    const fireId = mockObjectId();

    __mocks.assignmentsResult = [
      {
        _id: assignId,
        competitionId: compId,
        bonusAwardId: awardId,
        milestonePct: 50,
        thresholdNumber: 500,
        quantity: 1,
        wonCount: 0,
        isArchived: false,
      },
    ];

    __mocks.activeAwardsResult = [{ _id: awardId }];

    __mocks.fireFindOneAndUpdateResult = {
      _id: fireId,
      assignmentId: assignId,
      bonusAwardId: awardId,
      competitionId: compId,
      status: "drawn",
      firedAt: new Date(),
    };

    const check = await loadCheckMilestones();
    const firedIds = await check(compId, 500);

    expect(firedIds).toHaveLength(0);
  });
});

describe("pickPendingBonusAwardWinners", () => {
  async function loadPickWinners() {
    const mod = await import("./bonus-award-draw");
    return mod.pickPendingBonusAwardWinners;
  }

  test("draws winners from eligible tickets", async () => {
    const compId = mockObjectId();
    const awardId = mockObjectId();
    const assignId = mockObjectId();
    const fireId = mockObjectId();
    const userId = mockObjectId();
    const ticketId = mockObjectId();

    __mocks.fireFindOneAndUpdateResult = {
      _id: fireId,
      assignmentId: assignId,
      bonusAwardId: awardId,
      competitionId: compId,
      milestonePct: 50,
      status: "drawing",
      ticketsSoldAtFire: 500,
      firedAt: new Date(),
    };

    __mocks.assignmentFindByIdResult = {
      _id: assignId,
      competitionId: compId,
      bonusAwardId: awardId,
      milestonePct: 50,
      thresholdNumber: 500,
      quantity: 1,
      wonCount: 0,
    };

    __mocks.awardFindByIdResult = {
      _id: awardId,
      title: "Test Prize",
      value: 100,
    };

    __mocks.ticketAggregateResult = [{ _id: ticketId, number: 42, ownerId: userId }];

    __mocks.insertManyResult = [
      {
        _id: mockObjectId(),
        bonusAwardFireId: fireId,
        assignmentId: assignId,
        bonusAwardId: awardId,
        competitionId: compId,
        userId,
        entryId: ticketId,
        ticketNumber: 42,
        prizeTitle: "Test Prize",
        prizeValue: 100,
        wonAt: new Date(),
      },
    ];

    const notifier = vi.fn(async () => {});
    const pick = await loadPickWinners();
    await pick([fireId], notifier);

    expect(notifier).toHaveBeenCalledTimes(1);
  });

  test("skips non-pending fires", async () => {
    const fireId = mockObjectId();

    __mocks.fireFindOneAndUpdateResult = null;

    const notifier = vi.fn(async () => {});
    const pick = await loadPickWinners();
    await pick([fireId], notifier);

    expect(notifier).not.toHaveBeenCalled();
  });

  test("handles missing assignment gracefully", async () => {
    const compId = mockObjectId();
    const awardId = mockObjectId();
    const assignId = mockObjectId();
    const fireId = mockObjectId();

    __mocks.fireFindOneAndUpdateResult = {
      _id: fireId,
      assignmentId: assignId,
      bonusAwardId: awardId,
      competitionId: compId,
      status: "drawing",
    };

    __mocks.assignmentFindByIdResult = null;

    const notifier = vi.fn(async () => {});
    const pick = await loadPickWinners();
    await pick([fireId], notifier);

    expect(notifier).not.toHaveBeenCalled();
  });

  test("handles missing award gracefully", async () => {
    const compId = mockObjectId();
    const awardId = mockObjectId();
    const assignId = mockObjectId();
    const fireId = mockObjectId();

    __mocks.fireFindOneAndUpdateResult = {
      _id: fireId,
      assignmentId: assignId,
      bonusAwardId: awardId,
      competitionId: compId,
      status: "drawing",
    };

    __mocks.assignmentFindByIdResult = {
      _id: assignId,
      competitionId: compId,
      bonusAwardId: awardId,
      milestonePct: 50,
      thresholdNumber: 500,
      quantity: 1,
      wonCount: 0,
    };

    __mocks.awardFindByIdResult = null;

    const notifier = vi.fn(async () => {});
    const pick = await loadPickWinners();
    await pick([fireId], notifier);

    expect(notifier).not.toHaveBeenCalled();
  });

  test("marks fire as no_eligible_tickets when not enough candidates", async () => {
    const compId = mockObjectId();
    const awardId = mockObjectId();
    const assignId = mockObjectId();
    const fireId = mockObjectId();

    __mocks.fireFindOneAndUpdateResult = {
      _id: fireId,
      assignmentId: assignId,
      bonusAwardId: awardId,
      competitionId: compId,
      milestonePct: 50,
      status: "drawing",
      ticketsSoldAtFire: 500,
      firedAt: new Date(),
    };

    __mocks.assignmentFindByIdResult = {
      _id: assignId,
      competitionId: compId,
      bonusAwardId: awardId,
      milestonePct: 50,
      thresholdNumber: 500,
      quantity: 3,
      wonCount: 0,
    };

    __mocks.awardFindByIdResult = {
      _id: awardId,
      title: "Test Prize",
      value: 100,
    };

    __mocks.ticketAggregateResult = [{ _id: mockObjectId(), number: 1, ownerId: mockObjectId() }];

    const notifier = vi.fn(async () => {});
    const pick = await loadPickWinners();
    await pick([fireId], notifier);

    expect(notifier).not.toHaveBeenCalled();
  });
});
