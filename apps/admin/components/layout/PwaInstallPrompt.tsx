"use client";

import { Smartphone, X } from "@oc/icons";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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

function InstallPrompt({ appName = "Online Competitions", tagline }: InstallPromptProps = {}) {
  const installed = useIsInstalled();
  const isIOS = useIsIOS();
  const [dismissed] = useDismissed();
  const [deferredPrompt, setDeferredPrompt] = useBeforeInstallPrompt();
  const [installing, setInstalling] = useState(false);

  if (installed || dismissed) return null;

  const heading = `Install ${appName}`;
  const subtext = tagline ?? "Add to your home screen for one-tap access";

  if (isIOS) {
    return (
      <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-gold/20 bg-card/95 p-4 text-sm shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4">
        <button
          type="button"
          onClick={writeDismissed}
          aria-label="Dismiss install prompt"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <Smartphone className="size-5" />
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <p className="mb-1 font-semibold text-foreground">{heading}</p>
            <p className="text-xs text-muted-foreground">
              Tap{" "}
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                Share
              </span>{" "}
              then{" "}
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                Add to Home Screen
              </span>
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground/80">{subtext}</p>
          </div>
        </div>
      </div>
    );
  }

  if (deferredPrompt) {
    return (
      <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-gold/20 bg-card/95 p-4 text-sm shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4">
        <button
          type="button"
          onClick={writeDismissed}
          aria-label="Dismiss install prompt"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <Smartphone className="size-5" />
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <p className="mb-1 font-semibold text-foreground">{heading}</p>
            <p className="text-xs text-muted-foreground">{subtext}</p>
            <Button
              variant="default"
              size="sm"
              className="mt-3 w-full"
              disabled={installing}
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
              {installing ? "Installing…" : "Install"}
            </Button>
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
