"use client";

import { Home, LayoutDashboard, MoreHorizontal, Ticket, Trophy } from "@oc/icons";
import { cn } from "@oc/utils";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserState } from "@/hooks";
import { useTranslation } from "@/lib/i18n";

const TABS = [
  { id: "home", href: "/", labelKey: "header.nav.home", icon: Home, requiresAuth: false },
  {
    id: "competitions",
    href: "/competitions",
    labelKey: "header.nav.competitions",
    icon: Trophy,
    requiresAuth: false,
  },
  {
    id: "tickets",
    href: "/entries",
    labelKey: "header.nav.entries",
    icon: Ticket,
    requiresAuth: false,
  },
  {
    id: "dashboard",
    href: "/dashboard",
    labelKey: "header.mobile.dashboard",
    icon: LayoutDashboard,
    requiresAuth: true,
  },
  {
    id: "more",
    href: "/more",
    labelKey: "header.nav.more",
    icon: MoreHorizontal,
    requiresAuth: false,
  },
] as const;

function useActiveTab(pathname: string) {
  for (const tab of TABS) {
    if (tab.id === "home" && pathname === "/") return tab.id;
    if (tab.id !== "home" && pathname.startsWith(tab.href)) return tab.id;
  }
  return null;
}

interface MobileBottomNavProps {
  onMorePress: () => void;
}

export function MobileBottomNav({ onMorePress }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useUserState();
  const activeTab = useActiveTab(location.pathname);

  const handlePress = useCallback(
    (tab: (typeof TABS)[number]) => {
      if (tab.id === "more") {
        onMorePress();
        return;
      }
      if (tab.requiresAuth && !isAuthenticated) {
        navigate(`/auth/login?returnTo=${encodeURIComponent(tab.href)}`);
        return;
      }
      navigate(tab.href);
    },
    [navigate, isAuthenticated, onMorePress]
  );

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-2xl border-t border-border pb-safe-bottom">
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handlePress(tab)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 px-1 transition-colors active:scale-95 touch-manipulation",
                isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium leading-tight truncate max-w-full">
                {tab.id === "more" ? "More" : t(tab.labelKey as any)}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 size-1 rounded-full bg-gold" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
