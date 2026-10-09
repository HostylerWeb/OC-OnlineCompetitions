"use client";

import {
  hasResponsiblePlayTools,
  resolveEffectiveSelfExcluded,
  useAuth,
  useComplianceFeatures,
  useProfileAvatar,
  useSaferPlay,
} from "@oc/api-client";
import type { LucideIcon } from "@oc/icons";
import {
  Gift,
  Home,
  LayoutDashboard,
  Package,
  Shield,
  Sparkles,
  Ticket,
  Trophy,
  User,
} from "@oc/icons";
import { getDisplayName, getProfileInitials } from "@oc/utils";
import { useMemo } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { type TranslationKey, useLogicalPathname, useTranslation } from "@/lib/i18n";
import { mobileNavIconWrapClass, mobileNavItemClass } from "./mobile-nav-styles";
import { NavSheetNavLink } from "./nav-sheet-link";
import { useOptionalSheetNav } from "./sheet-nav-context";

export type DashboardNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export type DashboardNavGroup = {
  title: string;
  items: DashboardNavItem[];
};

export function getStorefrontItems(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): DashboardNavItem[] {
  return [
    {
      to: "/competitions",
      label: t("header.sidebar.storefrontItems.browseCompetitions"),
      icon: Sparkles,
    },
    { to: "/", label: t("header.sidebar.storefrontItems.backToStorefront"), icon: Home },
  ];
}

export function isDashboardNavActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function useDashboardNavGroups(): DashboardNavGroup[] {
  const { t } = useTranslation();
  const features = useComplianceFeatures();
  const { data: saferPlayResponse } = useSaferPlay();

  const showResponsiblePlay = useMemo(() => {
    if (hasResponsiblePlayTools(features)) return true;
    return resolveEffectiveSelfExcluded(saferPlayResponse?.data);
  }, [features, saferPlayResponse?.data]);

  const OVERVIEW_ITEMS: DashboardNavItem[] = [
    { to: "/dashboard", label: t("header.dashboard.overview"), icon: LayoutDashboard, end: true },
    { to: "/dashboard/profile", label: t("header.dashboard.profile"), icon: User },
  ];

  const ACTIVITY_ITEMS: DashboardNavItem[] = [
    { to: "/dashboard/tickets", label: t("header.dashboard.myTickets"), icon: Ticket },
    { to: "/dashboard/orders", label: t("header.dashboard.orders"), icon: Package },
    { to: "/dashboard/wins", label: t("header.dashboard.wins"), icon: Trophy },
  ];

  return useMemo(() => {
    const accountItems: DashboardNavItem[] = [
      { to: "/dashboard/referrals", label: t("header.dashboard.referrals"), icon: Gift },
      ...(showResponsiblePlay
        ? [
            {
              to: "/dashboard/responsible-play",
              label: t("header.nav.responsiblePlay"),
              icon: Shield,
            },
          ]
        : []),
    ];

    return [
      { title: t("header.dashboard.overview"), items: OVERVIEW_ITEMS },
      { title: t("header.dashboard.myActivity"), items: ACTIVITY_ITEMS },
      { title: t("header.dashboard.account"), items: accountItems },
    ] satisfies DashboardNavGroup[];
  }, [showResponsiblePlay, t]);
}

export function useDashboardUserSummary() {
  const { user } = useAuth();
  const { avatarUrl } = useProfileAvatar();

  const initials = getProfileInitials({
    firstName: user?.firstName,
    lastName: user?.lastName,
    email: user?.email ?? "",
  });

  const displayName = getDisplayName(
    { firstName: user?.firstName, lastName: user?.lastName },
    user?.email ?? ""
  );

  return { user, avatarUrl, initials, displayName };
}

export function DashboardMobileNavLink({ item }: { item: DashboardNavItem }) {
  const pathname = useLogicalPathname();
  const sheetNav = useOptionalSheetNav();
  const Icon = item.icon;
  const active = isDashboardNavActive(pathname, item.to, item.end);

  return (
    <NavSheetNavLink
      href={item.to}
      aria-current={active ? "page" : undefined}
      className={mobileNavItemClass(active)}
    >
      <div className={mobileNavIconWrapClass(active)}>
        <Icon className="w-4 h-4 text-gold" aria-hidden="true" />
      </div>
      <span className="truncate">{item.label}</span>
      {active && !sheetNav?.isExiting ? (
        <span className="ml-auto size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
      ) : null}
    </NavSheetNavLink>
  );
}

export function DashboardMobileUserHeader() {
  const { user, avatarUrl, initials, displayName } = useDashboardUserSummary();

  return (
    <div className="flex items-center gap-3 min-w-0">
      <UserAvatar
        avatarUrl={avatarUrl}
        initials={initials}
        className="size-10 shrink-0"
        fallbackClassName="bg-gold/10 text-xs font-semibold text-gold"
      />
      <div className="min-w-0 flex flex-col gap-0.5">
        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      </div>
    </div>
  );
}
