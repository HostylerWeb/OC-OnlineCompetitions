"use client";
import { getEnv } from "@oc/env/vike";
import type { AdminCompetition, ApiResponse } from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../client";
import { queryKeys } from "../../keys";
import { createPaginatedAdminQuery } from "../../lib/pagination";

export interface FrameExtractionStatus {
  jobId?: string;
  status: "pending" | "running" | "completed" | "failed" | "abandoned" | "idle" | "no_video";
  framesExtracted: number;
  framesTotal: number | null;
  percentage: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  hasFrames: boolean;
  landingPageVideoFramesPrefix: string | null;
  landingPageVideoFrameCount: number | null;
}

export function useFrameExtractionStatus(competitionId: string | null) {
  const queryKey = useMemo(
    () =>
      competitionId
        ? queryKeys.admin.frameExtractionStatus(competitionId)
        : ["admin", "frame-extraction", "disabled"],
    [competitionId]
  );

  return useQuery({
    queryKey,
    queryFn: () =>
      api.get<FrameExtractionStatus>(
        `/api/admin/competitions/${competitionId}/landing-video/extraction-status`
      ),
    enabled: Boolean(competitionId),
    refetchInterval: 1000,
    staleTime: 0,
  });
}

export function useFrameExtractionSSE(competitionId: string | null): {
  data: FrameExtractionStatus | undefined;
} {
  const [status, setStatus] = useState<FrameExtractionStatus | undefined>(undefined);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!competitionId) return;

    let cancelled = false;
    const baseUrl = getEnv("APP_URL").trim() || undefined;

    const connect = async () => {
      const url = `${baseUrl}/api/admin/competitions/${competitionId}/landing-video/extract-stream`;

      try {
        const res = await fetch(url, { credentials: "include" });
        const ct = res.headers.get("content-type") ?? "";

        if (ct.includes("application/json")) {
          const data = (await res.json()) as FrameExtractionStatus;
          if (!cancelled) setStatus(data);
          return;
        }

        if (cancelled) return;

        esRef.current = new EventSource(url, { withCredentials: true });

        esRef.current.addEventListener("state", (e) => {
          if (cancelled) return;
          const parsed = JSON.parse(e.data) as FrameExtractionStatus;
          setStatus(parsed);
        });

        esRef.current.addEventListener("progress", (e) => {
          if (cancelled) return;
          const parsed = JSON.parse(e.data);
          if (parsed.type === "progress") {
            setStatus((prev) =>
              prev
                ? {
                    ...prev,
                    framesExtracted: parsed.framesExtracted ?? prev.framesExtracted,
                    framesTotal: parsed.framesTotal ?? prev.framesTotal,
                    percentage: parsed.percentage ?? prev.percentage,
                  }
                : prev
            );
          } else if (parsed.type === "completed") {
            setStatus((prev) => ({
              ...(prev ?? {
                jobId: "",
                status: "completed",
                framesExtracted: parsed.count,
                framesTotal: parsed.count,
                percentage: 100,
                startedAt: null,
                completedAt: new Date().toISOString(),
                errorMessage: null,
                hasFrames: true,
                landingPageVideoFramesPrefix: parsed.prefix ?? null,
                landingPageVideoFrameCount: parsed.count,
              }),
              status: "completed",
              percentage: 100,
              framesExtracted: parsed.count,
              framesTotal: parsed.count,
              landingPageVideoFrameCount: parsed.count,
            }));
          } else if (parsed.type === "failed") {
            setStatus((prev) => ({
              ...(prev ?? {
                jobId: "",
                status: "failed",
                framesExtracted: 0,
                framesTotal: null,
                percentage: 0,
                startedAt: null,
                completedAt: new Date().toISOString(),
                errorMessage: parsed.error,
                hasFrames: false,
                landingPageVideoFramesPrefix: null,
                landingPageVideoFrameCount: null,
              }),
              status: "failed",
              errorMessage: parsed.error,
            }));
          }
        });

        esRef.current.onerror = () => {
          esRef.current?.close();
        };
      } catch {
        // Connection failed
      }
    };

    connect();

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
      setStatus(undefined);
    };
  }, [competitionId]);

  return { data: status };
}

export interface AdminCompetitionsParams {
  page?: number;
  limit?: number;
  statusFilter?: string;
  categoryId?: string;
  groupBy?: string;
  sortField?: string;
  sortDir?: string;
  search?: string;
  showDeleted?: boolean;
}

const usePaginatedAdminCompetitions = createPaginatedAdminQuery<AdminCompetition>({
  queryKey: (page, limit, statusFilter = "", categoryId = "", showDeleted = "") =>
    [...queryKeys.admin.competitions(statusFilter, categoryId, page, limit), showDeleted] as const,
  endpoint: "/api/admin/competitions",
  buildParams: (page, limit, statusFilter = "", categoryId = "", showDeleted = "") => ({
    page,
    limit,
    ...(statusFilter && { status: statusFilter }),
    ...(categoryId && { categoryId }),
    ...(showDeleted ? { showDeleted: "true" } : {}),
  }),
});

export function useAdminCompetitions(options: AdminCompetitionsParams = {}) {
  const {
    page = 1,
    limit = 20,
    statusFilter = "",
    categoryId = "",
    groupBy,
    sortField,
    sortDir,
    search,
    showDeleted,
  } = options;
  return usePaginatedAdminCompetitions({
    page,
    limit,
    groupBy,
    sortField,
    sortDir,
    search,
    args: [statusFilter, categoryId ?? "", showDeleted ? "true" : ""],
  });
}

export function useAdminCompetition(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.competition(id),
    queryFn: () => api.get<AdminCompetition>(`/api/admin/competitions/${id}`).then((r) => r.data),
    enabled: Boolean(id) && enabled,
  });
}

export function useAdminCompetitionMutations() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<{ success: boolean }>>(`/api/admin/competitions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<ApiResponse<AdminCompetition>>("/api/admin/competitions", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.put<ApiResponse<AdminCompetition>>(`/api/admin/competitions/${id}`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.competition(variables.id) });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<{ success: boolean }>>(`/api/admin/competitions/${id}/restore`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] }),
  });

  return { deleteMutation, createMutation, updateMutation, restoreMutation };
}
