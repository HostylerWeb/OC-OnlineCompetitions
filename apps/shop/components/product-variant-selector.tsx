"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import type { ShopProductData, ShopProductVariantData } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProductVariantSelectorProps {
  product: ShopProductData;
  variants: ShopProductVariantData[];
  onVariantChange?: (variant: ShopProductVariantData | null) => void;
}

const COLOR_MAP: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  gold: "#d4af37",
  silver: "#c0c0c0",
  red: "#ff0000",
  blue: "#0000ff",
  green: "#008000",
  gray: "#808080",
  grey: "#808080",
  navy: "#000080",
  beige: "#f5f5dc",
  cream: "#fffdd0",
  brown: "#a52a2a",
  pink: "#ffc0cb",
  purple: "#800080",
  orange: "#ffa500",
  yellow: "#ffff00",
  charcoal: "#36454f",
  taupe: "#483c32",
  ivory: "#fffff0",
  rose: "#ff007f",
  coral: "#ff7f50",
  teal: "#008080",
  olive: "#808000",
  burgundy: "#800020",
  camel: "#c19a6b",
  khaki: "#c3b091",
  blush: "#de5d83",
  nude: "#e8bcb9",
  transparent: "transparent",
};

const LIGHT_COLORS = new Set(["#ffffff", "#fffff0", "#fffdd0", "#f5f5dc", "#e8bcb9"]);

function getColorValue(value: string): string | null {
  return COLOR_MAP[value.toLowerCase()] ?? null;
}

function isOptionColorType(option: {
  values: Array<{ value: string; metadata?: Record<string, unknown> }>;
}): boolean {
  return option.values.some((v) => v.metadata?.type === "color");
}

function variantHasAllOptions(
  variantOptionValues: Array<{ optionName: string; value: string }>,
  required: Array<{ optionName: string; value: string }>
): boolean {
  return required.every((req) =>
    variantOptionValues.some((ov) => ov.optionName === req.optionName && ov.value === req.value)
  );
}

function variantMatchesOption(
  variantOptionValues: Array<{ optionName: string; value: string }>,
  optionName: string,
  optionValue: string
): boolean {
  return variantOptionValues.some((ov) => ov.optionName === optionName && ov.value === optionValue);
}

export function ProductVariantSelector({
  product,
  variants,
  onVariantChange,
}: ProductVariantSelectorProps) {
  const activeVariants = useMemo(() => variants.filter((v) => v.isActive), [variants]);

  const options = useMemo(() => {
    if (product.options && product.options.length > 0) return product.options;
    const optionMap = new Map<string, Set<string>>();
    for (const v of activeVariants) {
      for (const ov of v.optionValues) {
        if (!optionMap.has(ov.optionName)) optionMap.set(ov.optionName, new Set());
        optionMap.get(ov.optionName)!.add(ov.value);
      }
    }
    return Array.from(optionMap.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values).map((value) => ({ value })),
    }));
  }, [product.options, activeVariants]);

  const storageKey = `onlinecompetitions:variant-selection:${product._id}`;

  const findVariantForSelection = (sel: Record<string, string>) => {
    const entries = Object.entries(sel).map(([optionName, value]) => ({ optionName, value }));
    if (entries.length !== options.length) return undefined;
    return activeVariants.find((v) => variantHasAllOptions(v.optionValues, entries));
  };

  const defaultVariant = useMemo(() => {
    return activeVariants.find((v) => v.inventory > 0 || !v.inventoryTracked) ?? activeVariants[0];
  }, [activeVariants]);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, string>;
          if (findVariantForSelection(parsed)) return parsed;
        }
      } catch {
        // ignore
      }
    }
    if (!defaultVariant) return {};
    const opts: Record<string, string> = {};
    for (const ov of defaultVariant.optionValues) {
      opts[ov.optionName] = ov.value;
    }
    return opts;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (Object.keys(selectedOptions).length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(selectedOptions));
      }
    } catch {
      // ignore quota errors
    }
  }, [selectedOptions, storageKey]);

  const selectedVariant = useMemo(
    () => findVariantForSelection(selectedOptions),
    [selectedOptions, activeVariants, options.length]
  );

  useEffect(() => {
    onVariantChange?.(selectedVariant ?? null);
  }, [selectedVariant, onVariantChange]);

  const displayPrice = selectedVariant?.price ?? product.price;
  const displayCompareAtPrice = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const displayInventory = selectedVariant?.inventory ?? product.inventory;
  const displayInventoryTracked = selectedVariant?.inventoryTracked ?? product.inventoryTracked;
  const displaySku = selectedVariant?.sku ?? product.sku;
  const lowStockThreshold = product.lowStockThreshold ?? 5;

  const hasVariants = activeVariants.length > 0 && options.length > 0;
  const isValidSelection = !hasVariants || selectedVariant !== undefined;
  const isOutOfStock = displayInventoryTracked && displayInventory === 0;

  const priceFormatted = `\u00A3${(displayPrice / 100).toFixed(2)}`;
  const comparePriceFormatted =
    displayCompareAtPrice && displayCompareAtPrice > displayPrice
      ? `\u00A3${(displayCompareAtPrice / 100).toFixed(2)}`
      : null;

  const isOptionValueAvailable = (optionName: string, value: string): boolean => {
    if (!hasVariants) return true;
    const candidate = { ...selectedOptions, [optionName]: value };
    const otherSelected = Object.entries(candidate)
      .filter(([k]) => k !== optionName)
      .map(([optionName, value]) => ({ optionName, value }));
    const possible = activeVariants.filter((v) =>
      variantHasAllOptions(v.optionValues, otherSelected)
    );
    if (possible.length === 0) {
      const anyOtherVariantHas = activeVariants.some((v) =>
        variantMatchesOption(v.optionValues, optionName, value)
      );
      return anyOtherVariantHas;
    }
    return possible.some((v) => variantMatchesOption(v.optionValues, optionName, value));
  };

  const getVariantForOptionValue = (
    optionName: string,
    value: string
  ): ShopProductVariantData | null => {
    const candidate = { ...selectedOptions, [optionName]: value };
    const required = Object.entries(candidate).map(([optionName, value]) => ({
      optionName,
      value,
    }));
    return activeVariants.find((v) => variantHasAllOptions(v.optionValues, required)) ?? null;
  };

  function handleSelectOption(optionName: string, value: string) {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: value }));
  }

  return (
    <>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-2xl font-semibold text-gold">{priceFormatted}</span>
        {comparePriceFormatted && (
          <span className="text-sm text-muted-foreground line-through">
            {comparePriceFormatted}
          </span>
        )}
      </div>

      {hasVariants && (
        <div className="mt-6 space-y-5">
          {options.map((option) => {
            const colorLike =
              option.name.toLowerCase() === "color" ||
              option.name.toLowerCase() === "colour" ||
              isOptionColorType(option);
            return (
              <div key={option.name}>
                <div className="mb-3 flex items-baseline gap-2">
                  <p className="text-sm font-medium">{option.name}</p>
                  {selectedOptions[option.name] && (
                    <span className="text-xs text-muted-foreground">
                      {selectedOptions[option.name]}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((optVal) => {
                    const isSelected = selectedOptions[option.name] === optVal.value;
                    const isAvailable = isOptionValueAvailable(option.name, optVal.value);
                    const probeVariant = getVariantForOptionValue(option.name, optVal.value);
                    const isThisSoldOut =
                      probeVariant?.inventoryTracked === true && probeVariant?.inventory === 0;
                    const colorHex = colorLike ? getColorValue(optVal.value) : null;
                    const isLightColor = colorHex
                      ? LIGHT_COLORS.has(colorHex.toLowerCase())
                      : false;
                    const showSoldOutStrike = !isAvailable || isThisSoldOut;
                    return (
                      <button
                        key={optVal.value}
                        type="button"
                        onClick={() => handleSelectOption(option.name, optVal.value)}
                        disabled={!isAvailable}
                        aria-disabled={!isAvailable}
                        className={cn(
                          "transition-all",
                          colorHex
                            ? "h-10 w-10 rounded-full border-2"
                            : "rounded-lg border px-4 py-2 text-sm",
                          isSelected
                            ? "border-gold ring-1 ring-gold"
                            : "border-border hover:border-gold/50",
                          colorHex && isSelected ? "ring-2 ring-offset-2 ring-gold" : "",
                          isLightColor ? "border-gray-300" : "",
                          !isAvailable && "cursor-not-allowed opacity-40",
                          isThisSoldOut && isSelected && "opacity-60 ring-destructive/40"
                        )}
                        style={colorHex ? { backgroundColor: colorHex } : undefined}
                        aria-label={`${option.name}: ${optVal.value}${
                          !isAvailable ? " (unavailable)" : isThisSoldOut ? " (sold out)" : ""
                        }`}
                        title={
                          !isAvailable
                            ? `${optVal.value} — unavailable`
                            : isThisSoldOut
                              ? `${optVal.value} — sold out`
                              : optVal.value
                        }
                      >
                        {!colorHex && (
                          <span className={cn(showSoldOutStrike && "line-through")}>
                            {optVal.value}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {isOutOfStock ? (
          <span className="text-sm text-destructive">Sold out</span>
        ) : displayInventoryTracked &&
          displayInventory > 0 &&
          displayInventory <= lowStockThreshold ? (
          <span className="text-sm text-warning">Low stock ({displayInventory} available)</span>
        ) : displayInventoryTracked && displayInventory > lowStockThreshold ? (
          <span className="text-sm text-success">In stock ({displayInventory} available)</span>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">SKU: {displaySku}</p>

      {hasVariants && !selectedVariant && (
        <p className="mt-3 text-sm text-destructive">This combination is not available</p>
      )}

      <div className="mt-8">
        <AddToCartButton
          productId={product._id}
          variantId={selectedVariant?._id}
          price={displayPrice}
          disabled={isOutOfStock || !isValidSelection}
        />
      </div>
    </>
  );
}

interface ProductImageGalleryProps {
  product: ShopProductData;
  selectedVariant: ShopProductVariantData | null;
}

export function ProductImageGallery({ product, selectedVariant }: ProductImageGalleryProps) {
  const variantImages = selectedVariant?.images?.filter(Boolean) ?? [];
  const useVariantImages = variantImages.length > 0;
  const images = useVariantImages ? variantImages : (product.images ?? []);
  const firstImage = images[0];
  const blurDataUrl =
    !useVariantImages && firstImage ? product.metadata?.imageBlurs?.[firstImage] : undefined;

  if (!firstImage) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-border" />
          <p className="text-sm text-muted-foreground">Product image coming soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
      <Image
        src={firstImage}
        alt={product.name}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover object-center animate-blur-in"
        key={firstImage}
        preload
        placeholder={blurDataUrl ? "blur" : "empty"}
        blurDataURL={blurDataUrl}
      />
      {useVariantImages && (
        <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur">
          {selectedVariant?.name}
        </span>
      )}
    </div>
  );
}
