import type { IShopOrder, IShopOrderShippingAddress } from "@oc/api-db/models";
import { ShopOrder, ShopProduct, ShopProductVariant } from "@oc/api-db/models";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import { Types } from "mongoose";

export interface ShopCheckoutItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ShopCheckoutInput {
  items: ShopCheckoutItem[];
  shippingAddress: IShopOrderShippingAddress;
  email: string;
  userId: string;
  idempotencyKey?: string;
  notes?: string;
}

export interface CheckoutLineItemValidation {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  name: string;
  sku: string;
  variantName?: string;
  image?: string;
  subtotal: number;
}

export interface ValidateCheckoutResult {
  valid: boolean;
  items: CheckoutLineItemValidation[];
  total: number;
  errors: { productId: string; message: string }[];
}

export async function validateCheckoutItems(
  items: ShopCheckoutItem[]
): Promise<ValidateCheckoutResult> {
  const errors: ValidateCheckoutResult["errors"] = [];
  const validItems: CheckoutLineItemValidation[] = [];
  let total = 0;

  for (const item of items) {
    const product = await ShopProduct.findById(item.productId)
      .select("name slug price sku images inventory inventoryTracked isActive deletedAt")
      .lean();

    if (!product || product.deletedAt) {
      errors.push({ productId: item.productId, message: "Product not found" });
      continue;
    }

    if (!product.isActive) {
      errors.push({ productId: item.productId, message: "Product is not available" });
      continue;
    }

    let variant = null;
    if (item.variantId) {
      variant = await ShopProductVariant.findOne({
        _id: item.variantId,
        productId: item.productId,
        isActive: true,
        deletedAt: null,
      })
        .select("name sku price inventory inventoryTracked images optionValues")
        .lean();

      if (!variant) {
        errors.push({ productId: item.productId, message: "Variant not found or unavailable" });
        continue;
      }
    }

    const tracked = variant?.inventoryTracked ?? product.inventoryTracked;
    const effectiveInventory = variant?.inventory ?? product.inventory;
    if (tracked && effectiveInventory < item.quantity) {
      errors.push({
        productId: item.productId,
        message: `Insufficient inventory. Available: ${effectiveInventory}, requested: ${item.quantity}`,
      });
      continue;
    }

    const unitPrice = variant?.price ?? product.price;
    const subtotal = unitPrice * item.quantity;
    total += subtotal;

    validItems.push({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice,
      name: product.name,
      sku: variant?.sku ?? product.sku,
      variantName: variant?.name,
      image: variant?.images?.[0] ?? product.images?.[0],
      subtotal,
    });
  }

  return { valid: errors.length === 0, items: validItems, total, errors };
}

export interface CreateShopOrderParams {
  items: CheckoutLineItemValidation[];
  subtotal: number;
  shippingAddress: IShopOrderShippingAddress;
  email: string;
  userId: string;
  isGuestCheckout?: boolean;
  providerSessionId: string;
  idempotencyKey?: string;
  notes?: string;
}

const IDEMPOTENT_INSERT_RETRIES = 3;
const IDEMPOTENT_INSERT_BACKOFF_MS = 250;

export async function createPendingShopOrder(params: CreateShopOrderParams): Promise<IShopOrder> {
  const userId = new Types.ObjectId(params.userId);

  if (params.idempotencyKey) {
    return createPendingShopOrderWithIdempotency(params, userId);
  }

  const orderNumber = await generateOrderNumber();
  return ShopOrder.create(buildShopOrderDoc(params, userId, orderNumber));
}

/**
 * Idempotent variant: upsert scoped to `{ userId, idempotencyKey }` so a
 * concurrent duplicate checkout request returns the existing pending order
 * instead of creating a second one. `providerSessionId` is only written on
 * insert (`$setOnInsert`) so a replay can never overwrite the live session
 * reference another request set on the same order.
 */
async function createPendingShopOrderWithIdempotency(
  params: CreateShopOrderParams,
  userId: Types.ObjectId
): Promise<IShopOrder> {
  const idempotencyKey = params.idempotencyKey!;

  for (let attempt = 0; attempt < IDEMPOTENT_INSERT_RETRIES; attempt++) {
    const orderNumber = await generateOrderNumber();
    try {
      const order = await ShopOrder.findOneAndUpdate(
        { userId, idempotencyKey },
        { $setOnInsert: buildShopOrderDoc(params, userId, orderNumber) },
        { upsert: true, returnDocument: "after" }
      );
      if (order) return order;
      throw new Error("Failed to create pending shop order");
    } catch (err: unknown) {
      if (!isDuplicateKeyError(err)) throw err;

      const existing = await ShopOrder.findOne({ userId, idempotencyKey });
      if (existing) {
        return existing;
      }

      // The duplicate must have come from the `orderNumber` index (two
      // concurrent requests drew the same random number) — regenerate and
      // retry. Backoff keeps the whole attempt window bounded.
      if (attempt === IDEMPOTENT_INSERT_RETRIES - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, IDEMPOTENT_INSERT_BACKOFF_MS));
    }
  }

  throw new Error("Failed to create pending shop order");
}

function buildShopOrderDoc(
  params: CreateShopOrderParams,
  userId: Types.ObjectId,
  orderNumber: number
): Record<string, unknown> {
  return {
    orderNumber,
    userId,
    isGuestCheckout: params.isGuestCheckout ?? false,
    status: "pending",
    items: params.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      productSnapshot: {
        name: item.name,
        sku: item.sku,
        price: item.unitPrice,
        image: item.image,
        variantName: item.variantName,
      },
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    subtotal: params.subtotal,
    shippingCost: 0,
    discountAmount: 0,
    total: params.subtotal,
    currency: "GBP",
    providerSessionId: params.providerSessionId,
    shippingAddress: params.shippingAddress,
    email: params.email,
    idempotencyKey: params.idempotencyKey,
    notes: params.notes,
  };
}

export async function generateOrderNumber(retries = 3): Promise<number> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const number = Math.floor(100000 + Math.random() * 900000);
    const existing = await ShopOrder.findOne({ orderNumber: number }).lean();
    if (!existing) return number;
  }
  throw new Error("Failed to generate unique order number");
}
