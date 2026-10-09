"use client";

import { api } from "@oc/api-admin";
import type { AdminOrder } from "@oc/types";
import { formatDate, OrderNumberCell } from "@oc/utils";
import { useQuery } from "@tanstack/react-query";
import { PriceCell } from "@/components/admin/PriceCell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerOrdersSectionProps {
  customerId: string | undefined;
}

function CustomerOrdersSectionSkeleton() {
  return (
    <Card className="bg-muted/20">
      <CardContent className="flex flex-col gap-3 px-5 py-5">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  );
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
  refunded: "secondary",
};

export function CustomerOrdersSection({ customerId }: CustomerOrdersSectionProps) {
  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ["admin", "customer-orders", customerId],
    queryFn: () => {
      const p: Record<string, string | number | boolean> = {
        limit: 5,
        page: 1,
        sortField: "createdAt",
        sortDir: "desc",
      };
      if (customerId) p.userId = customerId;
      return api.get<AdminOrder[]>("/api/admin/orders", { params: p });
    },
    enabled: !!customerId,
  });

  const orders = ordersRes?.data ?? [];

  if (!customerId) {
    return (
      <section aria-label="Orders">
        <Card className="bg-muted/20">
          <CardContent className="flex flex-col gap-3 px-5 py-5">
            <p className="text-sm text-muted-foreground">No orders available.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section aria-label="Orders">
        <CustomerOrdersSectionSkeleton />
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <section aria-label="Orders">
        <Card className="bg-muted/20">
          <CardContent className="flex flex-col gap-3 px-5 py-5">
            <p className="text-sm font-medium text-muted-foreground">Recent orders</p>
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-label="Orders">
      <Card className="bg-muted/20">
        <CardContent className="flex flex-col gap-2 px-5 py-5">
          <p className="text-sm font-medium text-muted-foreground">Recent orders</p>
          <div className="flex flex-col gap-2">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order._id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <OrderNumberCell value={order.orderNumber} />
                    <Badge
                      variant={statusBadgeVariant[order.status] ?? "outline"}
                      className="text-[10px]"
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </span>
                </div>
                <div className="text-sm font-semibold tabular-nums shrink-0">
                  <PriceCell value={order.total} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export { CustomerOrdersSectionSkeleton };
