"use client";

import type {
  ApiResponse,
  PersonalisationAction,
  PersonalisationServeDto,
  PersonalisationSurface,
} from "@oc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";

const SESSION_STORAGE_KEY = "oc_personalisation_session";

export function getPersonalisationSessionKey(): string {
  if (typeof window === "undefined") return "default";
  let value = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, value);
  }
  return value;
}

export function usePersonalisationAction(
  surface: PersonalisationSurface,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  return useQuery<ApiResponse<PersonalisationServeDto>>({
    queryKey: queryKeys.my.personalisation(surface),
    queryFn: async () =>
      api.get<PersonalisationServeDto>("/api/me/personalisation", {
        params: { surface },
        headers: { "x-personalisation-session": getPersonalisationSessionKey() },
      }),
    enabled,
    staleTime: STALE_TIME_USER,
  });
}

export function usePersonalisationAck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      surface: PersonalisationSurface;
      event: "shown" | "dismissed" | "clicked";
      action: PersonalisationAction;
    }) =>
      api.post("/api/me/personalisation/ack", payload, {
        headers: { "x-personalisation-session": getPersonalisationSessionKey() },
      }),
    onSuccess: (_data, variables) => {
      if (variables.event === "dismissed" || variables.event === "clicked") {
        queryClient.setQueriesData<ApiResponse<PersonalisationServeDto>>(
          { queryKey: ["my", "personalisation"] },
          { data: { action: null } }
        );
      }
    },
  });
}
