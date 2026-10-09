import { getEnv } from "@oc/env/next";
import { getSessionCookiePrefix } from "@oc/utils";
import * as Sentry from "@sentry/react";
import {
  adminClient,
  anonymousClient,
  emailOTPClient,
  magicLinkClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Monitor GlitchTip OC-WEB-4/5 for 48h post-deploy; recurring TimeoutErrors may indicate API restarts.
const AUTH_FETCH_TIMEOUT_MS = 10_000;

export interface AuthClientRequestError {
  message: string;
  code?: string;
}

function isTimeoutLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError") return true;
  return /timed out/i.test(error.message);
}

function isZodError(
  error: unknown
): error is { issues: Array<{ message: string; path: (string | number)[] }> } {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as Record<string, unknown>).issues)
  );
}

function getZodErrorMessage(error: {
  issues: Array<{ message: string; path: (string | number)[] }>;
}): string {
  const messages = error.issues.map((issue) => issue.message).filter(Boolean);
  return messages.length > 0 ? messages.join("; ") : "Invalid input. Please check your entries.";
}

export function normalizeAuthClientError(error: unknown): AuthClientRequestError {
  if (isTimeoutLikeError(error)) {
    Sentry.captureMessage("Auth timeout", { level: "error", tags: { domain: "auth.client" } });
    return {
      code: "AUTH_TIMEOUT",
      message: "We could not reach the server in time. Please try again.",
    };
  }

  if (isZodError(error)) {
    return {
      code: "AUTH_VALIDATION_ERROR",
      message: getZodErrorMessage(error),
    };
  }

  if (error instanceof Error) {
    if (/fetch failed|network/i.test(error.message)) {
      Sentry.captureMessage("Auth network error", {
        level: "error",
        tags: { domain: "auth.client" },
      });
      return {
        code: "AUTH_NETWORK_ERROR",
        message: "We could not reach the server. Please check your connection and try again.",
      };
    }

    const message = error.message.trim();
    if (message) {
      Sentry.captureMessage("Auth request failed", {
        level: "error",
        tags: { domain: "auth.client" },
        extra: { message },
      });
      return { code: "AUTH_REQUEST_FAILED", message };
    }
  }

  Sentry.captureMessage("Auth error", { level: "error", tags: { domain: "auth.client" } });
  return {
    code: "AUTH_REQUEST_FAILED",
    message: "Authentication is temporarily unavailable. Please try again.",
  };
}

export async function safelyRunAuthRequest<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    return { error: normalizeAuthClientError(error) } as T;
  }
}

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : getEnv("APP_URL").trim().replace(/\/$/, ""),
  fetchOptions: {
    credentials: "include",
    onRequest: (context) => ({
      ...context,
      signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    }),
  },
  advanced: {
    cookiePrefix: getSessionCookiePrefix(getEnv("APP_URL"), "admin"),
  },
  plugins: [anonymousClient(), emailOTPClient(), magicLinkClient(), adminClient()],
});

export type AuthClientSession = typeof authClient.$Infer.Session;
