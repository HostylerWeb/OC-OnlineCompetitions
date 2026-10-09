import {
  reconcileSelfExclusionOnRead,
  resolveEffectiveSelfExclusion,
} from "@oc/api-compliance/compliance-user-service";
import {
  getComplianceSettings,
  isComplianceEnforcementActive,
} from "@oc/api-compliance/settings";
import { Profile } from "@oc/api-db/models";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error } from "@oc/api-infra/response";
import type { AuthSessionData, AuthUser } from "@oc/auth-admin/auth-client";
import type { Context, Next } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    user: AuthUser | null;
    session: AuthSessionData | null;
    userId: string | null;
    email: string | null;
    isAdmin: boolean;
    sessionResolved: boolean;
    authInstance: any;
    body: unknown;
    query: unknown;
  }
}

const PUBLIC_ROUTE_PREFIXES = [
  "/api/competitions",
  "/api/stats",
  "/api/winners",
  "/api/categories",
  "/api/entries",
  "/api/public",
  "/api/ending-soon-settings",
  "/api/homepage-layout-settings",
  "/api/referral-settings",
  "/api/compliance-settings",
  "/api/auth",
  "/api/internal",
  "/r",
] as const;

export function isPublicRoute(path: string): boolean {
  if (path === "/health" || path === "/health/ready") return true;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function setEmptySession(c: Context): void {
  c.set("user", null);
  c.set("session", null);
  c.set("userId", null);
  c.set("email", null);
  c.set("isAdmin", false);
  c.set("sessionResolved", true);
}

function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
}

function applySession(
  c: Context,
  session: {
    user: AuthUser;
    session: AuthSessionData;
  } | null
): void {
  if (!session) {
    setEmptySession(c);
    return;
  }

  const user = session.user as AuthUser;
  if (!isValidObjectId(user.id)) {
    setEmptySession(c);
    return;
  }

  c.set("user", user);
  c.set("session", session.session);
  c.set("userId", user.id);
  c.set("email", user.email);
  c.set(
    "isAdmin",
    (user as { role?: string }).role === "admin" || (user as { role?: string }).role === "manager"
  );
  c.set("sessionResolved", true);
}

export async function resolveSession(c: Context): Promise<void> {
  if (c.get("sessionResolved")) return;
  const auth = c.get("authInstance");
  if (!auth) return;
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  applySession(c, session);
}

export async function sessionMiddleware(c: Context, next: Next) {
  if (isPublicRoute(c.req.path)) {
    await resolveSession(c);
    await next();
    return;
  }
  await resolveSession(c);
  await next();
}

export async function requireSession(c: Context, next: Next) {
  await resolveSession(c);
  const user = c.get("user");
  if (!user) {
    return error(c, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
  }
  await next();
}

export async function requireVerifiedUser(c: Context, next: Next) {
  await resolveSession(c);
  const user = c.get("user");
  if (!user) {
    return error(c, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
  }

  if ((user as { isAnonymous?: boolean }).isAnonymous) {
    return error(c, ErrorCodes.UNAUTHORIZED, "Please sign in to continue", 401);
  }

  if (!user.emailVerified) {
    return error(c, ErrorCodes.FORBIDDEN, "Email verification required", 403);
  }

  const selfExcludedResponse = await checkSelfExclusion(c, c.get("userId"));
  if (selfExcludedResponse) return selfExcludedResponse;

  await next();
}

export async function requireGuestCheckout(c: Context, next: Next) {
  await resolveSession(c);
  const user = c.get("user");
  if (!user) {
    return error(c, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
  }

  if ((user as { banned?: boolean | null }).banned) {
    return error(c, ErrorCodes.FORBIDDEN, "Your account has been banned", 403);
  }

  const selfExcludedResponse = await checkSelfExclusion(c, c.get("userId"));
  if (selfExcludedResponse) return selfExcludedResponse;

  if (user.isAnonymous) {
    const settings = await getComplianceSettings();
    if (settings.masterEnabled && !settings.guestCheckoutEnabled) {
      return error(c, ErrorCodes.FORBIDDEN, "Guest checkout is disabled", 403);
    }
  }

  await next();
}

async function checkSelfExclusion(c: Context, userId: string | null): Promise<Response | null> {
  if (!userId) return null;

  const { default: dbConnect } = await import("@oc/api-infra/db");
  await dbConnect();

  const settings = await getComplianceSettings();
  if (c.get("isAdmin")) return null;
  if (!isComplianceEnforcementActive(settings) || !settings.selfExclusionEnabled) return null;

  await reconcileSelfExclusionOnRead(userId);

  const profile = await Profile.findById(userId).select("selfExcluded selfExcludedUntil").lean();
  if (!profile) return null;

  const { effective } = resolveEffectiveSelfExclusion(profile);
  if (!effective) return null;

  return error(
    c,
    ErrorCodes.ACCOUNT_SELF_EXCLUDED,
    "Your account is self-excluded. You cannot access this feature during this period.",
    403
  );
}

export function getRequiredUserId(c: Context): string {
  const userId = c.get("userId");
  if (!userId) {
    throw new Error("userId required after auth middleware");
  }
  return userId;
}

export const auth = requireSession;

export async function requireAdmin(c: Context, next: Next) {
  if (c.req.method === "OPTIONS") return next();

  await resolveSession(c);
  const user = c.get("user");
  if (!user) {
    return error(c, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
  }

  if ((user as { role?: string }).role !== "admin") {
    return error(c, ErrorCodes.FORBIDDEN, "Admin access required", 403);
  }

  await next();
}

export async function requireStaff(c: Context, next: Next) {
  if (c.req.method === "OPTIONS") return next();

  await resolveSession(c);
  const user = c.get("user");
  if (!user) {
    return error(c, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
  }

  const role = (user as { role?: string }).role;
  if (role !== "admin" && role !== "manager") {
    return error(c, ErrorCodes.FORBIDDEN, "Staff access required", 403);
  }

  await next();
}

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function requireManager(c: Context, next: Next) {
  if (c.req.method === "OPTIONS") return next();

  await resolveSession(c);
  const user = c.get("user");
  if (!user) {
    return error(c, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
  }

  const role = (user as { role?: string }).role;
  if (role !== "admin" && role !== "manager") {
    return error(c, ErrorCodes.FORBIDDEN, "Staff access required", 403);
  }

  if (role === "manager" && !READ_ONLY_METHODS.has(c.req.method)) {
    return error(c, ErrorCodes.FORBIDDEN, "Manager role is read-only", 403);
  }

  await next();
}

export type { AuthSessionData, AuthUser };
