"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  LocalPanel,
  PaymentMethodSelector,
  PaytriotPanel,
  StripePanel,
} from "@/components/checkout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CART_UPDATED_EVENT } from "@/lib/cart-events";
import { cn } from "@/lib/utils";

interface CartProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  sku: string;
}

interface CartItem {
  productId: string;
  quantity: number;
  priceAtAdd: number;
  product: CartProduct | null;
}

interface ShippingForm {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
}

function CancelledNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (searchParams.get("cancelled") !== "1") return null;

  return (
    <div
      role="status"
      className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4"
    >
      <p className="text-sm">Payment cancelled — you have not been charged.</p>
      <button
        type="button"
        onClick={() => router.replace("/checkout")}
        className="shrink-0 text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAnonymous } = useAuth();
  // Stable per-mount idempotency key: the server keys the pending order on
  // it, so automatic retries of this POST converge on the same order instead
  // of creating duplicates.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const submittingRef = useRef(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState<ShippingForm>({
    firstName: "",
    lastName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    country: "GB",
  });
  const [email, setEmail] = useState(isAnonymous ? "" : (user?.email ?? ""));
  const [selectedProvider, setSelectedProvider] = useState("local");
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({});

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/cart");
      if (!res.ok) throw new Error("Failed to load cart");
      const json = await res.json();
      const cartItems: CartItem[] = json.data.items;
      if (cartItems.length === 0) {
        router.replace("/cart");
        return;
      }
      setItems(cartItems);
    } catch {
      router.replace("/cart");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    const handler = () => fetchCart();
    window.addEventListener(CART_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CART_UPDATED_EVENT, handler);
  }, [fetchCart]);

  function updateField(field: keyof ShippingForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  const needsEmail = isAnonymous;

  function validate(): boolean {
    const newErrors: Partial<Record<keyof ShippingForm, string>> = {};
    const required: (keyof ShippingForm)[] = [
      "firstName",
      "lastName",
      "addressLine1",
      "city",
      "postcode",
      "country",
    ];

    for (const field of required) {
      if (!form[field].trim()) {
        newErrors[field] = "Required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Single-flight guard: retries from the fetch below must reuse the
    // idempotency key, but a second simultaneous submit must not fire.
    if (submittingRef.current) return;
    if (!validate()) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");

    let redirecting = false;
    try {
      const orderEmail = email.trim() || user?.email || "";
      if (needsEmail && !orderEmail) {
        setSubmitError("Email is required for guest checkout.");
        return;
      }

      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          email: orderEmail,
          shippingAddress: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            addressLine1: form.addressLine1.trim(),
            addressLine2: form.addressLine2.trim() || undefined,
            city: form.city.trim(),
            postcode: form.postcode.trim(),
            country: form.country,
          },
          provider: selectedProvider,
          idempotencyKey,
        }),
      });

      const json: {
        data?: { checkoutUrl?: string; orderId?: string };
        error?: { message?: string };
      } | null = await res.json().catch(() => null);

      if (!res.ok || !json) {
        throw new Error(json?.error?.message ?? "Checkout failed");
      }

      const { checkoutUrl, orderId } = json.data ?? {};
      if (checkoutUrl) {
        redirecting = true;
        setRedirecting(true);
        window.location.href = checkoutUrl;
        return;
      }

      if (!orderId) {
        throw new Error("The server did not return an order reference. Please try again.");
      }

      router.push(`/orders/${orderId}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      // Keep the button locked while the browser follows the provider
      // redirect; release it for real errors / non-redirect success.
      if (!redirecting) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }

  if (loading) {
    return (
      <main className="oc-container py-12">
        <p className="text-center text-muted-foreground">Loading checkout...</p>
      </main>
    );
  }

  const subtotal = items.reduce((sum, item) => {
    const price = item.product?.price ?? item.priceAtAdd;
    return sum + price * item.quantity;
  }, 0);

  const inputClass =
    "block w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-colors";
  const inputErrorClass =
    "border-destructive/50 focus:border-destructive/50 focus:ring-destructive/20";
  const labelClass = "block text-sm font-medium";

  return (
    <main className="oc-container py-12">
      <Suspense fallback={null}>
        <CancelledNotice />
      </Suspense>
      <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>

      <form onSubmit={handleSubmit} className="mt-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            {needsEmail && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-sm font-semibold tracking-tight">Contact</h2>
                  <div className="mt-4 space-y-2">
                    <label htmlFor="email" className={labelClass}>
                      Email <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className={inputClass}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your order confirmation will be sent here
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold tracking-tight">Shipping Address</h2>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className={labelClass}>
                      First Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      className={cn(inputClass, errors.firstName && inputErrorClass)}
                      value={form.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">{errors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className={labelClass}>
                      Last Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      className={cn(inputClass, errors.lastName && inputErrorClass)}
                      value={form.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-destructive">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label htmlFor="addressLine1" className={labelClass}>
                    Address Line 1 <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="addressLine1"
                    type="text"
                    placeholder="123 Main Street"
                    className={cn(inputClass, errors.addressLine1 && inputErrorClass)}
                    value={form.addressLine1}
                    onChange={(e) => updateField("addressLine1", e.target.value)}
                  />
                  {errors.addressLine1 && (
                    <p className="text-xs text-destructive">{errors.addressLine1}</p>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <label htmlFor="addressLine2" className={labelClass}>
                    Address Line 2 <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="addressLine2"
                    type="text"
                    placeholder="Apt, Suite, etc."
                    className={cn(inputClass, errors.addressLine2 && inputErrorClass)}
                    value={form.addressLine2}
                    onChange={(e) => updateField("addressLine2", e.target.value)}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="city" className={labelClass}>
                      City <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="city"
                      type="text"
                      placeholder="London"
                      className={cn(inputClass, errors.city && inputErrorClass)}
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                    />
                    {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="postcode" className={labelClass}>
                      Postcode <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="postcode"
                      type="text"
                      placeholder="SW1A 1AA"
                      className={cn(inputClass, errors.postcode && inputErrorClass)}
                      value={form.postcode}
                      onChange={(e) => updateField("postcode", e.target.value)}
                    />
                    {errors.postcode && (
                      <p className="text-xs text-destructive">{errors.postcode}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label htmlFor="country" className={labelClass}>
                    Country <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="country"
                    className={cn(inputClass, "text-foreground", errors.country && inputErrorClass)}
                    value={form.country}
                    onChange={(e) => updateField("country", e.target.value)}
                  >
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="IT">Italy</option>
                    <option value="ES">Spain</option>
                    <option value="NL">Netherlands</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold tracking-tight">Order Summary</h2>

                <div className="mt-6 space-y-3">
                  {items.map((item) => {
                    const price = item.product?.price ?? item.priceAtAdd;
                    return (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground line-clamp-1">
                          {item.product?.name ?? "Unavailable Product"}
                          <span className="text-muted-foreground/60"> ×{item.quantity}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground">
                          £{((price * item.quantity) / 100).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <hr className="my-4 border-border-subtle" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">£{(subtotal / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-muted-foreground">Free</span>
                  </div>
                  <hr className="border-border-subtle" />
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total</span>
                    <span className="text-xl font-bold text-gold tabular-nums">
                      £{(subtotal / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <PaymentMethodSelector
                    selected={selectedProvider}
                    onSelect={setSelectedProvider}
                  />

                  {selectedProvider === "paytriot" && <PaytriotPanel />}
                  {selectedProvider === "stripe" && (
                    <StripePanel
                      isSubmitting={submitting || redirecting}
                      errorMessage={submitError}
                    />
                  )}
                  {selectedProvider === "local" && <LocalPanel />}
                </div>

                {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}

                <Button type="submit" disabled={submitting || redirecting} className="mt-6 w-full">
                  {redirecting
                    ? "Redirecting..."
                    : submitting
                      ? "Placing order..."
                      : `Place Order — £${(subtotal / 100).toFixed(2)}`}
                </Button>

                <Link
                  href="/cart"
                  className={cn(buttonVariants({ variant: "outline" }), "mt-3 w-full")}
                >
                  Back to Cart
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </main>
  );
}
