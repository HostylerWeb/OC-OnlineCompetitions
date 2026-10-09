import { ShopCategory, ShopProduct } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import mongoose from "mongoose";

async function seed() {
  await dbConnect();
  console.log("[seed] Connected to MongoDB");

  // Clear existing data
  await ShopCategory.deleteMany({});
  await ShopProduct.deleteMany({});
  console.log("[seed] Cleared existing shop data");

  // ── Categories ──────────────────────────────────────
  const categories = await ShopCategory.insertMany([
    {
      name: "Hoodies",
      slug: "hoodies",
      description: "Premium heavyweight hoodies",
      sortOrder: 1,
      isActive: true,
    },
    {
      name: "T-Shirts",
      slug: "t-shirts",
      description: "Heavyweight cotton tees",
      sortOrder: 2,
      isActive: true,
    },
    {
      name: "Headwear",
      slug: "headwear",
      description: "Essential caps and hats",
      sortOrder: 3,
      isActive: true,
    },
    {
      name: "Accessories",
      slug: "accessories",
      description: "Premium lifestyle accessories",
      sortOrder: 4,
      isActive: true,
    },
    {
      name: "Limited Founder Collection",
      slug: "founder-collection",
      description: "Limited edition numbered pieces",
      sortOrder: 5,
      isActive: true,
    },
  ]);
  console.log(`[seed] Created ${categories.length} categories`);

  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c._id]));

  // ── Products ────────────────────────────────────────
  const products = await ShopProduct.insertMany([
    {
      name: "Online Competitions Definition Hoodie — Black",
      slug: "oc-definition-hoodie-black",
      description:
        "500 GSM Heavyweight French Terry\n\nBlack\nGold silicone logo on chest\nDefinition spine print on back\nOversized fit",
      shortDescription: "500 GSM heavyweight French Terry hoodie",
      price: 8900,
      sku: "LXR-HD-BLK-001",
      inventory: 50,
      inventoryTracked: true,
      categoryId: catMap.hoodies,
      images: [],
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "Online Competitions Definition Hoodie — Gold",
      slug: "oc-definition-hoodie-gold",
      description:
        "500 GSM Heavyweight French Terry\n\nOnline Competitions Gold\nBlack silicone logo on chest\nDefinition spine print on back\nOversized fit",
      shortDescription: "500 GSM heavyweight French Terry hoodie",
      price: 8900,
      sku: "LXR-HD-GLD-001",
      inventory: 50,
      inventoryTracked: true,
      categoryId: catMap.hoodies,
      images: [],
      isActive: true,
      sortOrder: 2,
    },
    {
      name: "Online Competitions Definition Tee — Black",
      slug: "oc-definition-tee-black",
      description:
        "280 GSM Heavyweight Cotton\n\nBlack\nGold silicone logo on chest\nDefinition spine print on back\nOversized fit",
      shortDescription: "280 GSM heavyweight cotton tee",
      price: 4900,
      sku: "LXR-TE-BLK-001",
      inventory: 100,
      inventoryTracked: true,
      categoryId: catMap["t-shirts"],
      images: [],
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "Online Competitions Definition Tee — Gold",
      slug: "oc-definition-tee-gold",
      description:
        "280 GSM Heavyweight Cotton\n\nOnline Competitions Gold\nBlack silicone logo on chest\nDefinition spine print on back\nOversized fit",
      shortDescription: "280 GSM heavyweight cotton tee",
      price: 4900,
      sku: "LXR-TE-GLD-001",
      inventory: 100,
      inventoryTracked: true,
      categoryId: catMap["t-shirts"],
      images: [],
      isActive: true,
      sortOrder: 2,
    },
    {
      name: "Online Competitions Essential Cap",
      slug: "oc-essential-cap",
      description: "Black\n3D silicone logo\nAdjustable fit",
      shortDescription: "Adjustable cap with 3D silicone logo",
      price: 3400,
      sku: "LXR-CP-BLK-001",
      inventory: 75,
      inventoryTracked: true,
      categoryId: catMap.headwear,
      images: [],
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "Online Competitions Essential Cap — Gold Edition",
      slug: "oc-essential-cap-gold",
      description: "Gold\nBlack logo\nAdjustable fit",
      shortDescription: "Gold edition adjustable cap",
      price: 3900,
      sku: "LXR-CP-GLD-001",
      inventory: 50,
      inventoryTracked: true,
      categoryId: catMap.headwear,
      images: [],
      isActive: true,
      sortOrder: 2,
    },
    {
      name: "Online Competitions Premium Mug",
      slug: "oc-premium-mug",
      description: "Matte Black\nGold Online Competitions logo",
      shortDescription: "Matte black ceramic mug with gold logo",
      price: 1900,
      sku: "LXR-MG-001",
      inventory: 200,
      inventoryTracked: true,
      categoryId: catMap.accessories,
      images: [],
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "Online Competitions Insulated Bottle",
      slug: "oc-insulated-bottle",
      description: "Matte Black\nLaser engraved logo",
      shortDescription: "Insulated bottle with laser engraved logo",
      price: 2900,
      sku: "LXR-BT-001",
      inventory: 100,
      inventoryTracked: true,
      categoryId: catMap.accessories,
      images: [],
      isActive: true,
      sortOrder: 2,
    },
    {
      name: "Online Competitions Phone Case",
      slug: "oc-phone-case",
      description: "iPhone & Samsung\nBlack\nGold Online Competitions logo",
      shortDescription: "Universal phone case with gold logo",
      price: 1700,
      sku: "LXR-PC-001",
      inventory: 150,
      inventoryTracked: true,
      categoryId: catMap.accessories,
      images: [],
      isActive: true,
      sortOrder: 3,
    },
    {
      name: "Founder Hoodie",
      slug: "founder-hoodie",
      description:
        "Black\nGold silicone logo\nFounding Collection 2026 neck print\nLimited numbered edition",
      shortDescription: "Limited edition numbered founder hoodie",
      price: 14900,
      sku: "LXR-FH-001",
      inventory: 25,
      inventoryTracked: true,
      categoryId: catMap["founder-collection"],
      images: [],
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "Founder Tee",
      slug: "founder-tee",
      description: "Black\nGold silicone logo\nLimited numbered edition",
      shortDescription: "Limited edition numbered founder tee",
      price: 7900,
      sku: "LXR-FT-001",
      inventory: 50,
      inventoryTracked: true,
      categoryId: catMap["founder-collection"],
      images: [],
      isActive: true,
      sortOrder: 2,
    },
  ]);

  console.log(`[seed] Created ${products.length} products`);
  console.log("[seed] Done");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
