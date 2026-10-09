"use client";

import { useAuth } from "@oc/api-client";
import * as Sentry from "@sentry/react";
import { useEffect, useRef } from "react";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB?.trim() ?? "";

export function SentryTelemetry() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!dsn) {
      return;
    }

    if (pathname !== previousPathRef.current) {
      previousPathRef.current = pathname;
      Sentry.setTag("route", pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (!dsn) {
      return;
    }

    if (userId) {
      Sentry.setUser({ id: userId });
      return;
    }

    Sentry.setUser(null);
  }, [userId]);

  return null;
}
