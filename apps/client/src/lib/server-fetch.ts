// server-fetch.ts — server-only wrapper that calls the Hono API in-process.
//
// Replaces the Next.js version that used server-side fetch with retries.

import { app } from "@oc/api-server/app";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PUBLIC_TIMEOUT_MS = 25_000;

export interface ServerFetchOptions {
  cookieHeader?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

export type ApiResponse<T> = { data: T; meta?: Record<string, unknown> };

function withTimeout<T>(
  promiseOrValue: T | Promise<T>,
  ms: number,
  onTimeout: () => void
): Promise<T> {
  const promise = Promise.resolve(promiseOrValue);
  if (ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error("Request timed out"));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function buildInternalRequest(path: string, options: ServerFetchOptions): Request {
  const url = new URL(path, "http://internal");
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };
  if (options.cookieHeader) headers.cookie = options.cookieHeader;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  return new Request(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

export async function serverFetch<T>(
  path: string,
  options: ServerFetchOptions = {}
): Promise<ApiResponse<T> | null> {
  const isPublic =
    path.startsWith("/api/") &&
    (path.startsWith("/api/competitions") ||
      path.startsWith("/api/categories") ||
      path.startsWith("/api/winners") ||
      path.startsWith("/api/stats") ||
      path.startsWith("/api/entries") ||
      path.startsWith("/api/referral-settings") ||
      path.startsWith("/api/compliance-settings") ||
      path.startsWith("/api/public") ||
      path.startsWith("/api/ending-soon-settings") ||
      path.startsWith("/api/homepage-layout-settings") ||
      path.startsWith("/api/promo-codes") ||
      path === "/r" ||
      path.startsWith("/r/"));
  const timeout = options.timeoutMs ?? (isPublic ? DEFAULT_PUBLIC_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  const request = buildInternalRequest(path, options);
  let timedOut = false;
  try {
    const res = await withTimeout(app.fetch(request), timeout, () => {
      timedOut = true;
    });
    if (!res.ok) return null;
    return (await res.json()) as ApiResponse<T>;
  } catch (_err) {
    if (timedOut) return null;
    return null;
  }
}

export async function serverFetchRaw(
  path: string,
  options: ServerFetchOptions = {}
): Promise<unknown | null> {
  const isPublic = path.startsWith("/api/public") || path.startsWith("/api/competitions");
  const timeout = options.timeoutMs ?? (isPublic ? DEFAULT_PUBLIC_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const request = buildInternalRequest(path, options);

  let timedOut = false;
  try {
    const res = await withTimeout(app.fetch(request), timeout, () => {
      timedOut = true;
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    if (timedOut) return null;
    return null;
  }
}
