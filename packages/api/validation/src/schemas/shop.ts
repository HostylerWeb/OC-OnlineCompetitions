import { z } from "zod";
import { ukCountryCodeSchema } from "./address";

// ── Product Options ─────────────────────────────────────

export const shopProductOptionValueSchema = z.object({
  value: z.string().min(1, "Option value is required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const shopProductOptionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  values: z.array(shopProductOptionValueSchema).default([]),
});

// ── Product Variants ────────────────────────────────────

export const shopProductVariantOptionValueSchema = z.object({
  optionName: z.string().min(1),
  value: z.string().min(1),
});

export const shopProductVariantCreateSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1, "Variant name is required"),
  sku: z.string().min(1, "SKU is required"),
  price: z.number().min(0).optional(),
  compareAtPrice: z.number().min(0).optional(),
  inventory: z.number().int().min(0).default(0),
  inventoryTracked: z.boolean().default(true),
  images: z.array(z.string().url()).default([]),
  optionValues: z.array(shopProductVariantOptionValueSchema).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const shopProductVariantUpdateSchema = shopProductVariantCreateSchema.partial();

export type ShopProductVariantCreateInput = z.infer<typeof shopProductVariantCreateSchema>;
export type ShopProductVariantUpdateInput = z.infer<typeof shopProductVariantUpdateSchema>;

export const shopProductVariantBulkUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        payload: shopProductVariantUpdateSchema,
      })
    )
    .min(1),
});

export type ShopProductVariantBulkUpdateInput = z.infer<typeof shopProductVariantBulkUpdateSchema>;

export const shopProductVariantImagesSchema = z.object({
  images: z.array(z.string().url()).default([]),
});

export type ShopProductVariantImagesInput = z.infer<typeof shopProductVariantImagesSchema>;

export const shopProductOptionsSyncSchema = z.object({
  options: z.array(shopProductOptionSchema).default([]),
  newVariants: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: z.string().min(1),
        optionValues: z.array(shopProductVariantOptionValueSchema),
      })
    )
    .default([]),
});

export type ShopProductOptionsSyncInput = z.infer<typeof shopProductOptionsSyncSchema>;

// ── Product ─────────────────────────────────────────────

export const shopProductCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly"),
  description: z.string().default(""),
  shortDescription: z.string().optional(),
  price: z.number().min(0, "Price must be >= 0"),
  compareAtPrice: z.number().min(0).optional(),
  sku: z.string().min(1, "SKU is required"),
  inventory: z.number().int().min(0).default(0),
  inventoryTracked: z.boolean().default(true),
  categoryId: z.string().optional(),
  images: z.array(z.string().url()).default([]),
  options: z.array(shopProductOptionSchema).default([]),
  lowStockThreshold: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const shopProductUpdateSchema = shopProductCreateSchema.partial();

export type ShopProductCreateInput = z.infer<typeof shopProductCreateSchema>;
export type ShopProductUpdateInput = z.infer<typeof shopProductUpdateSchema>;

// ── Category ────────────────────────────────────────────

export const shopCategoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly"),
  description: z.string().optional(),
  image: z.string().url().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const shopCategoryUpdateSchema = shopCategoryCreateSchema.partial();

export type ShopCategoryCreateInput = z.infer<typeof shopCategoryCreateSchema>;
export type ShopCategoryUpdateInput = z.infer<typeof shopCategoryUpdateSchema>;

// ── Order Status ────────────────────────────────────────

export const shopOrderStatusEnum = z.enum([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const shopOrderUpdateStatusSchema = z.object({
  status: shopOrderStatusEnum,
  notes: z.string().optional(),
});

export type ShopOrderUpdateStatusInput = z.infer<typeof shopOrderUpdateStatusSchema>;

// ── Cart / Checkout ─────────────────────────────────────

export const shopCartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1),
});

export const shopCartSchema = z.object({
  items: z.array(shopCartItemSchema).min(1, "Cart must have at least one item"),
});

export type ShopCartInput = z.infer<typeof shopCartSchema>;

export const shopCartAddItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export type ShopCartAddItemInput = z.infer<typeof shopCartAddItemSchema>;

export const shopCartUpdateItemSchema = z.object({
  variantId: z.string().optional(),
  quantity: z.number().int().min(0),
});

export type ShopCartUpdateItemInput = z.infer<typeof shopCartUpdateItemSchema>;

export const shopShippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  postcode: z.string().min(1),
  country: ukCountryCodeSchema,
});

export const shopCreateCheckoutSessionSchema = z.object({
  items: z.array(shopCartItemSchema).min(1),
  shippingAddress: shopShippingAddressSchema,
  email: z.string().email().optional(),
  phone: z.string().min(5).max(30).optional(),
  provider: z.enum(["local", "paytriot", "stripe"]).default("local"),
  idempotencyKey: z.string().optional(),
  notes: z.string().optional(),
});

export type ShopCreateCheckoutSessionInput = z.infer<typeof shopCreateCheckoutSessionSchema>;
