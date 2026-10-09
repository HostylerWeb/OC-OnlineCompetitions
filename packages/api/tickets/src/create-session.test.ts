import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { computeCheckoutTotal, createPendingCheckoutOrder } from "./create-session";

const mockFindOne = vi.fn();
const mockCreate = vi.fn();
const mockFindOneAndUpdate = vi.fn();
const mockUpdateOne = vi.fn();

vi.mock("@oc/api-db/models", () => ({
  Order: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => mockUpdateOne(...args),
  },
}));

/**
 * `Order.findOne` is both awaited directly (order-number collision check) and
 * chained (`.setOptions().select().lean()` for the blocking-order lookup), so
 * the stub has to satisfy either shape.
 */
function queryStub(value: unknown) {
  const stub = Promise.resolve(value) as Promise<unknown> & Record<string, unknown>;
  stub.setOptions = () => stub;
  stub.select = () => stub;
  stub.lean = () => Promise.resolve(value);
  return stub;
}

/**
 * `generateOrderNumber` also goes through `Order.findOne`, so route by filter
 * shape: it queries by `orderNumber`, the blocking lookup by idempotency key.
 */
function mockBlockingOrder(doc: unknown) {
  mockFindOne.mockImplementation((filter: Record<string, unknown>) =>
    queryStub(filter?.orderNumber === undefined ? doc : null)
  );
}

beforeEach(() => {
  mockFindOne.mockImplementation(() => queryStub(null));
  mockUpdateOne.mockReturnValue({ setOptions: () => Promise.resolve({ acknowledged: true }) });
});

const userId = new Types.ObjectId().toString();
const defaultParams = {
  userId,
  items: [{ competitionId: new Types.ObjectId().toString(), quantity: 2 }],
  subtotal: 2000,
  discount: 500,
  providerSessionId: "sess_123",
  provider: "local" as const,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createPendingCheckoutOrder", () => {
  test("creates an order via plain create when no idempotencyKey", async () => {
    const orderId = new Types.ObjectId();
    const createdDoc = {
      _id: orderId,
      orderNumber: 123456789,
      userId: new Types.ObjectId(userId),
      status: "pending",
      subtotal: 2000,
      discountAmount: 500,
      total: 1500,
      providerSessionId: "sess_123",
      provider: "local",
      idempotencyKey: "sess_123",
      metadata: {
        competitionIds: defaultParams.items[0]!.competitionId,
        items: JSON.stringify(defaultParams.items),
      },
    };

    mockCreate.mockResolvedValue(createdDoc);

    const result = await createPendingCheckoutOrder(defaultParams);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(createdDoc);
    expect(mockCreate.mock.calls[0]![0]!.orderNumber).toBeGreaterThan(0);
    expect(mockCreate.mock.calls[0]![0]!.subtotal).toBe(2000);
    expect(mockCreate.mock.calls[0]![0]!.total).toBe(1500);
  });

  test("creates a new order via upsert when idempotencyKey is provided and no match exists", async () => {
    const orderId = new Types.ObjectId();
    const newDoc = {
      _id: orderId,
      orderNumber: 123456789,
      userId: new Types.ObjectId(userId),
      status: "pending",
      subtotal: 2000,
      discountAmount: 500,
      total: 1500,
      providerSessionId: "sess_123",
      provider: "local",
      idempotencyKey: "idem_001",
    };
    const params = { ...defaultParams, idempotencyKey: "idem_001" };
    mockFindOneAndUpdate.mockResolvedValue(newDoc);

    const result = await createPendingCheckoutOrder(params);

    // Upsert, then a second pass that refreshes the priced fields on a still
    // -pending order (the cart may have changed since the order was written).
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(mockCreate).not.toHaveBeenCalled();

    const filter = mockFindOneAndUpdate.mock.calls[0]![0]!;
    expect(filter.userId).toBeInstanceOf(Types.ObjectId);
    expect(filter.idempotencyKey).toBe("idem_001");

    const update = mockFindOneAndUpdate.mock.calls[0]![1]!;
    expect(update.$setOnInsert.subtotal).toBe(2000);
    expect(update.$setOnInsert.total).toBe(1500);
    expect(update.$setOnInsert.status).toBe("pending");
    expect(update.$setOnInsert.provider).toBe("local");
    expect(update.$set.providerSessionId).toBe("sess_123");

    const refreshFilter = mockFindOneAndUpdate.mock.calls[1]![0]!;
    expect(refreshFilter._id).toBe(orderId);
    expect(refreshFilter.status).toBe("pending");

    const refresh = mockFindOneAndUpdate.mock.calls[1]![1]!;
    expect(refresh.$set.subtotal).toBe(2000);
    expect(refresh.$set.total).toBe(1500);
    // Metadata is written key-by-key so runtime state on the doc survives.
    expect(refresh.$set["metadata.items"]).toBeDefined();
    expect(refresh.$set.metadata).toBeUndefined();

    expect(result).toEqual(newDoc);
  });

  test("does not refresh priced fields on a terminal order", async () => {
    const existingDoc = { _id: new Types.ObjectId(), status: "refunded" };
    const params = { ...defaultParams, idempotencyKey: "idem_001" };
    mockFindOneAndUpdate.mockResolvedValue(existingDoc);

    const result = await createPendingCheckoutOrder(params);

    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(existingDoc);
  });

  test.each([
    ["a finished order", { status: "refunded", deletedAt: null }],
    ["a soft-deleted order", { status: "pending", deletedAt: new Date() }],
  ])("releases the idempotency key held by %s", async (_label, blocking) => {
    const blockingId = new Types.ObjectId();
    const params = { ...defaultParams, idempotencyKey: "idem_001" };
    mockBlockingOrder({ _id: blockingId, ...blocking });
    mockFindOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId(), status: "pending" });

    await createPendingCheckoutOrder(params);

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = mockUpdateOne.mock.calls[0]!;
    expect(filter._id).toBe(blockingId);
    // Rewritten, not unset — the unique index is not sparse, so orders missing
    // the field would collide with each other on {userId, null}.
    expect(update.$set.idempotencyKey).toBe(`idem_001:released:${blockingId.toString()}`);
  });

  test("leaves the idempotency key on a still-payable order", async () => {
    const params = { ...defaultParams, idempotencyKey: "idem_001" };
    mockBlockingOrder({ _id: new Types.ObjectId(), status: "pending", deletedAt: null });
    mockFindOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId(), status: "pending" });

    await createPendingCheckoutOrder(params);

    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  test("returns existing order via upsert when idempotencyKey matches", async () => {
    const existingDoc = { _id: new Types.ObjectId(), status: "pending" };
    const params = { ...defaultParams, idempotencyKey: "idem_001" };
    mockFindOneAndUpdate.mockResolvedValue(existingDoc);

    const result = await createPendingCheckoutOrder(params);

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: new Types.ObjectId(params.userId), idempotencyKey: "idem_001" },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ status: "pending" }),
        $set: expect.objectContaining({ providerSessionId: "sess_123" }),
      }),
      expect.objectContaining({ upsert: true })
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toEqual(existingDoc);
  });

  test("re-throws error from upsert path", async () => {
    const dbError = new Error("connection failed");
    const params = { ...defaultParams, idempotencyKey: "idem_001" };
    mockFindOneAndUpdate.mockRejectedValue(dbError);

    await expect(createPendingCheckoutOrder(params)).rejects.toThrow("connection failed");
  });

  test("re-throws E11000 error when idempotency key not set", async () => {
    const dupError = new Error("E11000 duplicate key");
    (dupError as Record<string, unknown>).code = 11000;
    mockCreate.mockRejectedValue(dupError);

    await expect(createPendingCheckoutOrder(defaultParams)).rejects.toThrow(/E11000 duplicate key/);

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("computeCheckoutTotal", () => {
  test("returns subtotal minus discount", () => {
    expect(computeCheckoutTotal(2000, 500)).toBe(1500);
  });

  test("returns 0 when discount exceeds subtotal", () => {
    expect(computeCheckoutTotal(100, 200)).toBe(0);
  });

  test("returns subtotal when discount is 0", () => {
    expect(computeCheckoutTotal(500, 0)).toBe(500);
  });

  test("handles zero values", () => {
    expect(computeCheckoutTotal(0, 0)).toBe(0);
  });
});
