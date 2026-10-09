import { getEnv } from "@oc/env/vike";
import * as Sentry from "@sentry/react";
import React from "react";
import { matchRoutes, useLocation, useNavigationType } from "react-router";
import { resolveSentryEnvironment, resolveSentryRelease } from "@/lib/sentry-config";

const dsn = getEnv("SENTRY_DSN_WEB").trim() || "";

if (typeof window !== "undefined" && dsn) {
  Sentry.init({
    dsn,
    environment: resolveSentryEnvironment(),
    release: resolveSentryRelease(),
    enabled: true,
    autoSessionTracking: false,
    sendClientReports: false,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: (integrations) => [
      ...integrations.filter((i) => i.name !== "BunServer"),
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ blockAllMedia: true }),
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren: React.createElement,
        matchRoutes,
      }),
    ],
    tracePropagationTargets: [/^\/api/, /^https:\/\/api\.(staging\.)?onlinecompetitions\.win/],
  });

  Sentry.setTag("app", "onlinecompetitions-web");
  Sentry.setTag("domain", "web");
}

export function isSentryEnabled(): boolean {
  return Boolean(dsn);
}

export function captureSentryTestError(): void {
  if (!dsn) return;
  Sentry.captureException(new Error("GlitchTip staging test error (onlinecompetitions-web)"));
}
