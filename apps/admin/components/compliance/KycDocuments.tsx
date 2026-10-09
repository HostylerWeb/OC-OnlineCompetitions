"use client";

import { useAdminUserCompliance } from "@oc/api-admin";
import { FileText } from "@oc/icons";
import { formatDate } from "@oc/utils";
import { Card, CardContent } from "@/components/ui/card";

interface KycDocumentsProps {
  userId: string;
}

export function KycDocuments({ userId }: KycDocumentsProps) {
  const { data: complianceResponse, isLoading } = useAdminUserCompliance(userId);
  const compliance = complianceResponse?.data;

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

  // No KYC documents field in AdminUserComplianceState — show empty state
  return (
    <Card className="gap-0 border-border/70 py-0 shadow-sm">
      <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
        <FileText className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No KYC documents on file.</p>
        {compliance.isAgeVerified ? (
          <p className="text-xs text-muted-foreground">
            Age verified {compliance.ageVerifiedAt ? formatDate(compliance.ageVerifiedAt) : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
