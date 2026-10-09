"use client";

import type { ReferralMindmapResponse } from "@oc/api-referrals/mindmap";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { ReferralNetworkClient } from "@/components/referral-network/ReferralNetworkClient";
import { Skeleton } from "@/components/ui/skeleton";

function ReferralNetworkPageContent() {
  const searchParams = useSearchParams();
  const userParam = searchParams.get("user");
  const selectedUserIdFromUrl = userParam ?? null;

  const initialQuery = useQuery<ReferralMindmapResponse>({
    queryKey: ["admin-referral-mindmap-server", "initial"],
    queryFn: async () => {
      const params = new URLSearchParams({
        depth: "5",
        includeInactive: "true",
        includeDeleted: "false",
      });
      const res = await fetch(`/api/admin/referral-mindmap?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`Failed to load referral network (${res.status})`);
      }
      const json = (await res.json()) as
        | { ok?: boolean; data: ReferralMindmapResponse }
        | ReferralMindmapResponse;
      return "data" in json && json.data ? json.data : (json as ReferralMindmapResponse);
    },
    staleTime: 0,
    refetchOnMount: false,
  });

  if (initialQuery.isError) {
    return (
      <PageShell
        title="Referral Network"
        description="Hierarchical visualization of every referral purchase, signup, and ticket award in the system."
      >
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          Failed to load mindmap. Try refreshing the page.
        </div>
      </PageShell>
    );
  }

  if (!initialQuery.data) {
    return (
      <PageShell
        title="Referral Network"
        description="Hierarchical visualization of every referral purchase, signup, and ticket award in the system."
      >
        <Skeleton className="h-[78vh] w-full rounded-lg" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Referral Network"
      description="Hierarchical visualization of every referral purchase, signup, and ticket award in the system."
    >
      <ReferralNetworkClient
        initialData={initialQuery.data}
        selectedUserIdFromUrl={selectedUserIdFromUrl}
      />
    </PageShell>
  );
}

export default function ReferralNetworkPage() {
  return (
    <Suspense
      fallback={
        <PageShell
          title="Referral Network"
          description="Hierarchical visualization of every referral purchase, signup, and ticket award in the system."
        >
          <Skeleton className="h-[78vh] w-full rounded-lg" />
        </PageShell>
      }
    >
      <ReferralNetworkPageContent />
    </Suspense>
  );
}
