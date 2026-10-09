import type { SessionUser, User } from "@oc/types";
import type { AuthClientSession } from "./client";
import { authClient } from "./client";
import { mapSessionUser } from "./session";

interface Snapshot {
  user: User | null;
  role: "user" | "manager" | "admin";
  isAdmin: boolean;
  isAnonymous: boolean;
  isLoggingOut: boolean;
  isLoading: boolean;
}

let _snapshot: Snapshot = {
  user: null,
  role: "user",
  isAdmin: false,
  isAnonymous: false,
  isLoggingOut: false,
  isLoading: true,
};

const _listeners = new Set<() => void>();

function notifySnapshotListeners(): void {
  queueMicrotask(() => {
    for (const l of _listeners) {
      l();
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
    role: "user",
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
      role: "user",
      isAdmin: false,
      isVerified: false,
      isAnonymous: true,
      createdAt: now,
      updatedAt: now,
    },
    role: "user",
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
    role: mapped.role ?? "user",
    isAdmin: mapped.isAdmin,
    isAnonymous: mapped.isAnonymous,
    isLoggingOut: false,
    isLoading: false,
  };
  notifySnapshotListeners();
}

export function updateSessionSnapshot(session: AuthClientSession | null | undefined) {
  const user = session?.user ? mapSessionUser(session.user as unknown as SessionUser) : null;
  const role =
    session?.user?.role === "manager" || session?.user?.role === "admin"
      ? session.user.role
      : "user";
  _snapshot = {
    user,
    role,
    isAdmin: role === "admin" || role === "manager",
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
    _snapshot = {
      ..._snapshot,
      user: null,
      role: "user",
      isAdmin: false,
      isAnonymous: false,
      isLoading: false,
    };
    notifySnapshotListeners();
  }
  return _snapshot;
}
