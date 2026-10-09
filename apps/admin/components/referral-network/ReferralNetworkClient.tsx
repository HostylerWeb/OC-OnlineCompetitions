"use client";

import type { ReferralMindmapResponse } from "@oc/api-referrals/mindmap";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminReferralMindmap } from "@/hooks/use-admin-referral-mindmap";
import { setEdgeIdInUrl } from "./focus";
import { ReferralDetailSheet } from "./ReferralDetailSheet";
import { useFocusState } from "./use-focus-state";

const ReferralMindmapCanvas = dynamic(
  () => import("./ReferralMindmapCanvas").then((mod) => mod.ReferralMindmapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center text-xs text-muted-foreground">
        Loading graph…
      </div>
    ),
  }
);

interface ReferralNetworkClientProps {
  initialData: ReferralMindmapResponse;
  selectedUserIdFromUrl: string | null;
}

export function ReferralNetworkClient({
  initialData,
  selectedUserIdFromUrl,
}: ReferralNetworkClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusApi = useFocusState();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(selectedUserIdFromUrl);
  const initialEdgeId = searchParams.get("edge");
  const [selectedEdgeId, setSelectedEdgeIdState] = useState<string | null>(initialEdgeId);

  const { data, isLoading } = useAdminReferralMindmap({
    depth: 5,
    includeInactive: true,
    includeDeleted: false,
  });

  const merged = useMemo<ReferralMindmapResponse>(() => data ?? initialData, [data, initialData]);

  const node = useMemo(() => {
    if (!selectedUserId) return null;
    return merged.nodes.find((n) => n.id === selectedUserId) ?? null;
  }, [merged.nodes, selectedUserId]);

  useEffect(() => {
    setSelectedUserId(selectedUserIdFromUrl);
  }, [selectedUserIdFromUrl]);

  useEffect(() => {
    setSelectedEdgeIdState(initialEdgeId);
  }, [initialEdgeId]);

  const updateEdgeUrl = useCallback(
    (edgeId: string | null) => {
      const next = setEdgeIdInUrl(new URLSearchParams(searchParams.toString()), edgeId);
      const qs = next.toString();
      router.replace(`/referrals/network${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleSelectEdge = useCallback(
    (id: string | null) => {
      setSelectedEdgeIdState(id);
      updateEdgeUrl(id);
    },
    [updateEdgeUrl]
  );

  return (
    <>
      <div className="relative h-[78vh] min-h-0 w-full overflow-hidden rounded-lg border bg-background">
        <ReferralMindmapCanvas
          initialData={merged}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={handleSelectEdge}
        />
        {isLoading && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-md border bg-background/80 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
            Refreshing…
          </div>
        )}
      </div>
      <ReferralDetailSheet
        userId={selectedUserId}
        node={node}
        open={!!selectedUserId}
        onFocusUser={(id) => focusApi.setFocusedNodes([id])}
        onOpenChange={(o) => {
          if (!o) setSelectedUserId(null);
        }}
      />
    </>
  );
}
