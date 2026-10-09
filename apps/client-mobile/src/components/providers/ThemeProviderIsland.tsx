// ThemeProvider.tsx — dark/light theme management with localStorage persistence.

import { type ReactNode, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "oc-theme";
const DEFAULT_THEME: Theme = "dark";

const listeners = new Set<(t: Theme) => void>();
let currentTheme: Theme = DEFAULT_THEME;

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

function notify(theme: Theme) {
  currentTheme = theme;
  for (const l of listeners) l(theme);
}

function readInitial(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  return defaultTheme;
}

export function ThemeProviderIsland({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = STORAGE_KEY,
}: {
  children?: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [_theme, setThemeState] = useState<Theme>(defaultTheme);

  useEffect(() => {
    const initial = readInitial(defaultTheme);
    applyTheme(initial);
    setThemeState(initial);
    notify(initial);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        applyTheme(e.newValue);
        setThemeState(e.newValue);
        notify(e.newValue);
      }
    };
    const onCustomSet = (e: Event) => {
      const detail = (e as CustomEvent<{ theme: Theme }>).detail;
      if (detail?.theme === "light" || detail?.theme === "dark") {
        applyTheme(detail.theme);
        setThemeState(detail.theme);
        notify(detail.theme);
        try {
          window.localStorage.setItem(storageKey, detail.theme);
        } catch {
          // ignore
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "d" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        return;
      e.preventDefault();
      const next: Theme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(next);
      setThemeState(next);
      notify(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // ignore
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("onlinecompetitions:theme:set", onCustomSet as EventListener);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("onlinecompetitions:theme:set", onCustomSet as EventListener);
      window.removeEventListener("keydown", onKey);
    };
  }, [defaultTheme, storageKey]);

  return <>{children}</>;
}

export function setOnlineCompetitionsTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("onlinecompetitions:theme:set", { detail: { theme } }));
}

export function getCurrentTheme(): Theme {
  return currentTheme;
}
