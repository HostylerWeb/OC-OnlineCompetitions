"use client";

import type { ReferralMindmapResponse } from "@oc/api-referrals/mindmap";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";

interface UseAdminReferralMindmapOptions {
  rootUserId?: string | null;
  depth?: number;
  includeInactive?: boolean;
  includeDeleted?: boolean;
  enabled?: boolean;
}

export function useAdminReferralMindmap(
  options: UseAdminReferralMindmapOptions = {}
): UseQueryResult<ReferralMindmapResponse> {
  const enabled = options.enabled !== false;
  return useQuery({
    queryKey: [
      "admin-referral-mindmap",
      options.rootUserId ?? null,
      options.depth ?? 5,
      options.includeInactive ?? false,
      options.includeDeleted ?? false,
    ],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.rootUserId) params.set("rootUserId", options.rootUserId);
      params.set("depth", String(options.depth ?? 5));
      params.set("includeInactive", options.includeInactive ? "true" : "false");
      params.set("includeDeleted", options.includeDeleted ? "true" : "false");

      const url = `/api/admin/referral-mindmap?${params.toString()}`;
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) {
        throw new Error(`Failed to load referral mindmap (${res.status})`);
      }
      const json = (await res.json()) as
        | { ok?: boolean; data: ReferralMindmapResponse }
        | ReferralMindmapResponse;
      return "data" in json && json.data ? json.data : (json as ReferralMindmapResponse);
    },
    staleTime: 30_000,
  });
}
