"use client";
import type { ApiResponse, Competition, EndingSoonSettings } from "@oc/types";
import { filterEndingSoonCompetitions } from "@oc/utils";
import { useMemo } from "react";
import { useCompetitions } from "./competitions";
import { useEndingSoonSettings } from "./ending-soon-settings";

export function useEndingSoonCompetitions(options?: {
  limit?: number;
  enabled?: boolean;
  initialData?: {
    settings?: ApiResponse<EndingSoonSettings>;
    competitions?: ApiResponse<Competition[]>;
  };
}) {
  const { limit, enabled = true, initialData } = options ?? {};
  const { data: settingsResponse, ...settingsQuery } = useEndingSoonSettings({
    initialData: initialData?.settings,
  });
  const { data: compsResponse, ...compsQuery } = useCompetitions(
    {
      limit: 100,
      enabled,
    },
    { initialData: initialData?.competitions }
  );

  const competitions = useMemo(
    () =>
      filterEndingSoonCompetitions(compsResponse?.data ?? [], settingsResponse?.data, {
        limit,
      }),
    [compsResponse?.data, settingsResponse?.data, limit]
  );

  const settings = settingsResponse?.data as EndingSoonSettings | undefined;

  return {
    competitions,
    settings,
    isLoading: settingsQuery.isLoading || compsQuery.isLoading,
    isError: settingsQuery.isError || compsQuery.isError,
    refetch: async () => {
      await Promise.all([settingsQuery.refetch(), compsQuery.refetch()]);
    },
  };
}
