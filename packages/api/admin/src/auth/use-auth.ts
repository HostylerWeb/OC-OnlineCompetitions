"use client";

import type { User } from "@oc/types";
import { useCallback, useSyncExternalStore } from "react";
import { logoutAll } from "../stores/clear-all";
import { getSessionSnapshot, subscribeToSnapshotChanges } from "./session-snapshot";

export interface UseAuthResult {
  user: User | null;
  role: "user" | "manager" | "admin";
  isAdmin: boolean;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const snapshot = useSyncExternalStore(
    subscribeToSnapshotChanges,
    getSessionSnapshot,
    getSessionSnapshot
  );
  const { user, role, isAdmin, isAnonymous, isLoading } = snapshot;

  const logout = useCallback(async () => {
    await logoutAll();
  }, []);

  return {
    user,
    role,
    isAdmin,
    isAnonymous,
    isAuthenticated: !!user && !isAnonymous,
    isLoading,
    logout,
  };
}
