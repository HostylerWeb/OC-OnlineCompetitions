"use client";

import { api, useAuth, usePushSubscription } from "@oc/api-admin";
import {
  Bell,
  BellOff,
  ChevronsUpDown,
  ExternalLink,
  LogOut,
  Smartphone,
  User,
} from "@oc/icons";
import { getDisplayName } from "@oc/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PushNotificationPreferences } from "@/components/notifications/PushNotificationPreferences";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const DISMISS_KEY = "pwa-install-dismissed-v2";
const RESHOW_EVENT = "pwa-install-reshow";
const RESHOW_MS = 30 * 24 * 60 * 60 * 1000;

interface NavUserProps {
  siteUrl?: string;
  loginPath?: string;
}

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const parsed: { at?: number } = JSON.parse(raw);
    if (typeof parsed?.at !== "number") return false;
    return Date.now() - parsed.at < RESHOW_MS;
  } catch {
    return false;
  }
}

export function NavUser({
  siteUrl = "https://onlinecompetitions.co.uk",
  loginPath = "/auth/login",
}: NavUserProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isMobile } = useSidebar();

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

  const handleLogout = () => {
    void logout();
    router.replace(loginPath);
  };

  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [pwaDismissed, setPwaDismissed] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);

  useEffect(() => {
    setPwaDismissed(readDismissed());
    setPwaInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const handler = () => setPwaDismissed(readDismissed());
    window.addEventListener(RESHOW_EVENT, handler);
    const dismissHandler = () => setPwaDismissed(readDismissed());
    window.addEventListener("pwa-install-dismiss", dismissHandler);
    return () => {
      window.removeEventListener(RESHOW_EVENT, handler);
      window.removeEventListener("pwa-install-dismiss", dismissHandler);
    };
  }, []);

  function reEnablePwaPrompt() {
    localStorage.removeItem(DISMISS_KEY);
    setPwaDismissed(false);
    window.dispatchEvent(new CustomEvent(RESHOW_EVENT));
  }

  const displayName =
    getDisplayName(
      {
        firstName: user?.firstName ?? undefined,
        lastName: user?.lastName ?? undefined,
      },
      user?.email ?? ""
    ) ||
    user?.email?.split("@")[0] ||
    "Admin";

  const roleLabel = user?.role === "manager" ? "Manager" : user?.role === "admin" ? "Admin" : "";

  const initials = user?.firstName
    ? [user.firstName, user.lastName]
        .filter(Boolean)
        .map((n) => n![0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() ?? "U");

  const pushBlocked = permission === "denied" || pushState === "denied";
  const pushReady = pushState !== "loading" && pushState !== "unsupported" && pushState !== "error";
  const pushSubscribed = pushState === "subscribed";

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-[color-mix(in_srgb,var(--sidebar-foreground)_8%,var(--sidebar))] data-[state=open]:text-sidebar-foreground"
                data-umami-event="nav:user-menu-open"
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {roleLabel ? `${roleLabel} · ` : ""}
                    {user?.email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-60" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-60 p-0"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={6}
            >
              <DropdownMenuLabel className="px-3 py-3 font-normal">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup className="p-1">
                <DropdownMenuItem asChild>
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-umami-event="nav:visit-site"
                  >
                    <ExternalLink />
                    Visit site
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/users")}
                  data-umami-event="nav:manage-users"
                >
                  <User />
                  Manage users
                </DropdownMenuItem>
                {pushReady && !pushBlocked && (
                  <>
                    <DropdownMenuItem
                      onClick={() => (pushSubscribed ? unsubscribe() : subscribe())}
                      data-umami-event="nav:toggle-push"
                    >
                      {pushSubscribed ? <Bell /> : <BellOff />}
                      {pushSubscribed ? "Disable notifications" : "Enable notifications"}
                    </DropdownMenuItem>
                    {pushSubscribed && (
                      <DropdownMenuItem
                        onClick={() => setPreferencesOpen(true)}
                        data-umami-event="nav:notification-preferences"
                      >
                        <Bell />
                        Notification preferences
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {pwaDismissed && !pwaInstalled && (
                  <DropdownMenuItem onClick={reEnablePwaPrompt} data-umami-event="nav:install-pwa">
                    <Smartphone />
                    Install App
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <div className="p-1">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  data-umami-event="nav:sign-out"
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <PushNotificationPreferences open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </>
  );
}
