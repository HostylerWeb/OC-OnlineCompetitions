import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const __ctx = vi.hoisted(() => {
  const ids = {
    orderId: "650000000000000000000001",
    userId: "650000000000000000000002",
    ticketId1: "650000000000000000000003",
    ticketId2: "650000000000000000000004",
    grantedTicketId: "650000000000000000000005",
    cipId1: "650000000000000000000006",
    cipId2: "650000000000000000000007",
  };

  const state = {
    releaseByOrderIdCalls: [] as string[],
    revertGrantedSoldTicketsCalls: [] as Array<{
      grantedIds: string[];
      cipId: string;
    }>,
    instantPrizeWinDeleteFilter: undefined as unknown,
    cipUpdates: [] as Array<{ id: string; delta: number }>,
    ticketFindCalledBeforeRelease: false,
    releaseCalled: false,
    ticketFindEmpty: false,
  };

  function ticketQueryResult<T>(rows: T[]) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      session: () => chain,
      lean: async () => {
        if (!state.releaseCalled && rows.length > 0) {
          state.ticketFindCalledBeforeRelease = true;
        }
        return rows;
      },
    };
    return chain;
  }

  function queryResult<T>(rows: T[]) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      session: () => chain,
      lean: async () => rows,
    };
    return chain;
  }

  function deleteManyMock(onCall: (filter: unknown) => void) {
    return vi.fn((filter: unknown) => {
      onCall(filter);
      const query: Record<string, unknown> = {
        session: async () => ({}),
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve({}).then(onFulfilled, onRejected);
        },
      };
      return query;
    });
  }

  return { ids, state, ticketQueryResult, queryResult, deleteManyMock };
});

vi.mock("@oc/api-tickets/ticket-service", () => ({
  releaseByOrderId: vi.fn(async (oid: string) => {
    __ctx.state.releaseCalled = true;
    __ctx.state.releaseByOrderIdCalls.push(oid);
    return 2;
  }),
  revertGrantedSoldTickets: vi.fn(async (grantedIds: string[], cipId: string) => {
    __ctx.state.revertGrantedSoldTicketsCalls.push({ grantedIds, cipId });
    return grantedIds.length;
  }),
}));

vi.mock("@oc/api-tickets/promo-codes", () => ({
  releasePromoCodeUsage: vi.fn(async () => null),
}));

vi.mock("@oc/api-db/models", () => ({
  Order: {
    findById: vi.fn(() => ({
      select: () => ({ lean: async () => null }),
    })),
    findByIdAndUpdate: vi.fn(async () => ({})),
  },
  Ticket: {
    find: vi.fn(() =>
      __ctx.ticketQueryResult(
        __ctx.state.ticketFindEmpty
          ? []
          : [{ _id: __ctx.ids.ticketId1 }, { _id: __ctx.ids.ticketId2 }]
      )
    ),
  },
  InstantPrizeWin: {
    find: vi.fn(() =>
      __ctx.queryResult([
        {
          competitionInstantPrizeId: __ctx.ids.cipId1,
          grantedTicketIds: [],
        },
        {
          competitionInstantPrizeId: __ctx.ids.cipId1,
          grantedTicketIds: [__ctx.ids.grantedTicketId],
        },
        {
          competitionInstantPrizeId: __ctx.ids.cipId2,
          grantedTicketIds: [],
        },
      ])
    ),
    deleteMany: __ctx.deleteManyMock((filter) => {
      __ctx.state.instantPrizeWinDeleteFilter = filter;
    }),
  },
  CompetitionInstantPrize: {
    findByIdAndUpdate: vi.fn(
      async (id: Types.ObjectId, update: { $inc: { claimedCount: number } }) => {
        __ctx.state.cipUpdates.push({ id: id.toString(), delta: update.$inc.claimedCount });
        return {};
      }
    ),
  },
  OrderItem: {
    deleteMany: __ctx.deleteManyMock(() => {}),
  },
  Profile: {
    findByIdAndUpdate: vi.fn(async () => ({})),
  },
}));

describe("rollbackOrderFulfillment", () => {
  beforeEach(() => {
    __ctx.state.releaseByOrderIdCalls = [];
    __ctx.state.revertGrantedSoldTicketsCalls = [];
    __ctx.state.instantPrizeWinDeleteFilter = undefined;
    __ctx.state.cipUpdates = [];
    __ctx.state.ticketFindCalledBeforeRelease = false;
    __ctx.state.releaseCalled = false;
    __ctx.state.ticketFindEmpty = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("fetches tickets and deletes instant wins before releasing tickets", async () => {
    const { rollbackOrderFulfillment } = await import("./rollback-order-fulfillment");

    await rollbackOrderFulfillment({
      orderId: __ctx.ids.orderId,
      userId: __ctx.ids.userId,
      profileStatsDelta: { entries: 2, spent: 10 },
    });

    expect(__ctx.state.ticketFindCalledBeforeRelease).toBe(true);
    expect(__ctx.state.instantPrizeWinDeleteFilter).toEqual({
      entryId: { $in: [__ctx.ids.ticketId1, __ctx.ids.ticketId2] },
    });
    expect(__ctx.state.cipUpdates).toEqual([
      { id: __ctx.ids.cipId1.toString(), delta: -2 },
      { id: __ctx.ids.cipId2.toString(), delta: -1 },
    ]);
    expect(__ctx.state.revertGrantedSoldTicketsCalls).toEqual([
      { grantedIds: [__ctx.ids.grantedTicketId], cipId: __ctx.ids.cipId1 },
    ]);
    expect(__ctx.state.releaseByOrderIdCalls).toEqual([__ctx.ids.orderId]);
  });

  test("skips instant win cleanup when order has no tickets", async () => {
    __ctx.state.ticketFindEmpty = true;

    const { rollbackOrderFulfillment } = await import("./rollback-order-fulfillment");

    await rollbackOrderFulfillment({ orderId: __ctx.ids.orderId, userId: __ctx.ids.userId });

    expect(__ctx.state.releaseByOrderIdCalls).toEqual([__ctx.ids.orderId]);
    expect(__ctx.state.cipUpdates).toHaveLength(0);
  });

  test("skips all rollback operations when fulfillmentStatus is already rolled_back", async () => {
    const { Order: MockedOrder } = await import("@oc/api-db/models");
    vi.mocked(MockedOrder.findById).mockReturnValueOnce({
      select: () => ({ lean: async () => ({ fulfillmentStatus: "rolled_back" }) }),
    } as never);

    const { rollbackOrderFulfillment } = await import("./rollback-order-fulfillment");

    await rollbackOrderFulfillment({ orderId: __ctx.ids.orderId, userId: __ctx.ids.userId });

    expect(__ctx.state.releaseByOrderIdCalls).toHaveLength(0);
    expect(__ctx.state.cipUpdates).toHaveLength(0);
  });
});
