"use client";

import { getEnv } from "@oc/env/next";
import { useCallback, useEffect, useRef, useState } from "react";

export type PushSubscriptionState =
  | "unsupported"
  | "loading"
  | "default"
  | "denied"
  | "subscribed"
  | "unsubscribed"
  | "error";

export interface UsePushSubscriptionOptions {
  onSubscribe: (sub: PushSubscriptionJSON) => Promise<unknown>;
  onUnsubscribe?: () => Promise<unknown>;
  vapidPublicKey?: string;
  swPath?: string;
}

export interface UsePushSubscriptionResult {
  state: PushSubscriptionState;
  permission: NotificationPermission | "unsupported";
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  refresh: () => Promise<void>;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

export function usePushSubscription(
  options: UsePushSubscriptionOptions
): UsePushSubscriptionResult {
  const { onSubscribe, onUnsubscribe, vapidPublicKey, swPath = "/sw.js" } = options;
  const [state, setState] = useState<PushSubscriptionState>("loading");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [error, setError] = useState<string | null>(null);
  const refreshedRef = useRef(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const refresh = useCallback(async () => {
    if (!isSupported) {
      setState("unsupported");
      setPermission("unsupported");
      return;
    }

    // Check permission synchronously first
    const perm = Notification.permission;
    setPermission(perm);

    if (perm === "denied") {
      setState("denied");
      return;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) {
        setState("unsubscribed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setState("subscribed");
      } else {
        setState("unsubscribed");
      }
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [isSupported]);

  // Set permission synchronously on mount, before any async operations
  useEffect(() => {
    if (isSupported && typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  useEffect(() => {
    // Only run refresh once to avoid loops
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }
    setState("loading");
    setError(null);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.register(swPath, {
        updateViaCache: "none",
      });

      // Wait for the service worker to be active before subscribing
      if (reg.installing) {
        await new Promise<void>((resolve) => {
          const worker = reg.installing!;
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") resolve();
          });
        });
      }

      reg.active?.postMessage({ type: "CONFIG", cachingEnabled: false });

      const key = vapidPublicKey ?? getEnv("VAPID_PUBLIC_KEY");
      if (!key) {
        throw new Error("VAPID public key not configured");
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      await onSubscribe(sub.toJSON() as PushSubscriptionJSON);
      setState("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [isSupported, vapidPublicKey, swPath, onSubscribe]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }
    setState("loading");
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
      if (onUnsubscribe) {
        await onUnsubscribe();
      }
      setState("unsubscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [isSupported, onUnsubscribe]);

  return { state, permission, error, subscribe, unsubscribe, refresh };
}
