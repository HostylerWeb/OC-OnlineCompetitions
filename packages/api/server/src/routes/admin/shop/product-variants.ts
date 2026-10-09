import { ShopProduct, ShopProductVariant } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import {
  type ShopProductOptionsSyncInput,
  type ShopProductVariantBulkUpdateInput,
  type ShopProductVariantCreateInput,
  type ShopProductVariantImagesInput,
  type ShopProductVariantUpdateInput,
  shopProductOptionsSyncSchema,
  shopProductVariantBulkUpdateSchema,
  shopProductVariantCreateSchema,
  shopProductVariantImagesSchema,
  shopProductVariantUpdateSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireManager);

function variantMatchesOptionValue(
  variantOptionValues: Array<{ optionName: string; value: string }>,
  optionName: string,
  optionValue: string
): boolean {
  return variantOptionValues.some((ov) => ov.optionName === optionName && ov.value === optionValue);
}

function variantHasAllOptions(
  variantOptionValues: Array<{ optionName: string; value: string }>,
  required: Array<{ optionName: string; value: string }>
): boolean {
  return required.every((req) =>
    variantOptionValues.some((ov) => ov.optionName === req.optionName && ov.value === req.value)
  );
}

app.get("/:productId/variants", async (c) => {
  try {
    const productId = c.req.param("productId");
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
    }

    const variants = await ShopProductVariant.find({ productId, deletedAt: null })
      .sort({ sortOrder: 1 })
      .lean();

    return success(c, variants);
  } catch (err: unknown) {
    console.error("Error listing product variants:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.productVariants.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/:productId/variants",
  async (c, next) => validateBody(c, next, shopProductVariantCreateSchema),
  async (c) => {
    try {
      const productId = c.req.param("productId");
      const body = c.get("body") as ShopProductVariantCreateInput;
      await dbConnect();

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
      }

      const variant = await ShopProductVariant.create({
        ...body,
        productId: new mongoose.Types.ObjectId(productId),
      });
      void invalidateByChannelSafe(CH.shopProducts, CH.shopProduct).catch(() => {});

      return success(c, variant);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.CONFLICT, "A variant with this SKU already exists", 409);
      }
      console.error("Error creating product variant:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.productVariants.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:productId/variants/:id",
  async (c, next) => validateBody(c, next, shopProductVariantUpdateSchema),
  async (c) => {
    try {
      const productId = c.req.param("productId");
      const id = c.req.param("id");
      const body = c.get("body") as ShopProductVariantUpdateInput;
      await dbConnect();

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return error(c, ErrorCodes.NOT_FOUND, "Variant not found", 404);
      }

      const variant = await ShopProductVariant.findOneAndUpdate(
        { _id: id, productId },
        { $set: body },
        { returnDocument: "after" }
      ).lean();
      void invalidateByChannelSafe(CH.shopProducts, CH.shopProduct).catch(() => {});

      if (!variant) {
        return error(c, ErrorCodes.NOT_FOUND, "Variant not found", 404);
      }

      return success(c, variant);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        return error(c, ErrorCodes.CONFLICT, "A variant with this SKU already exists", 409);
      }
      console.error("Error updating product variant:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.productVariants.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:productId/variants-bulk",
  async (c, next) => validateBody(c, next, shopProductVariantBulkUpdateSchema),
  async (c) => {
    try {
      const productId = c.req.param("productId");
      const body = c.get("body") as ShopProductVariantBulkUpdateInput;
      await dbConnect();

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
      }

      const results: Array<{ id: string; ok: boolean; error?: string }> = [];

      for (const update of body.updates) {
        if (!mongoose.Types.ObjectId.isValid(update.id)) {
          results.push({ id: update.id, ok: false, error: "Invalid id" });
          continue;
        }
        try {
          const res = await ShopProductVariant.findOneAndUpdate(
            { _id: update.id, productId },
            { $set: update.payload },
            { returnDocument: "after" }
          ).lean();
          if (!res) {
            results.push({ id: update.id, ok: false, error: "Not found" });
          } else {
            results.push({ id: update.id, ok: true });
          }
        } catch (err) {
          results.push({
            id: update.id,
            ok: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
      void invalidateByChannelSafe(CH.shopProducts, CH.shopProduct).catch(() => {});

      return success(c, { results });
    } catch (err: unknown) {
      console.error("Error bulk updating product variants:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.productVariants.bulkUpdate",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:productId/variants/:id/images",
  async (c, next) => validateBody(c, next, shopProductVariantImagesSchema),
  async (c) => {
    try {
      const productId = c.req.param("productId");
      const id = c.req.param("id");
      const body = c.get("body") as ShopProductVariantImagesInput;
      await dbConnect();

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return error(c, ErrorCodes.NOT_FOUND, "Variant not found", 404);
      }

      const variant = await ShopProductVariant.findOneAndUpdate(
        { _id: id, productId },
        { $set: { images: body.images } },
        { returnDocument: "after" }
      ).lean();
      void invalidateByChannelSafe(CH.shopProducts, CH.shopProduct).catch(() => {});

      if (!variant) {
        return error(c, ErrorCodes.NOT_FOUND, "Variant not found", 404);
      }

      return success(c, variant);
    } catch (err: unknown) {
      console.error("Error updating variant images:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.productVariants.updateImages",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.post(
  "/:productId/options-sync",
  async (c, next) => validateBody(c, next, shopProductOptionsSyncSchema),
  async (c) => {
    try {
      const productId = c.req.param("productId");
      const body = c.get("body") as ShopProductOptionsSyncInput;
      await dbConnect();

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
      }

      const productObjectId = new mongoose.Types.ObjectId(productId);

      const product = await ShopProduct.findById(productObjectId).lean();
      if (!product) {
        return error(c, ErrorCodes.NOT_FOUND, "Product not found", 404);
      }

      await ShopProduct.findByIdAndUpdate(productObjectId, {
        $set: { options: body.options },
      });
      void invalidateByChannelSafe(CH.shopProducts, CH.shopProduct).catch(() => {});

      const existingVariants = await ShopProductVariant.find({
        productId: productObjectId,
        deletedAt: null,
      }).lean();

      const validOptionValueSet = new Set<string>();
      for (const opt of body.options) {
        for (const v of opt.values) {
          validOptionValueSet.add(`${opt.name}::${v.value}`);
        }
      }

      const orphanVariantIds: string[] = [];
      for (const variant of existingVariants) {
        const isOrphan = variant.optionValues.some(
          (ov) => !validOptionValueSet.has(`${ov.optionName}::${ov.value}`)
        );
        if (isOrphan && variant.isActive) {
          orphanVariantIds.push(String(variant._id));
        }
      }

      if (orphanVariantIds.length > 0) {
        await ShopProductVariant.updateMany(
          { _id: { $in: orphanVariantIds.map((id) => new mongoose.Types.ObjectId(id)) } },
          { $set: { isActive: false } }
        );
      }
      void invalidateByChannelSafe(CH.shopProducts, CH.shopProduct).catch(() => {});

      const existingKeys = new Set(
        existingVariants.map((v) =>
          v.optionValues
            .map((ov) => `${ov.optionName}::${ov.value}`)
            .sort()
            .join("|")
        )
      );

      const createdVariants: Array<{ name: string; sku: string; id: string }> = [];
      const skipped: string[] = [];
      const errors: Array<{ name: string; error: string }> = [];

      for (const newVar of body.newVariants) {
        const key = newVar.optionValues
          .map((ov) => `${ov.optionName}::${ov.value}`)
          .sort()
          .join("|");
        if (existingKeys.has(key)) {
          skipped.push(newVar.name);
          continue;
        }
        try {
          const created = await ShopProductVariant.create({
            productId: productObjectId,
            name: newVar.name,
            sku: newVar.sku,
            optionValues: newVar.optionValues,
            inventory: 0,
            inventoryTracked: true,
            images: [],
            isActive: true,
            sortOrder: 0,
          });
          createdVariants.push({ name: newVar.name, sku: newVar.sku, id: String(created._id) });
          existingKeys.add(key);
        } catch (err) {
          errors.push({
            name: newVar.name,
            error: isDuplicateKeyError(err)
              ? "SKU already exists"
              : err instanceof Error
                ? err.message
                : "Unknown",
          });
        }
      }

      const activeVariantsAfter = await ShopProductVariant.find({
        productId: productObjectId,
        deletedAt: null,
        isActive: true,
      }).lean();

      return success(c, {
        disabledVariants: orphanVariantIds.length,
        createdVariants,
        skipped,
        errors,
        totalActiveVariants: activeVariantsAfter.length,
      });
    } catch (err: unknown) {
      console.error("Error syncing options:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.shop.productVariants.optionsSync",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/:productId/variants/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.NOT_FOUND, "Variant not found", 404);
    }

    const variant = await ShopProductVariant.softDelete(id, c.get("userId") ?? undefined);
    void invalidateByChannelSafe(CH.shopProducts, CH.shopProduct).catch(() => {});

    if (!variant) {
      return error(c, ErrorCodes.NOT_FOUND, "Variant not found", 404);
    }

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting product variant:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.shop.productVariants.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export const _internal = { variantMatchesOptionValue, variantHasAllOptions };
export default app;
