"use client";

import { useAdminUserCompliance } from "@oc/api-admin";
import { formatDate } from "@oc/utils";
import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface SpendLimitsProps {
  userId: string;
}

export function SpendLimits({ userId }: SpendLimitsProps) {
  const { data: complianceResponse, isLoading } = useAdminUserCompliance(userId);
  const compliance = complianceResponse?.data;

  const spendProgress = useMemo(() => {
    if (!compliance?.monthlySpendLimit || compliance.monthlySpendLimit <= 0) return 0;
    return Math.min(100, (compliance.monthlySpendThisMonth / compliance.monthlySpendLimit) * 100);
  }, [compliance?.monthlySpendLimit, compliance?.monthlySpendThisMonth]);

  const creditProgress = useMemo(() => {
    if (!compliance?.creditCardMonthlyLimitGBP || compliance.creditCardMonthlyLimitGBP <= 0) {
      return 0;
    }
    return Math.min(
      100,
      (compliance.creditCardSpendThisMonth / compliance.creditCardMonthlyLimitGBP) * 100
    );
  }, [compliance?.creditCardMonthlyLimitGBP, compliance?.creditCardSpendThisMonth]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Card className="gap-0 border-border/70 py-0 shadow-sm">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
        <Card className="gap-0 border-border/70 py-0 shadow-sm">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!compliance) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Monthly spend limit */}
      <Card className="gap-0 border-border/70 py-0 shadow-sm">
        <CardHeader className="gap-1 px-4 pb-2 pt-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Monthly spend
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-0">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">
              £{compliance.monthlySpendThisMonth.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">
              {compliance.monthlySpendLimit != null
                ? `of £${compliance.monthlySpendLimit.toFixed(2)}`
                : "no limit set"}
            </span>
          </div>
          {compliance.monthlySpendLimit != null && compliance.monthlySpendLimit > 0 ? (
            <>
              <Progress value={spendProgress} className="h-1.5" />
              <span className="text-[11px] text-muted-foreground">
                {spendProgress.toFixed(0)}% of monthly limit used
              </span>
            </>
          ) : null}
          {compliance.pendingMonthlySpendLimit != null ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
              Pending increase to £{compliance.pendingMonthlySpendLimit.toFixed(2)} effective{" "}
              {formatDate(compliance.monthlySpendLimitEffectiveAt ?? "")}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Credit card limit */}
      {compliance.creditCardMonthlyLimitGBP != null ? (
        <Card className="gap-0 border-border/70 py-0 shadow-sm">
          <CardHeader className="gap-1 px-4 pb-2 pt-4">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Credit card monthly cap
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-0">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">
                £{compliance.creditCardSpendThisMonth.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">
                of £{compliance.creditCardMonthlyLimitGBP.toFixed(2)}
              </span>
            </div>
            <Progress value={creditProgress} className="h-1.5" />
            <span className="text-[11px] text-muted-foreground">
              {creditProgress.toFixed(0)}% of cap used
            </span>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
