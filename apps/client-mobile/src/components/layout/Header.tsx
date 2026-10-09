"use client";

import {
  api,
  useCartCount,
  useComplianceFeatures,
  useProfileAvatar,
  usePushSubscription,
} from "@oc/api-client";
import {
  Bell,
  BellOff,
  ChevronDown,
  Gift,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  ShoppingBag,
  ShoppingCart,
  SocialIcon,
  SocialLinksIconButtons,
  Ticket,
  Trophy,
  User,
  X,
} from "@oc/icons";
import type { User as UserType } from "@oc/types";
import { cn, getDisplayName, getProfileInitials, SOCIAL_LINKS } from "@oc/utils";
import { useQueryClient } from "@tanstack/react-query";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/components/Link";
import { BrandLogo } from "@/components/BrandLogo";
import { PushNotificationPreferences } from "@/components/notifications/PushNotificationPreferences";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Marquee } from "@/components/ui/marquee";
import { UserAvatar } from "@/components/user-avatar";
import { useUserState } from "@/hooks";
import { type TranslationKey, useLogicalPathname, useTranslation } from "@/lib/i18n";

import { DASHBOARD_SCROLL_ID } from "./header-layout";
import { useHeaderMobileNav } from "./header-mobile-nav";

function getNavItems(t: (key: TranslationKey) => string) {
  return [
    { href: "/", label: t("header.nav.home"), icon: Home },
    { href: "/competitions", label: t("header.nav.competitions"), icon: Trophy },
    { href: "/winners", label: t("header.nav.winners"), icon: Gift },
    { href: "/entries", label: t("header.nav.entries"), icon: Ticket },
    { href: "/how-it-works", label: t("header.nav.howItWorks"), icon: HelpCircle },
  ];
}

function getDashboardMenu(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
) {
  return [
    {
      href: "/dashboard",
      label: t("header.dashboard.overview"),
      icon: LayoutDashboard,
      event: "nav:dashboard-link",
    },
    {
      href: "/dashboard/profile",
      label: t("header.dashboard.profile"),
      icon: User,
      event: "nav:profile-link",
    },
    {
      href: "/dashboard/tickets",
      label: t("header.dashboard.myTickets"),
      icon: Ticket,
      event: "nav:tickets-link",
    },
    {
      href: "/dashboard/orders",
      label: t("header.dashboard.orders"),
      icon: ShoppingBag,
      event: "nav:orders-link",
    },
    {
      href: "/dashboard/wins",
      label: t("header.dashboard.wins"),
      icon: Gift,
      event: "nav:wins-link",
    },
    {
      href: "/dashboard/referrals",
      label: t("header.dashboard.referAndEarn"),
      icon: Gift,
      event: "nav:referrals-link",
    },
  ];
}

const TRIGGER_NAME_MAX_LENGTH = 12;

function getTriggerLabel(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const name =
    [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ") ||
    email?.split("@")[0] ||
    t("header.userMenu.anonymous");
  if (name.length <= TRIGGER_NAME_MAX_LENGTH) return name;
  return `${name.slice(0, TRIGGER_NAME_MAX_LENGTH)}...`;
}

function UserDropdown({
  user,
  onLogout,
  hideDashboardLinks,
}: {
  user: UserType;
  onLogout: () => void;
  hideDashboardLinks: boolean;
}) {
  const { t } = useTranslation();
  const { avatarUrl } = useProfileAvatar();
  const [isOpen, setIsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const initials = getProfileInitials({
    firstName: user?.firstName,
    lastName: user?.lastName,
    email: user?.email ?? "",
  });

  const subscribeUser = useCallback(async (sub: PushSubscriptionJSON) => {
    await api.post("/api/push/subscribe", sub);
  }, []);

  const unsubscribeUser = useCallback(async () => {
    await api.delete("/api/push/unsubscribe");
  }, []);

  const {
    state: pushState,
    permission,
    subscribe,
    unsubscribe,
  } = usePushSubscription({
    onSubscribe: subscribeUser,
    onUnsubscribe: unsubscribeUser,
  });

  const displayName = getDisplayName(
    { firstName: user?.firstName, lastName: user?.lastName },
    user?.email ?? ""
  );
  const triggerLabel = getTriggerLabel(t, user?.firstName, user?.lastName, user?.email);

  const queryClient = useQueryClient();

  const handleLogout = () => {
    void onLogout();
    queryClient.clear();
    setIsOpen(false);
  };

  const pushBlocked = permission === "denied" || pushState === "denied";
  const pushReady = pushState !== "loading" && pushState !== "unsupported" && pushState !== "error";
  const pushSubscribed = pushState === "subscribed";

  const DASHBOARD_MENU = getDashboardMenu(t);

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 rounded-full pl-1 pr-3 transition-colors hover:bg-gold/10 hover:text-gold hover:border-gold/40"
            data-umami-event="nav:user-dropdown-toggle"
          >
            <UserAvatar
              avatarUrl={avatarUrl}
              initials={initials}
              className="size-7"
              fallbackClassName="text-xs font-semibold"
            />
            <span className="text-sm font-medium">{triggerLabel}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 p-0" sideOffset={6}>
          <DropdownMenuLabel className="px-3 py-3 font-normal">
            <div className="flex items-center gap-3">
              <UserAvatar
                avatarUrl={avatarUrl}
                initials={initials}
                className="size-10"
                fallbackClassName="text-sm font-semibold"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </DropdownMenuLabel>

          {!hideDashboardLinks && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup className="p-1">
                {DASHBOARD_MENU.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="cursor-pointer" data-umami-event={item.event}>
                      <item.icon />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}

          <DropdownMenuSeparator />
          <div className="p-1">
            {pushReady && !pushBlocked && (
              <>
                <DropdownMenuItem onClick={() => (pushSubscribed ? unsubscribe() : subscribe())}>
                  {pushSubscribed ? <Bell /> : <BellOff />}
                  {pushSubscribed
                    ? t("header.userMenu.disableNotifications")
                    : t("header.userMenu.enableNotifications")}
                </DropdownMenuItem>
                {pushSubscribed && (
                  <DropdownMenuItem onClick={() => setPreferencesOpen(true)}>
                    <Bell />
                    {t("header.userMenu.notificationPreferences")}
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
              data-umami-event="nav:sign-out"
            >
              <LogOut />
              {t("header.auth.signOut")}
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <PushNotificationPreferences open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </>
  );
}

function CartButton() {
  const { t } = useTranslation();
  const { user } = useUserState();
  const { data: count = 0 } = useCartCount({
    // Guests have carts too (anonymous sessions auto-created client-side), so
    // the badge must stay live instead of being pinned to the SSR snapshot.
    enabled: !!user,
  });

  return (
    <Link
      href="/cart"
      className="relative -mr-1"
      data-umami-event="nav:cart-click"
      data-umami-event-count={count}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={
          count > 0 ? t("header.cart.ariaLabelWithCount", { count }) : t("header.cart.ariaLabel")
        }
        className="relative w-8 h-8 rounded-full border border-gold/20 bg-card/80 text-gold hover:bg-gold hover:text-black hover:border-gold active:scale-95 transition-all duration-200 touch-manipulation p-0"
      >
        <ShoppingCart className="size-4" />
        {count > 0 ? (
          <span className="absolute -top-2 -right-0.5 flex items-center justify-center h-3.5 min-w-[0.875rem] px-1 rounded-full bg-gold text-primary-foreground text-[12px] font-bold shadow-lg shadow-gold/30 tabular-nums ring-2 ring-card">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Button>
    </Link>
  );
}

export function Header() {
  const { t } = useTranslation();
  const features = useComplianceFeatures();
  const showResponsiblePlay = features.publicResponsiblePlayPage;
  const currentPath = window.location.pathname;
  const { user, isAuthenticated, logout } = useUserState();
  const { open: mobileOpen, toggle: toggleMobileNav } = useHeaderMobileNav();
  const [scrolled, setScrolled] = useState(false);
  const [pathname, setPathname] = useState(currentPath);
  const isDashboardRoute = currentPath.startsWith("/dashboard");
  const isFirstRender = useRef(true);

  const NAV_ITEMS = getNavItems(t);

  useEffect(() => {
    setPathname(window.location.pathname);
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    setPathname(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  useEffect(() => {
    const updateScrolled = (scrollTop: number) => setScrolled(scrollTop > 4);

    const handleWindowScroll = () => updateScrolled(window.scrollY);

    const dashboardScroll = document.getElementById(DASHBOARD_SCROLL_ID);
    const handleDashboardScroll = () => updateScrolled(dashboardScroll?.scrollTop ?? 0);

    updateScrolled(
      dashboardScroll && dashboardScroll.scrollTop > 0 ? dashboardScroll.scrollTop : window.scrollY
    );

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    dashboardScroll?.addEventListener("scroll", handleDashboardScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
      dashboardScroll?.removeEventListener("scroll", handleDashboardScroll);
    };
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 w-screen max-w-none transition-all duration-300 animate-fade-in",
        scrolled ? "shadow-lg shadow-black/30" : ""
      )}
    >
      <div className="bg-card/95 backdrop-blur-2xl border-b border-border">
        <div className="oc-container-wide">
          <div className="w-full flex h-14 items-center gap-2 md:gap-3 min-w-0">
            <Link
              href="/"
              className="shrink-0 hover:brightness-110 transition-all"
              data-umami-event="nav:logo-click"
            >
              <BrandLogo className="text-gold" />
            </Link>

            <div className="hidden md:flex min-w-0 flex-1 overflow-x-auto scrollbar-hide">
              <nav className="flex w-max min-w-full items-center gap-0.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap shrink-0",
                        active
                          ? "text-gold bg-gold/10"
                          : "text-muted-foreground hover:text-gold hover:bg-gold/10"
                      )}
                      data-umami-event={`nav:${item.label.toLowerCase().replace(/\s+/g, "-")}-click`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                {showResponsiblePlay ? (
                  <Link
                    key="/responsible-play"
                    href="/responsible-play"
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap shrink-0",
                      isActive("/responsible-play")
                        ? "text-gold bg-gold/10"
                        : "text-muted-foreground hover:text-gold hover:bg-gold/10"
                    )}
                  >
                    <Shield className="w-4 h-4" />
                    <span>{t("header.nav.responsiblePlay")}</span>
                  </Link>
                ) : null}
              </nav>
            </div>

            <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("header.followUs")}
                </span>
                <SocialLinksIconButtons
                  buttonClassName="w-7 h-7 shrink-0 rounded-full bg-card/80"
                  iconClassName="size-3.5"
                />
              </div>

              <div className="w-px h-5 bg-border/50 shrink-0" />

              <CartButton />

              <div className="flex items-center gap-1.5 shrink-0">
                {isAuthenticated ? (
                  <UserDropdown
                    user={user as UserType}
                    onLogout={logout}
                    hideDashboardLinks={isDashboardRoute}
                  />
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                      data-umami-event="nav:sign-in-click"
                    >
                      {t("header.auth.signIn")}
                    </Link>
                    <Link
                      href="/auth/sign-up"
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                      data-umami-event="nav:sign-up-click"
                    >
                      {t("header.auth.signUp")}
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="flex md:hidden items-center gap-2 ml-auto shrink-0">
              <CartButton />
              <Button
                variant="ghost"
                size="icon"
                aria-label={mobileOpen ? t("header.mobile.closeMenu") : t("header.mobile.openMenu")}
                aria-expanded={mobileOpen}
                className="w-7 h-7 rounded-full border border-gold/20 bg-card/80 text-gold hover:bg-gold hover:text-black hover:border-gold active:scale-95 transition-all duration-200 touch-manipulation p-0"
                onClick={toggleMobileNav}
                data-umami-event="nav:mobile-menu-toggle"
              >
                {mobileOpen ? <X className="size-3.5" /> : <Menu className="size-3.5" />}
              </Button>
            </div>
          </div>
          <div className="h-[35px] overflow-hidden border-t border-gold/20">
            <Marquee
              pauseOnHover
              repeat={12}
              className="h-full items-center p-0"
              style={{ "--duration": "14s", "--gap": "2.5rem" } as CSSProperties}
            >
              <a
                href={
                  SOCIAL_LINKS.find((l) => l.icon === "telegram")?.href ?? "https://telegram.org/"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold leading-none text-gold whitespace-nowrap transition-opacity hover:opacity-70"
                data-umami-event="nav:telegram-marquee"
              >
                <SocialIcon name="telegram" className="size-4" />
                {t("header.marquee")}
                <span aria-hidden="true" className="ml-8 text-gold/40">
                  ✦
                </span>
              </a>
            </Marquee>
          </div>
        </div>
      </div>
    </header>
  );
}
