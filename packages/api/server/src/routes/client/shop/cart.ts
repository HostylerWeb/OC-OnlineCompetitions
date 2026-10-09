import { ShopCart, ShopProduct, ShopProductVariant } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { requireSession } from "@oc/api-server/middleware/auth";
import {
  type ShopCartAddItemInput,
  shopCartAddItemSchema,
  shopCartUpdateItemSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";
import mongoose from "mongoose";

const log = createLogger("shop-cart");
const app = new Hono({ strict: false });

app.use("*", requireSession);

function getEffectivePrice(
  product: { price: number; inventoryTracked?: boolean; inventory?: number },
  variant?: { price?: number; inventory?: number; inventoryTracked?: boolean } | null
): number {
  return variant?.price ?? product.price;
}

function getEffectiveInventory(
  product: { inventory: number; inventoryTracked?: boolean },
  variant?: { inventory?: number; inventoryTracked?: boolean } | null
): number {
  if (!variant) return product.inventory;
  return variant.inventory ?? product.inventory;
}

async function getCartWithProducts(userId: string) {
  const cart = await ShopCart.findOne({ userId }).lean();
  if (!cart || cart.items.length === 0) return { items: [] };

  const productIds = cart.items.map((item) => item.productId);
  const variantIds = cart.items
    .map((item) => item.variantId)
    .filter((id): id is mongoose.Types.ObjectId => !!id);

  const [products, variants] = await Promise.all([
    ShopProduct.find({ _id: { $in: productIds } })
      .select("name slug price images sku inventory inventoryTracked metadata")
      .lean(),
    variantIds.length > 0
      ? ShopProductVariant.find({ _id: { $in: variantIds } })
          .select("name sku price inventory inventoryTracked images optionValues")
          .lean()
      : [],
  ]);

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const variantMap = new Map(variants.map((v) => [String(v._id), v]));

  const items = cart.items.map((item) => {
    const product = productMap.get(String(item.productId));
    const variant = item.variantId ? variantMap.get(String(item.variantId)) : undefined;
    return {
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      priceAtAdd: item.priceAtAdd,
      product: product
        ? {
            _id: product._id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            images: product.images,
            sku: product.sku,
            inventory: product.inventory,
            inventoryTracked: product.inventoryTracked,
            metadata: product.metadata,
          }
        : null,
      variant: variant
        ? {
            _id: variant._id,
            name: variant.name,
            sku: variant.sku,
            price: variant.price,
            inventory: variant.inventory,
            inventoryTracked: variant.inventoryTracked,
            images: variant.images,
            optionValues: variant.optionValues,
          }
        : null,
    };
  });

  return { items };
}

app.get("/", async (c) => {
  try {
    await dbConnect();
    const userId = c.get("userId")!;
    const result = await getCartWithProducts(userId);
    return success(c, result);
  } catch (err: unknown) {
    log.error("Error fetching cart:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "shop.cart.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  async (c, next) => validateBody(c, next, shopCartAddItemSchema),
  async (c) => {
    try {
      await dbConnect();
      const body = c.get("body") as ShopCartAddItemInput;
      const userId = c.get("userId")!;

      const product = await ShopProduct.findById(body.productId)
        .select("price inventory inventoryTracked isActive deletedAt")
        .lean();

      if (!product || product.deletedAt || !product.isActive) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found or unavailable", 404);
      }

      let variant = null;
      if (body.variantId) {
        variant = await ShopProductVariant.findOne({
          _id: body.variantId,
          productId: body.productId,
          isActive: true,
          deletedAt: null,
        })
          .select("price inventory inventoryTracked")
          .lean();

        if (!variant) {
          return error(c, ErrorCodes.NOT_FOUND, "Variant not found or unavailable", 404);
        }
      }

      const effectiveInventory = getEffectiveInventory(product, variant);
      const tracked = variant?.inventoryTracked ?? product.inventoryTracked;
      if (tracked && effectiveInventory < body.quantity) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Insufficient inventory", 400);
      }

      const effectivePrice = getEffectivePrice(product, variant);

      const existing = await ShopCart.findOne({ userId }).lean();
      const existingItem = existing?.items.find(
        (i) =>
          String(i.productId) === body.productId &&
          (body.variantId ? String(i.variantId) === body.variantId : !i.variantId)
      );

      if (existingItem) {
        const matchQuery: Record<string, unknown> = {
          userId,
          "items.productId": new mongoose.Types.ObjectId(body.productId),
        };
        if (body.variantId) {
          matchQuery["items.variantId"] = new mongoose.Types.ObjectId(body.variantId);
        } else {
          matchQuery["items.variantId"] = { $exists: false };
        }
        await ShopCart.updateOne(matchQuery, {
          $inc: { "items.$.quantity": body.quantity },
        });
      } else {
        const newItem: Record<string, unknown> = {
          productId: new mongoose.Types.ObjectId(body.productId),
          quantity: body.quantity,
          priceAtAdd: effectivePrice,
        };
        if (body.variantId) {
          newItem.variantId = new mongoose.Types.ObjectId(body.variantId);
        }
        await ShopCart.updateOne(
          { userId },
          {
            $set: { userId },
            $push: { items: newItem },
          },
          { upsert: true }
        );
      }

      const result = await getCartWithProducts(userId);
      return success(c, result);
    } catch (err: unknown) {
      log.error("Error adding to cart:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "shop.cart.add",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/:productId", async (c) => {
  try {
    await dbConnect();
    const userId = c.get("userId")!;
    const productId = c.req.param("productId");
    const variantId = c.req.query("variantId");

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return error(c, ErrorCodes.NOT_FOUND, "Cart item not found", 404);
    }

    const pullQuery: Record<string, unknown> = {
      productId: new mongoose.Types.ObjectId(productId),
    };
    if (variantId) {
      pullQuery.variantId = new mongoose.Types.ObjectId(variantId);
    }

    await ShopCart.updateOne({ userId }, { $pull: { items: pullQuery } });

    const result = await getCartWithProducts(userId);
    return success(c, result);
  } catch (err: unknown) {
    log.error("Error removing from cart:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "shop.cart.remove",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put("/:productId", async (c) => {
  try {
    await dbConnect();
    const userId = c.get("userId")!;
    const productId = c.req.param("productId");

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return error(c, ErrorCodes.NOT_FOUND, "Cart item not found", 404);
    }

    const { quantity, variantId } = shopCartUpdateItemSchema.parse(await c.req.json());

    const product = await ShopProduct.findById(productId).select("price").lean();

    const pullQuery: Record<string, unknown> = {
      productId: new mongoose.Types.ObjectId(productId),
    };
    if (variantId) {
      pullQuery.variantId = new mongoose.Types.ObjectId(variantId);
    }

    await ShopCart.updateOne({ userId }, { $pull: { items: pullQuery } });

    if (quantity > 0) {
      const newItem: Record<string, unknown> = {
        productId: new mongoose.Types.ObjectId(productId),
        quantity,
        priceAtAdd: product?.price ?? 0,
      };
      if (variantId) {
        newItem.variantId = new mongoose.Types.ObjectId(variantId);
      }
      await ShopCart.updateOne(
        { userId },
        {
          $push: { items: newItem },
        },
        { upsert: true }
      );
    }

    const result = await getCartWithProducts(userId);
    return success(c, result);
  } catch (err: unknown) {
    log.error("Error updating cart item:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "shop.cart.update",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
