"use client";

import { useAuth } from "@oc/api-admin";
import * as Sentry from "@sentry/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN?.trim() ?? "";

export function SentryTelemetry() {
  const pathname = usePathname();
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
