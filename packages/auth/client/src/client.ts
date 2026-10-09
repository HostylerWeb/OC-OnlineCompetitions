import { getEnv } from "@oc/env/vike";
import { getSessionCookiePrefix } from "@oc/utils";
import {
  adminClient,
  anonymousClient,
  emailOTPClient,
  magicLinkClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

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
      return {
        code: "AUTH_NETWORK_ERROR",
        message: "We could not reach the server. Please check your connection and try again.",
      };
    }

    const message = error.message.trim();
    if (message) {
      return { code: "AUTH_REQUEST_FAILED", message };
    }
  }

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

let _baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : getEnv("APP_URL").trim().replace(/\/$/, "");

function createClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    fetchOptions: {
      credentials: "include",
      onRequest: (context) => ({
        ...context,
        signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
      }),
    },
    advanced: {
      cookiePrefix: getSessionCookiePrefix(getEnv("APP_URL"), "client"),
    },
    plugins: [anonymousClient(), emailOTPClient(), magicLinkClient(), adminClient()],
  });
}

export let authClient = createClient(_baseURL);

export function setAuthBaseUrl(url: string): void {
  _baseURL = url.replace(/\/$/, "");
  authClient = createClient(_baseURL);
}

export type AuthClientSession = typeof authClient.$Infer.Session;
