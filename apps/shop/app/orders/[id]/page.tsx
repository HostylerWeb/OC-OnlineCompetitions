import { getServerSession } from "@oc/auth-admin";
import { formatOrderNumber } from "@oc/utils";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderPaymentStatus } from "@/components/orders/OrderPaymentStatus";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchOrder, type ShopOrderData } from "@/lib/api";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const headers = new Headers();
  headers.set("cookie", cookieStore.toString());
  const user = await getServerSession("client", headers);

  const { id } = await params;
  const sp = await searchParams;
  const stripeSuccess = sp.stripe_success === "1";
  const hasReturnTo = typeof sp.returnTo === "string" && sp.returnTo !== "";

  // Guests who just paid (or were routed back here via returnTo) must be able
  // to see this order without an account; otherwise require login.
  if (!user || user.isAnonymous) {
    if (!stripeSuccess && !hasReturnTo) {
      redirect(`/auth/login?returnTo=${encodeURIComponent(`/orders/${id}`)}`);
    }
  }

  let order: ShopOrderData & { isGuestCheckout?: boolean };
  try {
    const res = await fetchOrder(id);
    order = res.data;
  } catch {
    notFound();
  }

  return (
    <main className="oc-container py-12">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        ← Orders
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Order <span className="font-mono">{formatOrderNumber(order.orderNumber)}</span>
        </h1>
        <OrderPaymentStatus
          orderId={order._id}
          initialStatus={order.status}
          providerSessionId={order.providerSessionId ?? null}
          stripeSuccess={stripeSuccess}
        />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">Placed on {formatDate(order.createdAt)}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold tracking-tight">Items</h2>

              <div className="mt-4">
                <div className="hidden md:grid md:grid-cols-[1fr_6rem_4rem_6rem_6rem] md:gap-4 md:pb-2 md:border-b md:border-border-subtle">
                  <span className="text-xs font-medium text-muted-foreground">Product</span>
                  <span className="text-xs font-medium text-muted-foreground">SKU</span>
                  <span className="text-xs font-medium text-muted-foreground text-right">Qty</span>
                  <span className="text-xs font-medium text-muted-foreground text-right">
                    Price
                  </span>
                  <span className="text-xs font-medium text-muted-foreground text-right">
                    Total
                  </span>
                </div>

                <div className="divide-y divide-border-subtle">
                  {order.items.map((item, i) => {
                    const total = item.unitPrice * item.quantity;
                    return (
                      <div
                        key={item.productId ?? i}
                        className="grid grid-cols-2 gap-2 py-4 md:grid-cols-[1fr_6rem_4rem_6rem_6rem] md:gap-4 md:items-center"
                      >
                        <span className="col-span-2 text-sm font-medium md:col-span-1">
                          {item.productSnapshot?.name ?? "Product"}
                        </span>
                        <span className="text-xs text-muted-foreground md:text-sm">
                          {item.productSnapshot?.sku ?? " - "}
                        </span>
                        <span className="text-right text-sm tabular-nums md:text-left">
                          {item.quantity}
                        </span>
                        <span className="text-right text-sm text-gold tabular-nums">
                          £{(item.unitPrice / 100).toFixed(2)}
                        </span>
                        <span className="text-right text-sm font-medium text-gold tabular-nums">
                          £{(total / 100).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold tracking-tight">Shipping Address</h2>
              <address className="mt-3 not-italic text-sm leading-relaxed text-muted-foreground">
                <p>
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </p>
                <p>{order.shippingAddress.addressLine1}</p>
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.postcode}
                </p>
                <p>{order.shippingAddress.country}</p>
              </address>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold tracking-tight">Order Summary</h2>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">£{(order.subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-muted-foreground">Free</span>
                </div>
                <hr className="border-border-subtle" />
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold text-gold tabular-nums">
                    £{(order.total / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <Link
                href="/products"
                className={cn(buttonVariants({ variant: "default" }), "mt-6 w-full")}
              >
                Continue Shopping
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {order.isGuestCheckout && (
        <div className="mt-8 rounded-xl border border-gold/20 bg-gold/10 p-6 backdrop-blur-sm">
          <h2 className="font-semibold">Claim Your Account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account to track your orders and view your order history. Your order is safe
            and will be linked when you sign up.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href={`/auth/sign-up?returnTo=/dashboard`}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Create Account
            </Link>
            <Link
              href={`/auth/login?returnTo=/dashboard`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
