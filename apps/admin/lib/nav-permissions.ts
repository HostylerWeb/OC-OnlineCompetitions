import type { AdminRole } from "@oc/types";
import { adminNavigationGroups, type NavGroup, type NavItem } from "@/config/adminNavigation";

export function isItemAllowed(item: { roles?: AdminRole[] }, role: string | undefined): boolean {
  if (!item.roles) return true;
  return item.roles.includes(role as AdminRole);
}

export function filterNavGroups(role: string | undefined): NavGroup[] {
  return adminNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isItemAllowed(item, role)),
    }))
    .filter((group) => group.items.length > 0);
}

export function isAdminOnlyPath(pathname: string, role: string | undefined): boolean {
  if (role === "admin") return false;
  return adminNavigationGroups.some((group) =>
    group.items.some(
      (item) =>
        item.roles?.includes("admin") &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`))
    )
  );
}
