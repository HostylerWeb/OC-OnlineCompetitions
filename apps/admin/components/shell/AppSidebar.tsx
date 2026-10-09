"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@oc/api-admin";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo, BrandLogoSquare } from "@/components/BrandLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { type NavItem } from "@/config/adminNavigation";
import { prefetchAdminRoute } from "@/hooks/admin-prefetch";
import { filterNavGroups } from "@/lib/nav-permissions";

import { NavUser } from "./NavUser";

function navSlug(href: string): string {
  if (href === "/") return "dashboard";
  return href.replace(/^\//, "").replace(/\//g, "-");
}

function isNavItemActive(pathname: string, href: string, allHrefs: string[]): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  const target = href.replace(/\/$/, "") || "/";

  if (target === "/") {
    return path === "/";
  }

  if (path === target) {
    return true;
  }

  if (!path.startsWith(`${target}/`)) {
    return false;
  }

  // Prefer the longest matching nav href (e.g. /referrals/network over /referrals).
  const bestMatch = allHrefs.reduce<string | null>((best, candidate) => {
    const c = candidate.replace(/\/$/, "") || "/";
    if (c === "/") return best;
    if (path === c || path.startsWith(`${c}/`)) {
      if (!best || c.length > best.length) return c;
    }
    return best;
  }, null);

  return bestMatch === target;
}

function NavLinkRow({ item, allHrefs }: { item: NavItem; allHrefs: string[] }) {
  const pathname = usePathname() ?? "";
  const queryClient = useQueryClient();
  const Icon = item.icon;
  const isActive = isNavItemActive(pathname, item.href, allHrefs);

  const handlePointerEnter = () => {
    prefetchAdminRoute(item.href, queryClient);
  };

  const umamiEvent = `nav:${navSlug(item.href)}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        {item.target === "_blank" ? (
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onPointerEnter={handlePointerEnter}
            data-umami-event={umamiEvent}
          >
            <Icon />
            <span>{item.label}</span>
          </a>
        ) : (
          <Link
            href={item.href}
            onPointerEnter={handlePointerEnter}
            data-umami-event={umamiEvent}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon />
            <span>{item.label}</span>
          </Link>
        )}
      </SidebarMenuButton>
      {item.badge != null ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { role } = useAuth();
  const navGroups = filterNavGroups(role);
  const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href="/"
              data-umami-event="nav:logo-home"
              className="flex h-12 w-full items-center gap-2 overflow-hidden rounded-lg px-2 text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_6%,var(--sidebar))] group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:p-2"
            >
              <BrandLogoSquare className="shrink-0 text-sidebar-primary hidden group-data-[state=collapsed]:block" />
              <BrandLogo className="max-w-[220px] shrink-0 text-sidebar-primary block group-data-[state=collapsed]:hidden" />
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-1">
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavLinkRow key={item.href} item={item} allHrefs={allHrefs} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
