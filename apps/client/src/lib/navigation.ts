// navigation.ts — thin router helpers used inside React islands.
//
// Vike handles client-side routing via standard `<a href>` links (with
// prefetching). We expose `useRouter()` and `usePathname()` / `useSearchParams()`
// that read from the URL on first paint, then subscribe to `popstate` /
// manual `pushState`/`replaceState` events so they update on programmatic
// navigation triggered via our tiny `router.push` helper.
//
// This is intentionally minimal — we don't have a full router. Real
// navigations happen via `<a href>` (Vike handles prefetch) or by
// `window.location.assign()`.

"use client";

import { useSyncExternalStore } from "react";

const subscribers = new Set<() => void>();

function emit() {
  for (const s of subscribers) s();
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot() {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

function getServerSnapshot() {
  return "";
}

function searchSnapshot() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function searchServerSnapshot() {
  return "";
}

let listenersAttached = false;
function attachListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener("popstate", emit);
  window.addEventListener("onlinecompetitions:navigate", emit);
}

export function usePathname(): string {
  attachListeners();
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useSearchParams(): URLSearchParams {
  attachListeners();
  const search = useSyncExternalStore(subscribe, searchSnapshot, searchServerSnapshot);
  return new URLSearchParams(search);
}

export interface RouterPushOptions {
  scroll?: boolean;
}

export interface AppRouter {
  push: (href: string, options?: RouterPushOptions) => void;
  replace: (href: string, options?: RouterPushOptions) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (href: string) => void;
}

export function useRouter(): AppRouter {
  attachListeners();

  return {
    push(href, options = {}) {
      if (typeof window === "undefined") return;
      if (href === window.location.pathname + window.location.search) return;
      window.history.pushState({}, "", href);
      if (options.scroll !== false) window.scrollTo({ top: 0, behavior: "instant" });
      window.dispatchEvent(new Event("onlinecompetitions:navigate"));
    },
    replace(href, options = {}) {
      if (typeof window === "undefined") return;
      window.history.replaceState({}, "", href);
      if (options.scroll !== false) window.scrollTo({ top: 0, behavior: "instant" });
      window.dispatchEvent(new Event("onlinecompetitions:navigate"));
    },
    back() {
      if (typeof window === "undefined") return;
      window.history.back();
    },
    forward() {
      if (typeof window === "undefined") return;
      window.history.forward();
    },
    refresh() {
      if (typeof window === "undefined") return;
      window.location.reload();
    },
    prefetch(href) {
      if (typeof window === "undefined") return;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = href;
      document.head.appendChild(link);
    },
  };
}
