import type { AuthClientSession } from "@oc/auth-client";
import { authClient } from "@oc/auth-client";
import type { User } from "@oc/types";
import { mapSessionUser } from "./session";

type SessionUser = AuthClientSession["user"] & {
  firstName?: string | null;
  lastName?: string | null;
};

interface Snapshot {
  user: User | null;
  isAdmin: boolean;
  isAnonymous: boolean;
  isLoggingOut: boolean;
  isLoading: boolean;
}

let _snapshot: Snapshot = {
  user: null,
  isAdmin: false,
  isAnonymous: false,
  isLoggingOut: false,
  isLoading: true,
};

const _listeners = new Set<() => void>();
let _notifying = false;
let _pendingNotify = false;

function notifySnapshotListeners(): void {
  if (_notifying) {
    _pendingNotify = true;
    return;
  }
  _notifying = true;
  queueMicrotask(() => {
    _notifying = false;
    for (const l of _listeners) {
      l();
    }
    if (_pendingNotify) {
      _pendingNotify = false;
      queueMicrotask(() => {
        for (const l of _listeners) {
          l();
        }
      });
    }
  });
}

export function subscribeToSnapshotChanges(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export function getSessionSnapshot(): Snapshot {
  return _snapshot;
}

export function resetSessionSnapshot() {
  _snapshot = {
    user: null,
    isAdmin: false,
    isAnonymous: false,
    isLoggingOut: false,
    isLoading: true,
  };
  notifySnapshotListeners();
}

export function setSessionLoggingOut(val: boolean) {
  _snapshot = { ..._snapshot, isLoggingOut: val };
  notifySnapshotListeners();
}

export function markAnonymousSession() {
  const now = new Date().toISOString();
  _snapshot = {
    user: {
      id: "anon",
      _id: "anon",
      email: "",
      firstName: null,
      lastName: null,
      isAdmin: false,
      isVerified: false,
      isAnonymous: true,
      createdAt: now,
      updatedAt: now,
    },
    isAdmin: false,
    isAnonymous: true,
    isLoggingOut: false,
    isLoading: false,
  };
  notifySnapshotListeners();
}

export function seedSessionFromServer(user: SessionUser): void {
  const mapped = mapSessionUser(user);
  _snapshot = {
    user: mapped,
    isAdmin: mapped.isAdmin,
    isAnonymous: mapped.isAnonymous,
    isLoggingOut: false,
    isLoading: false,
  };
  notifySnapshotListeners();
}

export function updateSessionSnapshot(session: AuthClientSession | null | undefined) {
  const user = session?.user ? mapSessionUser(session.user as unknown as SessionUser) : null;
  _snapshot = {
    user,
    isAdmin: session?.user?.role === "admin",
    isAnonymous: session?.user?.isAnonymous === true,
    isLoggingOut: false,
    isLoading: false,
  };
  notifySnapshotListeners();
}

export async function fetchSessionSnapshot(): Promise<Snapshot> {
  try {
    const result = await authClient.getSession();
    updateSessionSnapshot(result?.data ?? null);
  } catch {
    _snapshot = { ..._snapshot, user: null, isAdmin: false, isAnonymous: false, isLoading: false };
    notifySnapshotListeners();
  }
  return _snapshot;
}
