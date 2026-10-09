import type { User } from "@oc/types";
import { isSafeReturnToPath } from "../lib/contextual-action-href";
import { normalizeReferralCode, resolveRefFromUrl } from "./pending-ref";

export type AuthenticatedDestination =
  | { type: "internal"; path: string }
  | { type: "external"; url: string };

export function isAuthFunnelPath(pathname: string): boolean {
  return (
    pathname.startsWith("/auth/sign-up") ||
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/verify") ||
    pathname.startsWith("/auth/verify-required") ||
    pathname.startsWith("/auth/verify-email") ||
    pathname.startsWith("/auth/forgot-password") ||
    pathname.startsWith("/auth/reset-password") ||
    pathname.startsWith("/auth/error")
  );
}

export function pathnameFromReturnTo(path: string): string {
  const queryIndex = path.indexOf("?");
  return queryIndex >= 0 ? path.slice(0, queryIndex) : path;
}

/** Validates in-app relative paths and rejects auth funnel loops / open redirects. */
export function sanitizeReturnTo(path: string | null | undefined): string | undefined {
  if (!isSafeReturnToPath(path)) return undefined;
  if (isAuthFunnelPath(pathnameFromReturnTo(path))) return undefined;
  return path;
}

export function parseRefFromSearch(search: string): string | null {
  return resolveRefFromUrl(search.startsWith("?") ? search : `?${search}`);
}

export function buildAuthCallbackUrl(
  returnTo: string | null | undefined,
  fallback = "/dashboard"
): string {
  const path = sanitizeReturnTo(returnTo) ?? fallback;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${path}`;
}

export function buildLoginUrl(options?: {
  returnTo?: string | null;
  existingAccount?: boolean;
}): string {
  const params = new URLSearchParams();
  const safeReturnTo = sanitizeReturnTo(options?.returnTo);
  if (safeReturnTo) params.set("returnTo", safeReturnTo);
  if (options?.existingAccount) params.set("existingAccount", "1");
  const qs = params.toString();
  return qs ? `/auth/login?${qs}` : "/auth/login";
}

export function buildSignUpUrl(ref: string, returnTo?: string | null): string {
  const params = new URLSearchParams({ ref: normalizeReferralCode(ref) });
  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (safeReturnTo) params.set("returnTo", safeReturnTo);
  return `/auth/sign-up?${params.toString()}`;
}

export function buildVerifyRequiredParams(options: {
  email: string;
  returnTo?: string | null;
  code?: string | null;
}): URLSearchParams {
  const params = new URLSearchParams({ email: options.email });
  const safeReturnTo = sanitizeReturnTo(options.returnTo);
  if (safeReturnTo) params.set("returnTo", safeReturnTo);
  if (options.code) {
    params.set("code", options.code);
  }
  return params;
}

export function buildVerifyRequiredPath(options: {
  email: string;
  returnTo?: string | null;
  code?: string | null;
}): string {
  return `/auth/verify?${buildVerifyRequiredParams(options).toString()}`;
}

export function getPostVerificationPath(returnTo: string | null | undefined): string {
  return sanitizeReturnTo(returnTo) ?? "/dashboard";
}

export function resolveAuthenticatedDestination(options: {
  returnTo?: string | null;
  isAdmin?: boolean;
  adminUrl?: string;
  fallback?: string;
}): AuthenticatedDestination {
  const safeReturnTo = sanitizeReturnTo(options.returnTo);
  if (safeReturnTo) return { type: "internal", path: safeReturnTo };
  if (options.isAdmin && options.adminUrl) return { type: "external", url: options.adminUrl };
  return { type: "internal", path: options.fallback ?? "/dashboard" };
}

export function applyAuthenticatedDestination(
  destination: AuthenticatedDestination,
  navigate: (path: string, options?: { replace?: boolean }) => void
): void {
  if (destination.type === "external") {
    if (typeof window !== "undefined") {
      window.location.href = destination.url;
    }
    return;
  }
  navigate(destination.path, { replace: true });
}

export function getReferralRefGateRedirect(options: {
  pathname: string;
  search: string;
  ref: string | null;
  user: User | null;
  isAnonymous: boolean;
  isLoading: boolean;
}): string | null {
  if (options.isLoading || !options.ref || options.user?.isVerified) {
    return null;
  }
  if (isAuthFunnelPath(options.pathname)) {
    return null;
  }

  const returnTo = sanitizeReturnTo(options.pathname + options.search);

  if (options.user && !options.isAnonymous) {
    return buildVerifyRequiredPath({ email: options.user.email, returnTo });
  }

  if (!options.pathname.startsWith("/auth/sign-up")) {
    return buildSignUpUrl(options.ref, returnTo);
  }

  return null;
}

export function getAuthRedirectPath(options: {
  refCode?: string | null;
  returnTo?: string | null;
}): string {
  const safeReturnTo = sanitizeReturnTo(options.returnTo);
  if (options.refCode) {
    return buildSignUpUrl(options.refCode, safeReturnTo);
  }
  return buildLoginUrl({ returnTo: safeReturnTo });
}

export function shouldCaptureReferral(
  user: User | null,
  isAnonymous: boolean,
  isLoading: boolean
): boolean {
  if (isLoading) return false;
  if (user?.isVerified) return false;
  return !user || isAnonymous;
}
