import { createServerAxios, type ServerAxiosOptions } from "@oc/api-axios";
import { getEnv } from "@oc/env/server";
import type { ApiResponse } from "@oc/types";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PUBLIC_TIMEOUT_MS = 10_000;
const DEFAULT_CHECKOUT_TIMEOUT_MS = 60_000;

export function getServerApiBase(): string {
  const url = getEnv("APP_URL").trim();
  if (!url) {
    throw new Error("Missing APP_URL — check environment variables");
  }
  return url.replace(/\/$/, "");
}

export type ServerFetchCache = "no-store" | "public";

export interface ServerFetchInit {
  cookieHeader: string;
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  next?: { revalidate?: number | false; tags?: string[] };
  headers?: Record<string, string>;
  cache?: ServerFetchCache;
}

function buildServerUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const base = getServerApiBase();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, `${base}/`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function buildServerHeaders(
  cookieHeader: string,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-ID": crypto.randomUUID(),
  };
  if (cookieHeader) headers.Cookie = cookieHeader;
  if (extra) Object.assign(headers, extra);
  return headers;
}

function buildCacheOptions(init: ServerFetchInit): {
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
} {
  if (init.cache !== "public") {
    return { cache: "no-store" };
  }
  if (init.cookieHeader && init.cookieHeader.trim() !== "") {
    throw new Error(
      `serverFetch: cache: "public" cannot be used with a non-empty cookieHeader. ` +
        `Either strip the cookie (the response must be the same for all users) ` +
        `or set cache: "no-store" / leave it unset for per-user data.`
    );
  }
  return {
    next: {
      revalidate: init.next?.revalidate ?? 60,
      tags: ["public", ...(init.next?.tags ?? [])],
    },
  };
}

const serverAxiosOptions: ServerAxiosOptions = {
  baseURL: getServerApiBase(),
  defaultTimeout: DEFAULT_TIMEOUT_MS,
  publicTimeout: DEFAULT_PUBLIC_TIMEOUT_MS,
};

const serverAxios = createServerAxios(serverAxiosOptions);

export async function serverFetch<T>(
  path: string,
  init: ServerFetchInit
): Promise<ApiResponse<T> | null> {
  if (init.cache === "public") {
    return serverFetchNative<T>(path, init);
  }

  const url = buildServerUrl(path, init.params);
  const headers = buildServerHeaders(init.cookieHeader, init.headers);
  const timeout = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const res = await serverAxios.get<ApiResponse<T>>(url, {
      headers,
      timeout,
      timeoutErrorMessage: `Timeout after ${timeout}ms`,
    });
    return res.data;
  } catch {
    return null;
  }
}

async function serverFetchNative<T>(
  path: string,
  init: ServerFetchInit
): Promise<ApiResponse<T> | null> {
  const url = buildServerUrl(path, init.params);
  const headers = buildServerHeaders(init.cookieHeader, init.headers);

  const controller = new AbortController();
  const timeout = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
      ...buildCacheOptions(init),
      ...(init.next ? { next: init.next } : {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function serverFetchRaw(path: string, init: ServerFetchInit): Promise<unknown | null> {
  const url = buildServerUrl(path, init.params);
  const headers = buildServerHeaders(init.cookieHeader, init.headers);
  const timeout = init.timeoutMs ?? DEFAULT_PUBLIC_TIMEOUT_MS;

  try {
    const res = await serverAxios.get(url, {
      headers,
      timeout,
      timeoutErrorMessage: `Timeout after ${timeout}ms`,
    });
    return res.data;
  } catch {
    return null;
  }
}

export async function serverFetchAll<T extends Record<string, string>>(
  paths: T,
  init: Omit<ServerFetchInit, "params"> & {
    paramsByPath?: Partial<Record<keyof T, ServerFetchInit["params"]>>;
  }
): Promise<{ [K in keyof T]: ApiResponse<unknown> | null }> {
  const entries = await Promise.all(
    (Object.entries(paths) as [keyof T, string][]).map(async ([key, path]) => {
      const data = await serverFetch<unknown>(path, {
        ...init,
        params: init.paramsByPath?.[key],
      });
      return [key, data] as const;
    })
  );
  return Object.fromEntries(entries) as { [K in keyof T]: ApiResponse<unknown> | null };
}

export const SERVER_FETCH_TIMEOUTS = {
  default: DEFAULT_TIMEOUT_MS,
  public: DEFAULT_PUBLIC_TIMEOUT_MS,
  checkout: DEFAULT_CHECKOUT_TIMEOUT_MS,
} as const;
