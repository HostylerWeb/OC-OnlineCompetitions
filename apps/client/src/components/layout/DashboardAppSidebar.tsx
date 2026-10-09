"use client";

import { ChevronLeft, PanelLeft } from "@oc/icons";
import { cn } from "@oc/utils";
import { Fragment } from "react";
import { Link } from "@/components/Link";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { useLogicalPathname, useTranslation } from "@/lib/i18n";
import {
  type DashboardNavItem,
  getStorefrontItems,
  isDashboardNavActive,
  useDashboardNavGroups,
  useDashboardUserSummary,
} from "./dashboard-sidebar-shared";

const dashboardNavButtonClass = cn(
  "min-w-0 border border-sidebar-border/50 bg-transparent shadow-none",
  "transition-[color,background-color,border-color] duration-200 ease-out",
  "hover:border-primary/35 hover:bg-transparent hover:text-sidebar-foreground",
  "active:bg-transparent data-[active=true]:border-primary data-[active=true]:bg-transparent",
  "data-[active=true]:font-medium data-[active=true]:text-primary",
  "data-[active=true]:[&_svg]:text-primary",
  "hover:[&_svg]:text-primary/75",
  "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:w-8! group-data-[collapsible=icon]:shrink-0",
  "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0!"
);

const dashboardGroupLabelClass =
  "mb-0.5 h-7 px-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary/55 group-data-[collapsible=icon]:hidden";

const UNAMI_NAV_MAP: Record<string, string> = {
  "/dashboard": "dashboard:nav-overview",
  "/dashboard/tickets": "dashboard:nav-tickets",
  "/dashboard/orders": "dashboard:nav-orders",
  "/dashboard/wins": "dashboard:nav-wins",
  "/dashboard/wallet": "dashboard:nav-wallet",
  "/dashboard/referrals": "dashboard:nav-referrals",
  "/dashboard/responsible-play": "dashboard:nav-responsible-play",
  "/dashboard/profile": "dashboard:nav-profile",
  "/competitions": "dashboard:nav-browse-competitions",
  "/": "dashboard:nav-browse-competitions",
};

function NavLinkItem({ item }: { item: DashboardNavItem }) {
  const pathname = useLogicalPathname();
  const Icon = item.icon;

  return (
    <SidebarMenuItem className="min-w-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
      <SidebarMenuButton
        asChild
        isActive={isDashboardNavActive(pathname, item.to, item.end)}
        tooltip={item.label}
        className={dashboardNavButtonClass}
      >
        <Link href={item.to} className="min-w-0" data-umami-event={UNAMI_NAV_MAP[item.to]}>
          <Icon aria-hidden="true" />
          <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavContent() {
  const navGroups = useDashboardNavGroups();

  return (
    <SidebarContent className="gap-3 overflow-x-hidden px-2.5 py-3 group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:[scrollbar-width:none] group-data-[collapsible=icon]:[-ms-overflow-style:none] group-data-[collapsible=icon]:[&::-webkit-scrollbar]:hidden">
      {navGroups.map((group, index) => (
        <Fragment key={group.title}>
          {index > 0 ? (
            <SidebarSeparator className="mx-1 my-1.5 bg-primary/10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />
          ) : null}
          <SidebarGroup className="gap-1.5 p-0 group-data-[collapsible=icon]:gap-1">
            <SidebarGroupLabel className={dashboardGroupLabelClass}>
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1">
                {group.items.map((item) => (
                  <NavLinkItem key={item.to} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </Fragment>
      ))}
    </SidebarContent>
  );
}

export function DashboardAppSidebar() {
  const { t } = useTranslation();
  const { avatarUrl, initials, displayName, user } = useDashboardUserSummary();
  const { isMobile, state, toggleSidebar } = useSidebar();

  if (isMobile) return null;

  const collapsed = state === "collapsed";
  const STOREFRONT_ITEMS = getStorefrontItems(t);

  const toggleButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      className="size-8 shrink-0 text-muted-foreground"
      aria-label={collapsed ? t("header.sidebar.expand") : t("header.sidebar.collapse")}
      data-umami-event="dashboard:sidebar-toggle"
      data-umami-event-collapsed={collapsed}
    >
      {collapsed ? <PanelLeft aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
    </Button>
  );

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="gap-0 border-b border-sidebar-border p-2">
        <div
          className={cn(
            "flex w-full min-w-0",
            collapsed
              ? "flex-col items-center gap-1.5"
              : "min-h-10 items-center justify-between gap-2"
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex size-8 shrink-0 items-center justify-center">
                  <UserAvatar
                    avatarUrl={avatarUrl}
                    initials={initials}
                    className="size-8"
                    fallbackClassName="bg-sidebar-accent text-xs font-semibold text-sidebar-primary"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar
                avatarUrl={avatarUrl}
                initials={initials}
                className="size-9 shrink-0"
                fallbackClassName="bg-sidebar-accent text-xs font-semibold text-sidebar-primary"
              />
              <div className="min-w-0 flex flex-col gap-0.5">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
              <TooltipContent side="right">{t("header.sidebar.expand")} (⌘B)</TooltipContent>
            </Tooltip>
          ) : (
            toggleButton
          )}
        </div>
      </SidebarHeader>

      <NavContent />

      <SidebarSeparator className="mx-2 my-1.5 bg-primary/10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />

      <SidebarFooter className="gap-1.5 p-2 group-data-[collapsible=icon]:items-center">
        <SidebarGroup className="gap-1.5 p-0 group-data-[collapsible=icon]:gap-1">
          <SidebarGroupLabel className={dashboardGroupLabelClass}>
            {t("header.mobile.storefront")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1">
              {STOREFRONT_ITEMS.map((item) => (
                <NavLinkItem key={item.to} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
