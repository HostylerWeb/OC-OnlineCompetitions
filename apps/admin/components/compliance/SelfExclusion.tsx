"use client";

import { useAdminUserCompliance } from "@oc/api-admin";
import { Clock } from "@oc/icons";
import { formatDate } from "@oc/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SelfExclusionProps {
  userId: string;
}

export function SelfExclusion({ userId }: SelfExclusionProps) {
  const { data: complianceResponse, isLoading } = useAdminUserCompliance(userId);
  const compliance = complianceResponse?.data;

  const exclusionLabel = compliance?.effectiveSelfExcluded
    ? compliance.selfExcludedPermanent
      ? "Permanently excluded"
      : `Excluded until ${formatDate(compliance.selfExcludedUntil ?? "")}`
    : compliance?.selfExcluded
      ? "Expired (pending reconcile)"
      : "Active";

  if (isLoading) {
    return (
      <Card className="gap-0 border-border/70 py-0 shadow-sm">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!compliance) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Self-exclusion status */}
      <Card className="gap-0 border-border/70 py-0 shadow-sm">
        <CardHeader className="gap-1 px-4 pb-2 pt-4">
          <Clock className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-4 pb-4 pt-0">
          <Badge
            variant={compliance.effectiveSelfExcluded ? "destructive" : "outline"}
            className="w-fit"
          >
            {exclusionLabel}
          </Badge>
          {compliance.selfExcludedAt ? (
            <p className="text-xs text-muted-foreground">
              Since {formatDate(compliance.selfExcludedAt ?? "")}
            </p>
          ) : null}
          {compliance.selfExcludedUntil && !compliance.selfExcludedPermanent ? (
            <p className="text-xs text-muted-foreground">
              Expires {formatDate(compliance.selfExcludedUntil ?? "")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
