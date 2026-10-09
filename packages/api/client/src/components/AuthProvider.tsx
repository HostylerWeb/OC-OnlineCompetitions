import type { AuthClientSession } from "@oc/auth-client";
import { authClient } from "@oc/auth-client";
import type { ApiResponse, Profile, SessionUser } from "@oc/types";
import * as Sentry from "@sentry/react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { isAnonymousUser } from "../auth/session";
import {
  getSessionSnapshot,
  markAnonymousSession,
  resetSessionSnapshot,
  seedSessionFromServer,
  updateSessionSnapshot,
} from "../auth/session-snapshot";
import { ApiResponseError, api } from "../client";
import { STALE_TIME_USER } from "../constants";
import { queryKeys } from "../keys";
import { clearPendingReferralRef, getPendingReferralRef } from "../referral/pending-ref";
import { parseRefFromSearch } from "../referral/redirect";

interface AuthProviderProps {
  initialUser?: SessionUser | null;
  enableGuestSession?: boolean;
  /** When explicitly false, anonymous sessions are not created even if enableGuestSession is true. */
  guestCheckoutEnabled?: boolean;
  searchParams?: URLSearchParams;
  children: ReactNode;
}

interface ClaimReferralResponse {
  applied: boolean;
  referredByCode?: string | null;
}

async function claimReferralCode(refCode: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await api.post<ClaimReferralResponse>("/api/referral-code/claim", {
        code: refCode,
      });
      if (res.data.applied || res.data.referredByCode) {
        return true;
      }
    } catch (err: unknown) {
      if (err instanceof ApiResponseError && err.status >= 400 && err.status < 500) {
        return false;
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }
  return false;
}

export function AuthProvider({
  children,
  enableGuestSession = true,
  guestCheckoutEnabled,
  initialUser,
  searchParams,
}: AuthProviderProps) {
  const queryClient = useQueryClient();
  const resolvedSearchParams =
    searchParams ??
    (typeof window !== "undefined"
      ? new URLSearchParams(globalThis.location?.search ?? "")
      : new URLSearchParams());

  const initialUserRef = useRef(initialUser);
  initialUserRef.current = initialUser;

  if (
    typeof window !== "undefined" &&
    initialUser &&
    getSessionSnapshot().isLoading &&
    !getSessionSnapshot().user
  ) {
    seedSessionFromServer(
      initialUser as unknown as AuthClientSession["user"] & {
        firstName?: string | null;
        lastName?: string | null;
      }
    );
  }

  useEffect(() => {
    if (initialUser) {
      seedSessionFromServer(
        initialUser as unknown as AuthClientSession["user"] & {
          firstName?: string | null;
          lastName?: string | null;
        }
      );
      return;
    }
    resetSessionSnapshot();
  }, [initialUser]);

  const { data: session, isPending, error: sessionError } = authClient.useSession();

  const anonStarted = useRef(false);
  const anonFailed = useRef(false);
  const claimedRef = useRef<string | null>(null);

  const runReferralClaim = useCallback(async () => {
    if (!session?.user || isPending) return;

    const isAnonymous = isAnonymousUser(session.user);

    const refFromUrl = parseRefFromSearch(resolvedSearchParams.toString());
    const refFromStorage = !refFromUrl && !isAnonymous ? getPendingReferralRef() : null;
    const refCode = refFromUrl ?? refFromStorage;

    if (!refCode && !isAnonymous && session.user.emailVerified) return;
    if (!refCode) return;

    if (refFromUrl && claimedRef.current && claimedRef.current !== refFromUrl) {
      claimedRef.current = null;
    }
    if (claimedRef.current === refCode) return;

    const claimed = await claimReferralCode(refCode);
    if (!claimed) return;

    claimedRef.current = refCode;
    if (refFromStorage) {
      clearPendingReferralRef();
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.my.profile() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cart() }),
    ]);
  }, [isPending, searchParams, queryClient, session?.user]);

  useEffect(() => {
    if (isPending) return;
    if (sessionError) {
      if (!initialUserRef.current) {
        updateSessionSnapshot(null);
      }
      Sentry.captureException(sessionError, { tags: { domain: "auth.session" } });
      return;
    }
    if (session) {
      updateSessionSnapshot(session);
      if (typeof window !== "undefined" && !session.user.isAnonymous) {
        (window as any).umami?.identify({ id: session.user.email!, email: session.user.email! });
      }
    } else if (!initialUserRef.current) {
      updateSessionSnapshot(null);
    }
  }, [session, sessionError, isPending]);

  useEffect(() => {
    if (isPending || !session?.user) return;
    void runReferralClaim();
  }, [session, isPending, runReferralClaim]);

  useEffect(() => {
    if (
      (initialUserRef.current && !initialUserRef.current.isAnonymous) ||
      !enableGuestSession ||
      (guestCheckoutEnabled !== undefined && !guestCheckoutEnabled) ||
      isPending ||
      sessionError
    )
      return;

    if (!session) {
      if (anonStarted.current || anonFailed.current) return;
      anonStarted.current = true;
      markAnonymousSession();
      void authClient.signIn
        .anonymous()
        .then(() => {
          void runReferralClaim();
        })
        .catch(() => {
          anonFailed.current = true;
        });
    }
  }, [enableGuestSession, session, isPending, sessionError, runReferralClaim]);

  useEffect(() => {
    if (sessionError || isPending || !session?.user || isAnonymousUser(session.user)) return;

    const cached = queryClient.getQueryData<ApiResponse<Profile>>(queryKeys.my.profile());
    if (cached?.data?.avatarUrl) return;

    void queryClient.prefetchQuery({
      queryKey: queryKeys.my.profile(),
      queryFn: () => api.get<Profile>("/api/me/profile"),
      staleTime: STALE_TIME_USER,
    });
  }, [isPending, queryClient, session?.user, sessionError]);

  return <>{children}</>;
}
