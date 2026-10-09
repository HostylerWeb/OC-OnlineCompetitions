import type { SessionUser, User } from "@oc/types";

export function mapSessionUser(user: SessionUser): User {
  const nameParts = user.name?.split(" ") ?? [];
  const role = user.role === "manager" || user.role === "admin" ? user.role : "user";
  return {
    id: user.id,
    _id: user.id,
    email: user.email,
    firstName: user.firstName ?? nameParts[0] ?? null,
    lastName: user.lastName ?? (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null),
    role,
    isAdmin: role === "admin" || role === "manager",
    isVerified: user.emailVerified ?? false,
    isAnonymous: user.isAnonymous === true,
    createdAt: user.createdAt?.toString?.() ?? new Date().toISOString(),
    updatedAt: user.updatedAt?.toString?.() ?? new Date().toISOString(),
  };
}

export function isAnonymousUser(
  user: { isAnonymous?: boolean | null } | null | undefined
): boolean {
  return Boolean(user?.isAnonymous);
}

export function isVerifiedUser(user: SessionUser | null | undefined): boolean {
  if (!user || user.isAnonymous) return false;
  return Boolean(user.emailVerified);
}

export function isAdminUser(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "manager";
}

export function isStaffRole(role?: string | null): boolean {
  return role === "admin" || role === "manager";
}
