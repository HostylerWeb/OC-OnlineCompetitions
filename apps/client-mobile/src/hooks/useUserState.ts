"use client";

import {
  type AuthStatus,
  setSessionAnonymous,
  setSessionAuthenticated,
  setSessionUnauthenticated,
  useAuth,
  useSessionStore,
} from "@oc/api-client";
import type { User } from "@oc/types";
import { getDisplayName, getProfileInitials } from "@oc/utils";
import { useEffect, useMemo, useRef } from "react";

export interface UserState {
  user: User | null;
  displayName: string;
  initials: string;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  isReady: boolean;
  status: AuthStatus;
  logout: () => Promise<void>;
}

export function useUserState(): UserState {
  const { user: authUser, isLoading, logout } = useAuth();

  const effectiveUser = useMemo(
    () => authUser ?? null,
    [authUser?.id, authUser?.isAnonymous, authUser?.email, authUser?.firstName, authUser?.lastName]
  );
  const effectiveAnon = effectiveUser?.isAnonymous ?? false;

  const session = useSessionStore();
  const prevUserRef = useRef<string | null>(null);

  const isReady = !isLoading;
  const isAuthenticated = !!effectiveUser && !effectiveAnon;

  const displayName =
    session.displayName ||
    getDisplayName(
      { firstName: effectiveUser?.firstName, lastName: effectiveUser?.lastName },
      effectiveUser?.email ?? ""
    );
  const initials =
    session.initials ||
    getProfileInitials({
      firstName: effectiveUser?.firstName,
      lastName: effectiveUser?.lastName,
      email: effectiveUser?.email ?? "",
    });

  useEffect(() => {
    if (isLoading) return;
    if (!effectiveUser) {
      setSessionUnauthenticated();
      prevUserRef.current = null;
      return;
    }
    if (effectiveAnon) {
      setSessionAnonymous();
      prevUserRef.current = "anon";
      return;
    }

    const dn = getDisplayName(
      { firstName: effectiveUser.firstName, lastName: effectiveUser.lastName },
      effectiveUser.email
    );
    const inits = getProfileInitials({
      firstName: effectiveUser.firstName,
      lastName: effectiveUser.lastName,
      email: effectiveUser.email,
    });

    const userKey = `${effectiveUser.id}:${dn}:${inits}`;
    if (prevUserRef.current === userKey) return;

    setSessionAuthenticated(dn, inits);
    prevUserRef.current = userKey;
  }, [effectiveUser, effectiveAnon, isLoading]);

  const status: AuthStatus = isReady
    ? effectiveAnon
      ? "anonymous"
      : isAuthenticated
        ? "authenticated"
        : "unauthenticated"
    : "loading";

  return {
    user: effectiveUser,
    displayName,
    initials,
    isAnonymous: effectiveAnon,
    isAuthenticated,
    isReady,
    status,
    logout,
  };
}
