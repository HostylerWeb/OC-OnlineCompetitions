"use client";

import type { AdminReferralPurchase } from "@oc/types";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerReferralHistoryProps {
  purchases: AdminReferralPurchase[];
  isLoading?: boolean;
}

export function CustomerReferralHistory({ purchases, isLoading }: CustomerReferralHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Referral History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!purchases || purchases.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Referral History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {purchases.slice(0, 5).map((p) => (
            <div
              key={p._id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-mono text-xs font-medium">{p.referredEmail}</span>
                <span className="text-[10px] text-muted-foreground">
                  {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge variant={p.isActive ? "success" : "draft"} className="text-[10px]">
                  {p.isActive ? "Active" : "Inactive"}
                </StatusBadge>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {p.ticketsAwarded ?? 0} tickets
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
