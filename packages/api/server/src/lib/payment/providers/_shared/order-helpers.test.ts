import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getOrderBySessionId, markOrderFailed } from "./order-helpers";

const __mocks = vi.hoisted(() => ({
  findByIdAndUpdate: vi.fn(async () => null),
  releasePromoCodeUsage: vi.fn(async () => null),
  releaseReservedSpend: vi.fn(async () => true),
  findOneResult: null as Record<string, unknown> | null,
  findOne: vi.fn((_query: Record<string, unknown>) => ({
    lean: async () => __mocks.findOneResult,
  })),
}));

vi.mock("@oc/api-db/models", () => ({
  Order: {
    findByIdAndUpdate: __mocks.findByIdAndUpdate,
    findOne: __mocks.findOne,
  },
}));

vi.mock("@oc/api-compliance/spend-tracking", () => ({
  releaseReservedSpend: __mocks.releaseReservedSpend,
}));

vi.mock("@oc/api-tickets/promo-codes", async () => {
  const actual = await vi.importActual("@oc/api-tickets/promo-codes");
  return { ...actual, releasePromoCodeUsage: __mocks.releasePromoCodeUsage };
});

describe("markOrderFailed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("is a no-op for completed orders", async () => {
    const orderId = new Types.ObjectId();
    await markOrderFailed({
      _id: orderId,
      userId: new Types.ObjectId(),
      total: 1250,
      status: "completed",
      metadata: { promoCode: "PROMO" },
    });

    expect(__mocks.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(__mocks.releasePromoCodeUsage).not.toHaveBeenCalled();
    expect(__mocks.releaseReservedSpend).not.toHaveBeenCalled();
  });

  test("is a no-op for refunded orders", async () => {
    const orderId = new Types.ObjectId();
    await markOrderFailed({
      _id: orderId,
      userId: new Types.ObjectId(),
      total: 1250,
      status: "refunded",
      metadata: { promoCode: "PROMO" },
    });

    expect(__mocks.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(__mocks.releasePromoCodeUsage).not.toHaveBeenCalled();
    expect(__mocks.releaseReservedSpend).not.toHaveBeenCalled();
  });

  test("sets status to 'failed' and releases the promo code", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    await markOrderFailed({
      _id: orderId,
      userId,
      total: 1250,
      status: "processing",
      metadata: { promoCode: "PROMO10" },
    });

    expect(__mocks.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(__mocks.findByIdAndUpdate.mock.calls[0][0]).toBe(orderId);
    expect(__mocks.findByIdAndUpdate.mock.calls[0][1]).toEqual({
      $set: { status: "failed" },
    });
    expect(__mocks.releasePromoCodeUsage).toHaveBeenCalledTimes(1);
    expect(__mocks.releasePromoCodeUsage.mock.calls[0][0]).toBe("PROMO10");
    expect(__mocks.releasePromoCodeUsage.mock.calls[0][1]).toBe(userId.toString());
    expect(__mocks.releaseReservedSpend).toHaveBeenCalledTimes(1);
    expect(__mocks.releaseReservedSpend).toHaveBeenCalledWith(userId.toString(), 1250);
  });

  test("releases the order total even when no promo code is recorded", async () => {
    const userId = new Types.ObjectId();
    await markOrderFailed({
      _id: new Types.ObjectId(),
      userId,
      total: 2499,
      status: "processing",
      metadata: {},
    });

    expect(__mocks.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(__mocks.releasePromoCodeUsage).not.toHaveBeenCalled();
    expect(__mocks.releaseReservedSpend).toHaveBeenCalledWith(userId.toString(), 2499);
  });

  test("releases 0 for an order with a zero total", async () => {
    const userId = new Types.ObjectId();
    await markOrderFailed({
      _id: new Types.ObjectId(),
      userId,
      total: 0,
      status: "processing",
      metadata: {},
    });

    expect(__mocks.releaseReservedSpend).toHaveBeenCalledWith(userId.toString(), 0);
  });
});

describe("getOrderBySessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("queries by providerSessionId", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.findOneResult = { _id: orderId, userId, providerSessionId: "session_x" };

    await getOrderBySessionId("session_x", userId.toString());

    expect(__mocks.findOne).toHaveBeenCalledTimes(1);
    expect(__mocks.findOne.mock.calls[0][0]).toEqual({
      providerSessionId: "session_x",
      userId,
    });
  });

  test("does not add userId filter when omitted", async () => {
    __mocks.findOneResult = null;

    await getOrderBySessionId("session_y");

    expect(__mocks.findOne.mock.calls[0][0]).toEqual({ providerSessionId: "session_y" });
  });
});
