import { getServerSession } from "@oc/auth-admin";
import { formatOrderNumber } from "@oc/utils";
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { fetchOrders } from "@/lib/api";

export const metadata: Metadata = {
  title: "Account — Online Competitions Shop",
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "success" | "warning"
> = {
  paid: "success",
  pending: "warning",
  processing: "default",
  shipped: "default",
  delivered: "success",
  cancelled: "destructive",
  refunded: "destructive",
};

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const headers = new Headers();
  headers.set("cookie", cookieStore.toString());
  const user = await getServerSession("client", headers);

  if (!user || user.isAnonymous) {
    redirect("/auth/login");
  }

  let orders: any[] = [];
  let error = false;
  try {
    const res = await fetchOrders({ page: 1, limit: 5 });
    orders = res.data;
  } catch {
    error = true;
  }

  const displayName = user.name ?? user.firstName ?? user.email;

  return (
    <main className="oc-container py-12">
      <h1 className="text-2xl font-bold tracking-tight">My Account</h1>

      <div className="mt-8 space-y-4">
        {displayName && (
          <div className="rounded-xl border border-border-subtle bg-card p-6">
            <h2 className="text-sm font-medium text-muted-foreground">Name</h2>
            <p className="mt-1 text-foreground">{displayName}</p>
          </div>
        )}
        <div className="rounded-xl border border-border-subtle bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Email</h2>
          <p className="mt-1 text-foreground">{user.email}</p>
        </div>
      </div>

      {/* Recent Orders */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent Orders</h2>
          {orders.length > 0 && (
            <Link href="/orders" className="text-sm text-gold transition-colors hover:text-gold/80">
              View all orders
            </Link>
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-border-subtle bg-card p-6">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-gold" />
              <p className="text-sm text-muted-foreground">Could not load your recent orders.</p>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border-subtle bg-card p-6">
            <p className="text-sm text-muted-foreground">
              No orders yet.{" "}
              <Link href="/products" className="text-gold transition-colors hover:text-gold/80">
                Start shopping!
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {orders.map((order) => (
              <div
                key={order._id}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-card p-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatOrderNumber(order.orderNumber)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant[order.status] ?? "secondary"}>{order.status}</Badge>
                  <span className="text-sm font-semibold text-gold">
                    {formatPrice(order.total)}
                  </span>
                  <Link
                    href={`/orders/${order._id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
