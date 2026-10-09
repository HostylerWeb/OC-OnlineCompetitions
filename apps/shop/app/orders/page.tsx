import { getServerSession } from "@oc/auth-admin";
import { formatOrderNumber } from "@oc/utils";
import { TriangleAlert } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { fetchOrders } from "@/lib/api";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "My Orders — Online Competitions Shop",
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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const headers = new Headers();
  headers.set("cookie", cookieStore.toString());
  const user = await getServerSession("client", headers);
  if (!user || user.isAnonymous) {
    redirect("/auth/login");
  }

  const params = await searchParams;
  const currentPage = typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1;

  let orders: any[] = [];
  let meta: any = null;
  let error = false;
  try {
    const res = await fetchOrders({ page: currentPage, limit: 10 });
    orders = res.data;
    meta = res.meta;
  } catch {
    error = true;
  }

  return (
    <main className="oc-container py-12">
      <h1 className="text-2xl font-bold tracking-tight">My Orders</h1>

      {error ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <TriangleAlert className="h-5 w-5 text-gold" />
          <p className="text-muted-foreground">Something went wrong loading your orders.</p>
          <Link href="/orders" className="text-sm text-gold transition-colors hover:text-gold/80">
            Try again
          </Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="text-muted-foreground">No orders yet.</p>
          <Link href="/products" className={buttonVariants()}>
            Start Shopping
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-4">
            {orders.map((order) => (
              <div
                key={order._id}
                className="flex items-center justify-between rounded-xl border border-border-subtle bg-card p-5"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-sm text-muted-foreground">
                    {formatOrderNumber(order.orderNumber)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {order.items.reduce((s: number, i: any) => s + i.quantity, 0)} items
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={statusVariant[order.status] ?? "secondary"}>{order.status}</Badge>
                  <span className="text-gold font-semibold">{formatPrice(order.total)}</span>
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

          {meta && meta.pages > 1 && (
            <div className="mt-12 flex justify-center gap-2">
              {Array.from({ length: meta.pages }, (_, i) => i + 1).map((page) => (
                <Link
                  key={page}
                  href={page === 1 ? "/orders" : `/orders?page=${page}`}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors",
                    page === currentPage
                      ? "bg-gold text-black font-medium"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  {page}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
