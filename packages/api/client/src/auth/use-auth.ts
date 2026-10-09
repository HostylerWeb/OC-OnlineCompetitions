import type { User } from "@oc/types";
import { useCallback, useSyncExternalStore } from "react";
import { logoutAll } from "../stores/clear-all";
import { getSessionSnapshot, subscribeToSnapshotChanges } from "./session-snapshot";

export interface UseAuthResult {
  user: User | null;
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
  const { user, isAdmin, isAnonymous, isLoading } = snapshot;

  const logout = useCallback(async () => {
    await logoutAll();
  }, []);

  return {
    user,
    isAdmin,
    isAnonymous,
    isAuthenticated: !!user && !isAnonymous,
    isLoading,
    logout,
  };
}
