"use client";

import { Smartphone, X } from "@oc/icons";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-v2";
const RESHOW_EVENT = "pwa-install-reshow";
const RESHOW_DAYS = 30;
const RESHOW_MS = RESHOW_DAYS * 24 * 60 * 60 * 1000;

interface DismissRecord {
  at: number;
}

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const parsed: DismissRecord = JSON.parse(raw);
    if (typeof parsed?.at !== "number") return false;
    return Date.now() - parsed.at < RESHOW_MS;
  } catch {
    return false;
  }
}

function writeDismissed() {
  const record: DismissRecord = { at: Date.now() };
  localStorage.setItem(DISMISS_KEY, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent("pwa-install-dismiss"));
}

function clearDismissed() {
  localStorage.removeItem(DISMISS_KEY);
  window.dispatchEvent(new CustomEvent(RESHOW_EVENT));
}

function useIsInstalled() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
    const handler = () => setInstalled(true);
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);
  return installed;
}

function useIsIOS() {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window));
  }, []);
  return isIOS;
}

function useDismissed() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(readDismissed());
    const handler = () => setDismissed(readDismissed());
    window.addEventListener(RESHOW_EVENT, handler);
    const dismissHandler = () => setDismissed(readDismissed());
    window.addEventListener("pwa-install-dismiss", dismissHandler);
    return () => {
      window.removeEventListener(RESHOW_EVENT, handler);
      window.removeEventListener("pwa-install-dismiss", dismissHandler);
    };
  }, []);
  return [dismissed, setDismissed] as const;
}

function useBeforeInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return [deferredPrompt, setDeferredPrompt] as const;
}

interface InstallPromptProps {
  appName?: string;
  tagline?: string;
}

function InstallPrompt({ appName, tagline }: InstallPromptProps = {}) {
  const installed = useIsInstalled();
  const isIOS = useIsIOS();
  const [dismissed] = useDismissed();
  const [deferredPrompt, setDeferredPrompt] = useBeforeInstallPrompt();
  const [installing, setInstalling] = useState(false);
  const { t } = useTranslation();

  if (installed || dismissed) return null;

  const heading = t("pwa.installHeading", { appName: appName ?? "Online Competitions" });
  const subtext = tagline ?? t("pwa.tagline");

  if (isIOS) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:bottom-4 sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2 sm:px-0 sm:pb-0">
        <div className="relative mx-auto max-w-md rounded-2xl border border-gold/20 bg-card/95 p-3 pr-4 text-sm shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 sm:p-4">
          <button
            type="button"
            onClick={writeDismissed}
            aria-label={t("pwa.dismiss")}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground active:scale-95 transition-all touch-manipulation"
            data-umami-event="pwa:dismiss-prompt"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Smartphone className="size-5" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <p className="mb-1 font-semibold text-foreground">{heading}</p>
              <p className="text-xs text-muted-foreground">
                Tap{" "}
                <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                  {t("pwa.share")}
                </span>{" "}
                then{" "}
                <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                  {t("pwa.addToHomeScreen")}
                </span>
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground/80">{subtext}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (deferredPrompt) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:bottom-4 sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2 sm:px-0 sm:pb-0">
        <div className="relative mx-auto max-w-md rounded-2xl border border-gold/20 bg-card/95 p-3 pr-4 text-sm shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 sm:p-4">
          <button
            type="button"
            onClick={writeDismissed}
            aria-label={t("pwa.dismiss")}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground active:scale-95 transition-all touch-manipulation"
            data-umami-event="pwa:dismiss-prompt"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Smartphone className="size-5" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <p className="mb-1 font-semibold text-foreground">{heading}</p>
              <p className="text-xs text-muted-foreground">{subtext}</p>
              <Button
                variant="default"
                size="lg"
                className="mt-3 w-full h-11"
                disabled={installing}
                data-umami-event="pwa:install-click"
                onClick={async () => {
                  const promptEvent = deferredPrompt as BeforeInstallPromptEvent;
                  setInstalling(true);
                  try {
                    promptEvent.prompt();
                    const result = await promptEvent.userChoice;
                    if (result.outcome === "accepted") {
                      window.dispatchEvent(new CustomEvent("pwa-installed"));
                    } else {
                      writeDismissed();
                    }
                  } finally {
                    setDeferredPrompt(null);
                    setInstalling(false);
                  }
                }}
              >
                {installing ? t("pwa.installing") : t("pwa.install")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

interface PwaInstallPromptProps {
  appName?: string;
  tagline?: string;
}

export function PwaInstallPrompt({ appName, tagline }: PwaInstallPromptProps) {
  return <InstallPrompt appName={appName} tagline={tagline} />;
}

export { clearDismissed as reEnablePwaPrompt };
