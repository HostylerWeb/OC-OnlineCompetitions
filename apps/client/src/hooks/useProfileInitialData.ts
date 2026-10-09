"use client";

import type { ApiResponse, Profile } from "@oc/types";
import { usePageContext } from "vike-react/usePageContext";

export function useProfileInitialData(): ApiResponse<Profile> | undefined {
  const ctx = usePageContext();
  return (ctx as unknown as Record<string, unknown>).profileInitialData as
    | ApiResponse<Profile>
    | undefined;
}
