import { Types } from "mongoose";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { retryStuckFulfillment } from "./retry-helpers";

const __mocks = vi.hoisted(() => ({
  finalizeSuccessfulOrder: vi.fn(async () => "fulfilled" as const),
  findByIdAndUpdate: vi.fn(async () => null),
  findByIdData: null as Record<string, unknown> | null,
  findById: (..._args: unknown[]) => ({
    lean: async () => __mocks.findByIdData,
  }),
}));

vi.mock("@oc/api-db/models", () => ({
  Order: {
    findById: __mocks.findById,
    findByIdAndUpdate: __mocks.findByIdAndUpdate,
  },
}));

vi.mock("../../finalize-successful-order", () => ({
  finalizeSuccessfulOrder: __mocks.finalizeSuccessfulOrder,
}));

describe("retryStuckFulfillment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 'skipped' if order is not in 'processing' state", async () => {
    __mocks.findByIdData = {
      _id: new Types.ObjectId(),
      status: "completed",
    };

    const result = await retryStuckFulfillment({
      orderId: new Types.ObjectId().toString(),
      providerId: "paytriot",
      resolveCaptureId: () => "capture_1",
    });
    expect(result).toBe("skipped");
    expect(__mocks.finalizeSuccessfulOrder).not.toHaveBeenCalled();
    expect(__mocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("returns 'skipped' if shouldRetry returns false", async () => {
    __mocks.findByIdData = {
      _id: new Types.ObjectId(),
      status: "processing",
    };

    const result = await retryStuckFulfillment({
      orderId: new Types.ObjectId().toString(),
      providerId: "paytriot",
      resolveCaptureId: () => "capture_1",
      shouldRetry: () => false,
    });
    expect(result).toBe("skipped");
    expect(__mocks.finalizeSuccessfulOrder).not.toHaveBeenCalled();
  });

  test("returns 'in-progress' if the fulfilment lock has not expired", async () => {
    const lockExpiresAt = new Date(Date.now() + 60_000);
    __mocks.findByIdData = {
      _id: new Types.ObjectId(),
      status: "processing",
      metadata: { fulfillmentLock: { expiresAt: lockExpiresAt } },
    };

    const result = await retryStuckFulfillment({
      orderId: new Types.ObjectId().toString(),
      providerId: "paytriot",
      resolveCaptureId: () => "capture_1",
    });
    expect(result).toBe("in-progress");
    expect(__mocks.finalizeSuccessfulOrder).not.toHaveBeenCalled();
    expect(__mocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("returns 'fulfilled' when finalizeSuccessfulOrder resolves 'fulfilled'", async () => {
    const orderId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    __mocks.finalizeSuccessfulOrder.mockResolvedValue("fulfilled" as const);
    __mocks.findByIdData = {
      _id: orderId,
      userId,
      status: "processing",
    };
    __mocks.findByIdAndUpdate.mockResolvedValue(null);

    const result = await retryStuckFulfillment({
      orderId: orderId.toString(),
      providerId: "paytriot",
      resolveCaptureId: () => "cap_1",
    });
    expect(result).toBe("fulfilled");
    expect(__mocks.finalizeSuccessfulOrder).toHaveBeenCalledTimes(1);
    expect(__mocks.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("returns 'already-finalized' when finalizeSuccessfulOrder resolves 'already-finalized'", async () => {
    const orderId = new Types.ObjectId();
    __mocks.finalizeSuccessfulOrder.mockResolvedValue("already-finalized" as const);
    __mocks.findByIdData = {
      _id: orderId,
      userId: new Types.ObjectId(),
      status: "processing",
    };
    __mocks.findByIdAndUpdate.mockResolvedValue(null);

    const result = await retryStuckFulfillment({
      orderId: orderId.toString(),
      providerId: "paytriot",
      resolveCaptureId: () => "cap_2",
    });
    expect(result).toBe("already-finalized");
    expect(__mocks.finalizeSuccessfulOrder).toHaveBeenCalledTimes(1);
  });

  test("returns 'in-progress' when finalizeSuccessfulOrder resolves 'in-progress'", async () => {
    const orderId = new Types.ObjectId();
    __mocks.finalizeSuccessfulOrder.mockResolvedValue("in-progress" as const);
    __mocks.findByIdData = {
      _id: orderId,
      userId: new Types.ObjectId(),
      status: "processing",
    };
    __mocks.findByIdAndUpdate.mockResolvedValue(null);

    const result = await retryStuckFulfillment({
      orderId: orderId.toString(),
      providerId: "paytriot",
      resolveCaptureId: () => "cap_3",
    });
    expect(result).toBe("in-progress");
    expect(__mocks.finalizeSuccessfulOrder).toHaveBeenCalledTimes(1);
  });
});
