import { getEnv, getNum } from "@oc/env/server";
import * as Sentry from "@sentry/node";
import type { Context } from "hono";
import { ErrorCodes } from "./error-codes";
import { error } from "./response";

function resolveRelease(): string | undefined {
  const release = getEnv("SENTRY_RELEASE")?.trim();
  return release || undefined;
}

export function initSentry(): void {
  const dsn = getEnv("SENTRY_DSN")?.trim();
  if (!dsn) {
    return;
  }

  const tracesSampleRate = getNum("SENTRY_TRACES_SAMPLE_RATE", 0);

  Sentry.init({
    dsn,
    environment: getEnv("SENTRY_ENVIRONMENT", "development"),
    release: resolveRelease(),
    enabled: true,
    autoSessionTracking: false,
    sendClientReports: false,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    sendDefaultPii: false,
    integrations: [
      Sentry.modulesIntegration(),
      Sentry.contextLinesIntegration(),
      Sentry.captureConsoleIntegration({ levels: ["error", "warn"] }),
    ],
  });

  Sentry.setTag("domain", "api");
  Sentry.setTag("app", "onlinecompetitions-api");
}

export function isSentryEnabled(): boolean {
  return Boolean(getEnv("SENTRY_DSN")?.trim());
}

export function flushSentry(timeoutMs = 2_000): Promise<boolean> {
  if (!isSentryEnabled()) {
    return Promise.resolve(true);
  }
  return Sentry.flush(timeoutMs);
}

export interface RouteErrorContext {
  requestId?: string;
  path?: string;
  userId?: string | null;
  domain?: string;
  operation?: string;
  jobName?: string;
  runId?: string;
  lockStatus?: "acquired" | "locked" | "released" | "replayed";
  tags?: Record<string, string | number | boolean | null | undefined>;
  extras?: Record<string, unknown>;
}

export function captureRouteError(err: unknown, ctx: RouteErrorContext = {}): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("domain", ctx.domain ?? "api");
    if (ctx.operation) {
      scope.setTag("operation", ctx.operation);
    } else if (ctx.path) {
      scope.setTag("operation", "http");
    }
    if (ctx.jobName) {
      scope.setTag("jobName", ctx.jobName);
    }
    if (ctx.runId) {
      scope.setTag("runId", ctx.runId);
    }
    if (ctx.lockStatus) {
      scope.setTag("lockStatus", ctx.lockStatus);
    }
    if (ctx.requestId) {
      scope.setTag("requestId", ctx.requestId);
    }
    if (ctx.path) {
      scope.setTag("path", ctx.path);
    }
    if (ctx.userId) {
      scope.setUser({ id: ctx.userId });
    }
    if (ctx.tags) {
      for (const [key, value] of Object.entries(ctx.tags)) {
        if (value !== undefined && value !== null) {
          scope.setTag(key, String(value));
        }
      }
    }
    if (ctx.extras) {
      for (const [key, value] of Object.entries(ctx.extras)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(err);
  });
}

export function addSentryBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (!isSentryEnabled()) {
    return;
  }
  Sentry.addBreadcrumb({
    message,
    category,
    timestamp: Date.now() / 1000,
    data: data ?? {},
  });
}

export async function withRouteError(
  c: Context,
  operation: string,
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    return await fn();
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation,
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
}

export function captureRouteErrorWithOp(
  err: unknown,
  c: Context,
  operation: string,
  extras?: Record<string, unknown>
): void {
  captureRouteError(err, {
    requestId: c.get("requestId"),
    path: c.req.path,
    userId: c.get("userId") ?? null,
    operation,
    ...extras,
  });
}
