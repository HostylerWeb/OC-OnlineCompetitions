"use client";

import type { AdminUserComplianceState } from "@oc/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerComplianceSectionProps {
  compliance: AdminUserComplianceState | null;
  isLoading: boolean;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">
        {typeof value === "boolean" ? (
          value ? (
            <Badge className="bg-green-600 text-white text-[10px]">Yes</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              No
            </Badge>
          )
        ) : (
          (value ?? "—")
        )}
      </span>
    </div>
  );
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `£${Number(amount).toFixed(2)}`;
}

function ComplianceSkeleton() {
  return (
    <Card className="bg-muted/20">
      <CardContent className="flex flex-col gap-3 px-5 py-5">
        <Skeleton className="h-5 w-28" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CustomerComplianceSection({
  compliance,
  isLoading,
}: CustomerComplianceSectionProps) {
  if (isLoading) return <ComplianceSkeleton />;
  if (!compliance) return null;

  return (
    <section aria-label="Compliance">
      <Card className="bg-muted/20">
        <CardContent className="flex flex-col gap-3 px-5 py-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Safer play</span>
            {compliance.selfExcluded ? (
              <Badge variant="destructive" className="text-[10px]">
                Self-excluded
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <InfoRow label="Age verified" value={compliance.isAgeVerified} />
            <InfoRow
              label="Monthly spend limit"
              value={formatCurrency(compliance.monthlySpendLimit)}
            />
            <InfoRow
              label="Spent this month"
              value={formatCurrency(compliance.monthlySpendThisMonth)}
            />
            <InfoRow label="Completed orders" value={compliance.completedOrderCount} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
