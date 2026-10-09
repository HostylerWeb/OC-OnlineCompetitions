"use client";

import { useAuth, useComplianceFeatures } from "@oc/api-client";
import {
  Gift,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  Shield,
  SocialLinksChips,
  Ticket,
  Trophy,
  X,
} from "@oc/icons";
import { cn } from "@oc/utils";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type TranslationKey, useLogicalPathname, useTranslation } from "@/lib/i18n";
import { MobileNavSheet } from "./mobile-nav-sheet";
import {
  mobileNavIconWrapClass,
  mobileNavItemClass,
  mobileNavSectionClass,
} from "./mobile-nav-styles";
import { NavSheetActionButton, NavSheetLink } from "./nav-sheet-link";
import { useSheetNav } from "./sheet-nav-context";
import { useCloseOnRouteChange } from "./use-close-on-route-change";

function getNavItems(t: (key: TranslationKey, params?: Record<string, string | number>) => string) {
  return [
    { href: "/", label: t("header.nav.home"), icon: Home },
    { href: "/competitions", label: t("header.nav.competitions"), icon: Trophy },
    { href: "/winners", label: t("header.nav.winners"), icon: Gift },
    { href: "/entries", label: t("header.nav.entries"), icon: Ticket },
    { href: "/how-it-works", label: t("header.nav.howItWorks"), icon: HelpCircle },
  ] as const;
}

function getSupportLinks(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
) {
  return [
    { href: "/faq", label: t("header.nav.faq"), icon: HelpCircle },
    { href: "/contact", label: t("header.nav.contact"), icon: HelpCircle },
  ] as const;
}

type HeaderMobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const HeaderMobileNavContext = createContext<HeaderMobileNavContextValue | null>(null);

export function useHeaderMobileNav() {
  const context = useContext(HeaderMobileNavContext);
  if (!context) {
    throw new Error("useHeaderMobileNav must be used within HeaderMobileNavProvider");
  }
  return context;
}

export function HeaderMobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  useCloseOnRouteChange(close);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((current) => !current),
    }),
    [open]
  );

  return (
    <HeaderMobileNavContext.Provider value={value}>
      {children}
      <HeaderMobileNavSheet open={open} onOpenChange={setOpen} onClose={close} />
    </HeaderMobileNavContext.Provider>
  );
}

function HeaderMobileNavSheet({
  open,
  onOpenChange,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const features = useComplianceFeatures();
  const showPostalEntry = features.postalProminence;
  const showResponsiblePlay = features.publicResponsiblePlayPage;

  const { user, isAnonymous, isLoading: authLoading, logout } = useAuth();
  const logicalPathname = useLogicalPathname();

  const isActive = (href: string) => {
    if (href === "/") return logicalPathname === "/";
    return logicalPathname.startsWith(href);
  };

  return (
    <MobileNavSheet
      open={open}
      onOpenChange={onOpenChange}
      onClose={onClose}
      side="right"
      title={t("header.mobile.menuTitle")}
    >
      <HeaderMobileNavContent
        showPostalEntry={showPostalEntry}
        showResponsiblePlay={showResponsiblePlay}
        authLoading={authLoading}
        isAnonymous={isAnonymous}
        user={user}
        logout={logout}
        onClose={onClose}
        isActive={isActive}
      />
    </MobileNavSheet>
  );
}

function HeaderMobileNavContent({
  showPostalEntry,
  showResponsiblePlay,
  authLoading,
  isAnonymous,
  user,
  logout,
  onClose,
  isActive,
}: {
  showPostalEntry: boolean;
  showResponsiblePlay: boolean;
  authLoading: boolean;
  isAnonymous: boolean;
  user: import("@oc/types").User | null;
  logout: () => Promise<void>;
  onClose: () => void;
  isActive: (href: string) => boolean;
}) {
  const { t } = useTranslation();
  const { isExiting } = useSheetNav();
  const NAV_ITEMS = getNavItems(t);
  const SUPPORT_LINKS = getSupportLinks(t);

  return (
    <>
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gold/10">
        <NavSheetLink
          href="/"
          className="hover:brightness-110 transition-all"
          data-umami-event="mobile-nav:logo-click"
        >
          <BrandLogo className="text-gold" />
        </NavSheetLink>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("header.mobile.closeMenu")}
          className="h-11 w-11 rounded-full hover:bg-gold/10 active:scale-95 touch-manipulation"
          onClick={onClose}
          data-umami-event="mobile-nav:close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain py-2 pb-4">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <p className={mobileNavSectionClass()}>{t("header.mobile.navigation")}</p>
            {user && !authLoading && !isAnonymous ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await logout();
                  } catch {
                    toast.error(t("header.auth.failedSignOut"));
                  }
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-md min-h-[32px] px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-red-400 active:text-red-400 transition-colors touch-manipulation"
                aria-label={t("header.auth.signOut")}
                data-umami-event="mobile-nav:sign-out"
              >
                <LogOut className="size-3.5" />
                {t("header.auth.signOut")}
              </button>
            ) : null}
          </div>

          {(!isAnonymous
            ? [
                ...NAV_ITEMS,
                {
                  href: "/dashboard",
                  label: t("header.mobile.dashboard"),
                  icon: LayoutDashboard,
                },
              ]
            : NAV_ITEMS
          ).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <NavSheetLink
                key={item.href}
                href={item.href}
                className={mobileNavItemClass(active)}
                data-umami-event={`mobile-nav:${item.label.toLowerCase().replace(/\s+/g, "-")}-click`}
              >
                <div className={mobileNavIconWrapClass(active)}>
                  <Icon className="w-4 h-4 text-gold" />
                </div>
                {item.label}
                {active && !isExiting ? (
                  <span
                    className="ml-auto size-1.5 shrink-0 rounded-full bg-gold"
                    aria-hidden="true"
                  />
                ) : null}
              </NavSheetLink>
            );
          })}
        </div>

        <div className="px-3 py-2 mt-2">
          <p className={mobileNavSectionClass()}>{t("header.mobile.support")}</p>
          {SUPPORT_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <NavSheetLink
                key={item.href}
                href={item.href}
                className={mobileNavItemClass()}
                data-umami-event={`mobile-nav:${item.label.toLowerCase().replace(/\s+/g, "-")}-click`}
              >
                <div className={mobileNavIconWrapClass()}>
                  <Icon className="w-4 h-4 text-gold" />
                </div>
                {item.label}
              </NavSheetLink>
            );
          })}
          {showPostalEntry ? (
            <NavSheetLink
              href="/free-postal-entry"
              className={mobileNavItemClass()}
              data-umami-event="mobile-nav:free-postal-entry-click"
            >
              <div className={mobileNavIconWrapClass()}>
                <Mail className="w-4 h-4 text-gold" />
              </div>
              {t("footer.freePostalEntry")}
            </NavSheetLink>
          ) : null}
          {showResponsiblePlay ? (
            <NavSheetLink href="/responsible-play" className={mobileNavItemClass()}>
              <div className={mobileNavIconWrapClass()}>
                <Shield className="w-4 h-4 text-gold" />
              </div>
              {t("header.nav.responsiblePlay")}
            </NavSheetLink>
          ) : null}
        </div>

        <div className="px-3 py-3 mt-1 border-t border-gold/10">
          <p className={mobileNavSectionClass()}>{t("header.followUs")}</p>
          <SocialLinksChips umamiEvent="mobile-nav:social-click" />
        </div>
      </div>

      <div className="p-4 border-t border-gold/10 bg-card/80 backdrop-blur-sm">
        <div
          className={cn(
            "flex gap-2 transition-all duration-300",
            authLoading && "opacity-100",
            !authLoading && "opacity-0 absolute inset-x-4 bottom-4 pointer-events-none"
          )}
        >
          <Skeleton className="flex-1 h-10 rounded-xl" shimmer />
          <Skeleton className="flex-1 h-10 rounded-xl" shimmer />
        </div>

        {!authLoading && user && !isAnonymous ? (
          <NavSheetActionButton href="/dashboard" variant="default" className="w-full">
            <LayoutDashboard data-icon="inline-start" />
            {t("header.mobile.dashboard")}
          </NavSheetActionButton>
        ) : !authLoading && (!user || isAnonymous) ? (
          <div className="flex gap-2">
            <NavSheetActionButton
              href="/auth/login"
              variant="outline"
              className="flex-1"
              data-umami-event="mobile-nav:sign-in"
            >
              {t("header.auth.signIn")}
            </NavSheetActionButton>
            <NavSheetActionButton
              href="/auth/sign-up"
              variant="default"
              className="flex-1"
              data-umami-event="mobile-nav:sign-up"
            >
              {t("header.auth.signUp")}
            </NavSheetActionButton>
          </div>
        ) : null}
      </div>
    </>
  );
}
