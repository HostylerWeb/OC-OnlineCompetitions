import type { MetadataRoute } from "next";

const SITE_URL = "https://shop.onlinecompetitions.co.uk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.9 },
  ];

  let productPages: MetadataRoute.Sitemap = [];
  try {
    const { default: dbConnect } = await import("@oc/api-infra/db");
    const { ShopProduct } = await import("@oc/api-db/models");
    await dbConnect();
    const products = await ShopProduct.find({ active: true, deletedAt: null })
      .select("slug updatedAt")
      .lean();
    productPages = products.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updatedAt ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Non-critical
  }

  return [...staticPages, ...productPages];
}
