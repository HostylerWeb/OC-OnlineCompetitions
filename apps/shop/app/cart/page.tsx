"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CART_UPDATED_EVENT, dispatchCartUpdated } from "@/lib/cart-events";
import { cn } from "@/lib/utils";

interface CartProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  metadata?: { imageBlurs?: Record<string, string> };
  sku: string;
  inventory: number;
  inventoryTracked: boolean;
}

interface CartVariantData {
  _id: string;
  name: string;
  sku: string;
  price?: number;
  inventory: number;
  inventoryTracked: boolean;
  images: string[];
  optionValues: { optionName: string; value: string }[];
}

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  priceAtAdd: number;
  product: CartProduct | null;
  variant?: CartVariantData | null;
}

function ShoppingBagIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export default function CartPage() {
  const { isAnonymous, isAuthenticated, isLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCart = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/shop/cart");
      if (!res.ok) throw new Error("Failed to load cart");
      const json = await res.json();
      setItems(json.data.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    fetchCart();
  }, [isLoading, fetchCart]);

  useEffect(() => {
    const handler = () => fetchCart();
    window.addEventListener(CART_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CART_UPDATED_EVENT, handler);
  }, [fetchCart]);

  async function updateQuantity(
    productId: string,
    variantId: string | undefined,
    quantity: number
  ) {
    if (quantity < 0) return;
    if (quantity === 0) {
      await removeItem(productId, variantId);
      return;
    }
    const res = await fetch(`/api/shop/cart/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity, ...(variantId ? { variantId } : {}) }),
    });
    if (res.ok) {
      const json = await res.json();
      setItems(json.data.items);
      dispatchCartUpdated();
    }
  }

  async function removeItem(productId: string, variantId: string | undefined) {
    const url = variantId
      ? `/api/shop/cart/${productId}?variantId=${encodeURIComponent(variantId)}`
      : `/api/shop/cart/${productId}`;
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) {
      const json = await res.json();
      setItems(json.data.items);
      dispatchCartUpdated();
    }
  }

  const subtotal = items.reduce((sum, item) => {
    const price = item.variant?.price ?? item.product?.price ?? item.priceAtAdd;
    return sum + price * item.quantity;
  }, 0);

  if (isLoading) {
    return (
      <main className="oc-container py-12">
        <h1 className="text-2xl font-bold tracking-tight">Shopping Cart</h1>
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="oc-container py-12">
        <h1 className="text-2xl font-bold tracking-tight">Shopping Cart</h1>
        <p className="mt-8 text-center text-muted-foreground">Loading your cart...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="oc-container py-12">
        <h1 className="text-2xl font-bold tracking-tight">Shopping Cart</h1>
        <p className="mt-8 text-center text-muted-foreground">
          Failed to load cart. Please try again.
        </p>
        <div className="mt-4 flex justify-center">
          <Button onClick={fetchCart}>Retry</Button>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="oc-container py-12">
        <h1 className="text-2xl font-bold tracking-tight">Shopping Cart</h1>
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <ShoppingBagIcon className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Your cart is empty</p>
          <Link href="/products" className={cn(buttonVariants({ variant: "default" }))}>
            Browse Products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="oc-container py-12">
      <h1 className="text-2xl font-bold tracking-tight">Shopping Cart</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {items.map((item) => {
            const product = item.product;
            const variant = item.variant;
            const unitPrice = variant?.price ?? product?.price ?? item.priceAtAdd;
            const lineTotal = unitPrice * item.quantity;
            const imageSrc = variant?.images?.[0] ?? product?.images?.[0];

            return (
              <Card key={item.productId}>
                <CardContent className="flex gap-4 p-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={product?.name ?? "Product"}
                        fill
                        className="object-cover animate-blur-in"
                        sizes="80px"
                        loading="lazy"
                        placeholder={product?.metadata?.imageBlurs?.[imageSrc] ? "blur" : "empty"}
                        blurDataURL={product?.metadata?.imageBlurs?.[imageSrc]}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/products/${product?.slug ?? "#"}`}
                          className="text-sm font-medium hover:text-gold transition-colors line-clamp-2"
                        >
                          {product?.name ?? "Unavailable Product"}
                        </Link>
                        {variant && variant.optionValues.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {variant.optionValues.map((ov) => ov.value).join(" / ")}
                          </p>
                        )}
                        {product && (
                          <p className="mt-0.5 text-xs text-muted-foreground">SKU: {product.sku}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-gold">
                        £{(lineTotal / 100).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variantId, item.quantity - 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold"
                          aria-label="Decrease quantity"
                        >
                          <MinusIcon />
                        </button>
                        <span className="flex h-8 w-10 items-center justify-center text-sm font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variantId, item.quantity + 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold"
                          aria-label="Increase quantity"
                        >
                          <PlusIcon />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <TrashIcon />
                        Remove
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold tracking-tight">Order Summary</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">£{(subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-muted-foreground">Calculated at checkout</span>
                </div>
                <hr className="border-border-subtle" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-bold text-gold tabular-nums">
                    £{(subtotal / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {isAuthenticated ? (
                <Link
                  href="/checkout"
                  className={cn(buttonVariants({ variant: "default" }), "mt-6 w-full")}
                >
                  Proceed to Checkout
                </Link>
              ) : isAnonymous ? (
                <>
                  <Link
                    href="/checkout"
                    className={cn(buttonVariants({ variant: "default" }), "mt-6 w-full")}
                  >
                    Guest Checkout
                  </Link>
                  <Link
                    href={`/auth/login?returnTo=/checkout`}
                    className={cn(buttonVariants({ variant: "outline" }), "mt-3 w-full")}
                  >
                    Sign In
                  </Link>
                </>
              ) : (
                <Link
                  href={`/auth/login?returnTo=/checkout`}
                  className={cn(buttonVariants({ variant: "default" }), "mt-6 w-full")}
                >
                  Login to Checkout
                </Link>
              )}

              <Link
                href="/products"
                className={cn(buttonVariants({ variant: "outline" }), "mt-3 w-full")}
              >
                Continue Shopping
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
