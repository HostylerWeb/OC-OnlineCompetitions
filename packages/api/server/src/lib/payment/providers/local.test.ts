import { Types } from "mongoose";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { localAdapter } from "./local";

const __mocks = vi.hoisted(() => ({
  __orderFindOneLean: vi.fn(),
  __orderFindOne: vi.fn(),
  __orderFindOneAndUpdate: vi.fn(),
  __orderFindByIdAndUpdate: vi.fn(),
  __orderCreate: vi.fn(),
}));

__mocks.__orderFindOne.mockImplementation(() => ({
  lean: __mocks.__orderFindOneLean,
}));

vi.mock("@oc/api-db/models", () => ({
  Order: {
    findOne: __mocks.__orderFindOne,
    findByIdAndUpdate: __mocks.__orderFindByIdAndUpdate,
    findById: vi.fn(() => ({
      lean: vi.fn(async () => null),
    })),
    create: __mocks.__orderCreate,
  },
  Competition: {
    findById: vi.fn(() => ({
      lean: vi.fn(async () => ({
        _id: new Types.ObjectId(),
        title: "Test Competition",
        ticketPrice: 5,
      })),
    })),
  },
  Balance: {
    findOneAndUpdate: vi.fn(async () => ({ available: 500 })),
  },
  BalanceTransaction: {
    findOneAndUpdate: vi.fn(async () => {}),
  },
}));

vi.mock("@oc/api-payment-local", () => ({
  LOCAL_CURRENCY: "GBP",
}));

vi.mock("@oc/api-payment-core", () => ({
  getItemsFromOrder: vi.fn(() => []),
  processBalanceTopUp: vi.fn(async () => {}),
  processOrderFulfillment: vi.fn(async () => ({
    totalQuantity: 0,
    allAssignedNumbers: [],
    emailItems: [],
  })),
}));

vi.mock("@oc/api-logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    error: () => {},
  }),
}));

describe("localAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mocks.__orderFindOneLean.mockResolvedValue(null);
    __mocks.__orderFindOneAndUpdate.mockResolvedValue(null);
    __mocks.__orderFindByIdAndUpdate.mockResolvedValue(null);
  });

  test("id is 'local'", async () => {
    expect(localAdapter.id).toBe("local");
  });

  test("testCredentials returns success", async () => {
    const result = await localAdapter.testCredentials();
    expect(result).toEqual({ success: true });
  });

  test("voidSession returns success", async () => {
    const result = await localAdapter.voidSession();
    expect(result).toEqual({ success: true });
  });

  test("handleWebhook returns the static LOCAL.ORDER.COMPLETED result", async () => {
    const result = await localAdapter.handleWebhook("ignored-body", "ignored-sig");
    expect(result).toEqual({
      eventType: "LOCAL.ORDER.COMPLETED",
      sessionId: "local",
      status: "completed",
    });
  });

  test("getSessionStatus returns failed when no order is found", async () => {
    __mocks.__orderFindOneLean.mockResolvedValue(null);

    const result = await localAdapter.getSessionStatus("local_missing");
    expect(result.status).toBe("failed");
    expect(result.orderId).toBeUndefined();
  });

  test("getSessionStatus echoes the order's status when order is found", async () => {
    const orderId = new Types.ObjectId();
    __mocks.__orderFindOneLean.mockResolvedValue({
      _id: orderId,
      status: "processing",
    });

    const result = await localAdapter.getSessionStatus("local_abc");
    expect(result.status).toBe("processing");
    expect(result.orderId).toBe(orderId.toString());
  });
});
