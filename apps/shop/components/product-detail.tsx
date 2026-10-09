"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ProductImageGallery, ProductVariantSelector } from "@/components/product-variant-selector";
import { Badge } from "@/components/ui/badge";
import type { ShopProductData, ShopProductVariantData } from "@/lib/api";

interface ProductDetailProps {
  slug: string;
  product: ShopProductData;
}

export function ProductDetail({ slug, product }: ProductDetailProps) {
  const [selectedVariant, setSelectedVariant] = useState<ShopProductVariantData | null>(null);
  const handleVariantChange = useCallback((v: ShopProductVariantData | null) => {
    setSelectedVariant(v);
  }, []);

  const isFounder = slug.startsWith("founder");
  const descLines = (product.description ?? "").split("\n").filter(Boolean);
  const variants = product.variants ?? [];

  return (
    <main className="oc-container py-8 md:py-12">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link href="/products" className="transition-colors hover:text-gold">
          Products
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <ProductImageGallery product={product} selectedVariant={selectedVariant} />

        <div className="flex flex-col">
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {isFounder && <Badge>Limited</Badge>}
          </div>

          <div className="mt-6 space-y-2">
            {descLines.map((line: string, i: number) => {
              const colonIndex = line.indexOf(": ");
              if (colonIndex > 0 && colonIndex < 30) {
                return (
                  <div key={i} className="flex text-sm">
                    <span className="w-32 shrink-0 text-muted-foreground">
                      {line.slice(0, colonIndex)}
                    </span>
                    <span className="text-foreground">{line.slice(colonIndex + 2)}</span>
                  </div>
                );
              }
              if (line === "---") return <hr key={i} className="border-border-subtle" />;
              return (
                <p key={i} className="text-sm text-foreground">
                  {line.startsWith(" - ") || line.startsWith("–") ? (
                    <span className="text-muted-foreground">{line}</span>
                  ) : (
                    line
                  )}
                </p>
              );
            })}
          </div>

          <ProductVariantSelector
            product={product}
            variants={variants}
            onVariantChange={handleVariantChange}
          />
        </div>
      </div>
    </main>
  );
}
