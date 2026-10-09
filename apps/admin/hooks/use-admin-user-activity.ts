"use client";

import type { TimelineEvent } from "@oc/api-referrals/timeline";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";

export function useAdminUserActivity(
  userId: string,
  limit: number = 50,
  enabled: boolean = true
): UseQueryResult<{ events: TimelineEvent[] }> {
  return useQuery({
    queryKey: ["admin-user-activity", userId, limit],
    enabled: enabled && !!userId && userId.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      const url = `/api/admin/users/${userId}/activity-timeline?${params.toString()}`;
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) {
        throw new Error(`Failed to load activity (${res.status})`);
      }
      const json = (await res.json()) as
        | { ok?: boolean; data: { events: TimelineEvent[] } }
        | { events: TimelineEvent[] };
      const events =
        "data" in json && json.data
          ? json.data.events
          : (json as { events: TimelineEvent[] }).events;
      return { events };
    },
    staleTime: 15_000,
  });
}
