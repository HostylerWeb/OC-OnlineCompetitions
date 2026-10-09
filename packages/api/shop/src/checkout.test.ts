import type { IShopOrderShippingAddress } from "@oc/api-db/models";
import { ShopOrder } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
  type CheckoutLineItemValidation,
  type CreateShopOrderParams,
  createPendingShopOrder,
} from "./checkout";

const shippingAddress: IShopOrderShippingAddress = {
  firstName: "Ada",
  lastName: "Lovelace",
  addressLine1: "1 Analytical Engine Way",
  city: "London",
  postcode: "SW1A 1AA",
  country: "GB",
};

const lineItem: CheckoutLineItemValidation = {
  productId: new Types.ObjectId().toString(),
  quantity: 2,
  unitPrice: 1250,
  name: "Test Product",
  sku: "TEST-1",
  subtotal: 2500,
};

function makeParams(
  userId: string,
  overrides: Partial<CreateShopOrderParams> = {}
): CreateShopOrderParams {
  return {
    userId,
    items: [lineItem],
    subtotal: 2500,
    shippingAddress,
    email: "buyer@example.com",
    providerSessionId: "",
    ...overrides,
  };
}

describe("createPendingShopOrder", () => {
  beforeAll(async () => {
    await dbConnect();
    await ShopOrder.createIndexes();
  });

  afterAll(async () => {
    await ShopOrder.deleteMany({});
  });

  beforeEach(async () => {
    await ShopOrder.deleteMany({});
  });

  test("creates a pending order with the checkout fields", async () => {
    const userId = new Types.ObjectId().toString();
    const order = await createPendingShopOrder(makeParams(userId));

    expect(order.orderNumber).toBeGreaterThan(0);
    expect(order.status).toBe("pending");
    expect(order.userId.toString()).toBe(userId);
    expect(order.subtotal).toBe(2500);
    expect(order.total).toBe(2500);
    expect(order.currency).toBe("GBP");
    expect(order.shippingAddress.postcode).toBe("SW1A 1AA");
    expect(order.email).toBe("buyer@example.com");
  });

  test("replay with the same idempotencyKey returns the existing order", async () => {
    const userId = new Types.ObjectId().toString();
    const params = makeParams(userId, {
      idempotencyKey: "idem-1",
      providerSessionId: "sess_abc",
    });

    const first = await createPendingShopOrder(params);
    const replay = await createPendingShopOrder(params);

    expect(replay._id).toEqual(first._id);
    expect(await ShopOrder.countDocuments({ userId: new Types.ObjectId(userId) })).toBe(1);
    expect(replay.status).toBe("pending");
    expect(replay.providerSessionId).toBe("sess_abc");
  });

  test("replay never overwrites a live providerSessionId", async () => {
    const userId = new Types.ObjectId().toString();
    await createPendingShopOrder(
      makeParams(userId, { idempotencyKey: "idem-2", providerSessionId: "sess_first" })
    );

    const order = await ShopOrder.findOne({ userId: new Types.ObjectId(userId) }).lean();
    await ShopOrder.findByIdAndUpdate(order!._id, { $set: { providerSessionId: "cs_live_1" } });

    const replay = await createPendingShopOrder(
      makeParams(userId, { idempotencyKey: "idem-2", providerSessionId: "sess_second" })
    );
    expect(replay.providerSessionId).toBe("cs_live_1");
  });

  test("concurrent duplicate creates converge on a single order", async () => {
    const userId = new Types.ObjectId().toString();
    const params = makeParams(userId, {
      idempotencyKey: "idem-3",
      providerSessionId: "sess_con",
    });

    const [a, b] = await Promise.all([
      createPendingShopOrder(params),
      createPendingShopOrder(params),
    ]);

    expect(a._id.toString()).toBe(b._id.toString());
    expect(await ShopOrder.countDocuments({ userId: new Types.ObjectId(userId) })).toBe(1);
  });
});
