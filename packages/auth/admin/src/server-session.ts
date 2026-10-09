import type { SessionUser } from "@oc/types";
import { getAdminAuth } from "./admin-auth";
import { getClientAuth } from "./client-auth";

export type ServerAuthKind = "client" | "admin";

type HeaderSource = Headers | (() => Headers | Promise<Headers>);

async function resolveHeaders(source?: HeaderSource): Promise<Headers> {
  if (!source) return new Headers();
  if (typeof source === "function") return source();
  return source;
}

export async function getServerSession(
  kind?: ServerAuthKind,
  headerSource?: HeaderSource
): Promise<SessionUser | null> {
  const h = await resolveHeaders(headerSource);
  const auth = kind === "admin" ? await getAdminAuth() : await getClientAuth();
  const session = await auth.api.getSession({ headers: h });
  return session?.user ?? null;
}

export async function requireServerAdmin(headerSource?: HeaderSource): Promise<SessionUser> {
  const user = await getServerSession("admin", headerSource);
  if (!user) {
    throw new Error("[Auth] No session — redirect to login");
  }
  if (user.role !== "admin" && user.role !== "manager") {
    throw new Error("[Auth] Not staff — redirect to access-denied");
  }
  return user;
}
