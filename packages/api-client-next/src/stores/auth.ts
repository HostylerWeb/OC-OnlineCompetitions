import type { User } from "@oc/types";
import { create } from "zustand";
import type { AuthClientSession } from "../auth/client";
import { authClient, safelyRunAuthRequest } from "../auth/client";
import { isAnonymousUser, mapSessionUser } from "../auth/session";
import { clearAllStores } from "./index";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isLoggingOut: boolean;
  isAnonymous: boolean;
  syncFromSession: (session: AuthClientSession | null, isPending: boolean) => void;
  logout: () => Promise<void>;
}

let _hasResolvedOnce = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: true,
  isAdmin: false,
  isLoggingOut: false,
  isAnonymous: false,

  syncFromSession: (session, isPending) => {
    console.debug(
      "[auth:store] syncFromSession: isPending=%s session=%j",
      isPending,
      session?.user?.id
        ? {
            id: session.user.id,
            role: (session.user as Record<string, unknown>).role,
            email: session.user.email,
          }
        : null
    );

    if (isPending) {
      // Skip loading on subsequent bounces (anonymous creation, page navs)
      // to prevent the skeleton double-flash. Only show skeleton on first ever load.
      if (_hasResolvedOnce) return;
      set({ isLoading: true });
      return;
    }

    _hasResolvedOnce = true;

    const sessionUser = session?.user ?? null;
    if (!sessionUser || isAnonymousUser(sessionUser)) {
      console.debug("[auth:store] syncFromSession: no user or anonymous → resetting to guest/null");
      set({
        user: null,
        isAdmin: false,
        isAnonymous: Boolean(sessionUser && isAnonymousUser(sessionUser)),
        isLoading: false,
      });
      return;
    }

    const user = mapSessionUser(sessionUser);
    console.debug(
      "[auth:store] syncFromSession: setting user id=%s isAdmin=%s",
      user.id,
      user.isAdmin
    );
    set({
      user,
      isAdmin: user.isAdmin,
      isAnonymous: false,
      isLoading: false,
    });
  },

  logout: async () => {
    if (get().isLoggingOut) return;
    set({ isLoggingOut: true });
    try {
      clearAllStores();
      await safelyRunAuthRequest(() => authClient.signOut());
      set({ user: null, isAdmin: false, isAnonymous: false, isLoading: false });
    } finally {
      set({ isLoggingOut: false });
    }
  },
}));

export { authClient } from "../auth/client";
export { isAdminUser, isAnonymousUser, isVerifiedUser, mapSessionUser } from "../auth/session";
