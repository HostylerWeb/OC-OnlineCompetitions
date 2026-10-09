"use client";

import { useAdminUserCompliance } from "@oc/api-admin";
import { formatDate } from "@oc/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ComplianceOverviewProps {
  userId: string;
}

export function ComplianceOverview({ userId }: ComplianceOverviewProps) {
  const { data: complianceResponse, isLoading } = useAdminUserCompliance(userId);
  const compliance = complianceResponse?.data;

  const exclusionLabel = compliance?.effectiveSelfExcluded
    ? compliance.selfExcludedPermanent
      ? "Permanent exclusion"
      : `Excluded until ${formatDate(compliance.selfExcludedUntil ?? "")}`
    : compliance?.selfExcluded
      ? "Expired (pending reconcile)"
      : "Not excluded";

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="py-0">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Loading...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!compliance) {
    return null;
  }

  return (
    <div className="grid items-stretch gap-3 sm:grid-cols-2">
      {/* Age Verification */}
      <Card className="gap-0 border-border/70 py-0 shadow-sm">
        <CardHeader className="gap-1 px-4 pb-2 pt-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Age verification
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 px-4 pb-4 pt-0">
          <Badge variant={compliance.isAgeVerified ? "default" : "secondary"} className="w-fit">
            {compliance.isAgeVerified ? "Verified" : "Not verified"}
          </Badge>
          {compliance.ageVerifiedAt ? (
            <span className="text-xs text-muted-foreground">
              Verified {formatDate(compliance.ageVerifiedAt ?? "")}
            </span>
          ) : null}
        </CardContent>
      </Card>

      {/* Self-Exclusion */}
      <Card className="gap-0 border-border/70 py-0 shadow-sm">
        <CardHeader className="gap-1 px-4 pb-2 pt-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Self-exclusion
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 px-4 pb-4 pt-0">
          <Badge
            variant={compliance.effectiveSelfExcluded ? "destructive" : "outline"}
            className="w-fit"
          >
            {exclusionLabel}
          </Badge>
          {compliance.selfExcludedAt ? (
            <span className="text-xs text-muted-foreground">
              Since {formatDate(compliance.selfExcludedAt ?? "")}
            </span>
          ) : null}
        </CardContent>
      </Card>

      {/* Spend Limit */}
      <Card className="gap-0 border-border/70 py-0 shadow-sm">
        <CardHeader className="gap-1 px-4 pb-2 pt-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Monthly spend limit
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 px-4 pb-4 pt-0">
          {compliance.monthlySpendLimit != null ? (
            <>
              <span className="text-sm font-semibold text-foreground">
                £{compliance.monthlySpendLimit.toFixed(2)}
              </span>
              {compliance.spendLimitRequired ? (
                <span className="text-xs text-warning">Limit required before next purchase</span>
              ) : null}
            </>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">Not set</span>
          )}
        </CardContent>
      </Card>

      {/* Feature flags warning */}
      {!compliance.featureFlags.enforcementActive ? (
        <Card className="sm:col-span-2 gap-0 border-gold/30 bg-gold/[0.03] py-0 shadow-sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-sm font-medium text-gold">Compliance enforcement off</span>
            <span className="text-xs text-muted-foreground">
              Rules may not block checkout until enforcement is enabled.
            </span>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
