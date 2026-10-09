"use client";

import { Wallet } from "@oc/icons";
import type { Balance } from "@oc/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerBalanceSectionProps {
  balance: Balance | null;
  isLoading: boolean;
}

function BalanceSkeleton() {
  return (
    <Card className="bg-muted/20">
      <CardContent className="flex flex-col gap-3 px-5 py-5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  );
}

export function CustomerBalanceSection({ balance, isLoading }: CustomerBalanceSectionProps) {
  if (isLoading) return <BalanceSkeleton />;
  if (!balance) return null;

  return (
    <section aria-label="Wallet balance">
      <Card className="bg-muted/20">
        <CardContent className="flex flex-col gap-2 px-5 py-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Wallet className="size-4 text-gold" aria-hidden="true" />
            Site credit
          </div>
          <p className="text-2xl font-bold tabular-nums">£{Number(balance.available).toFixed(2)}</p>
          {balance.pending > 0 ? (
            <p className="text-xs text-muted-foreground">{balance.pending.toFixed(2)} pending</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
