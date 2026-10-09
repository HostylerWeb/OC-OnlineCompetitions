import { createApiAxios } from "@oc/api-axios";
import { getEnv } from "@oc/env/vike";
import type { ApiResponse } from "@oc/types";
import type { AxiosError } from "axios";
import { getSessionSnapshot, setSessionLoggingOut } from "./auth/session-snapshot";
import { getGlobalQueryClient } from "./query-client";
import { getAuthRedirectPath, parseRefFromSearch } from "./referral/redirect";
import { logoutAll as logoutAllFn } from "./stores/clear-all";

export const API_DEFAULT_TIMEOUT_MS = 15_000;
export const API_CHECKOUT_TIMEOUT_MS = 60_000;
export const API_ADMIN_INSTANT_PRIZE_ASSIGN_TIMEOUT_MS = 120_000;

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiResponseError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiResponseError";
  }
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryOnTimeout?: boolean;
}

export const checkoutRequestOptions: RequestOptions = {
  timeout: API_CHECKOUT_TIMEOUT_MS,
  retries: 1,
  retryOnTimeout: false,
};

export const adminInstantPrizeAssignPostOptions: RequestOptions = {
  timeout: API_ADMIN_INSTANT_PRIZE_ASSIGN_TIMEOUT_MS,
  retries: 0,
};

export const adminInstantPrizeAssignMutationOptions: RequestOptions = {
  timeout: API_ADMIN_INSTANT_PRIZE_ASSIGN_TIMEOUT_MS,
};

export function idempotencyKeyFromCartId(cartId: string | null | undefined): string | undefined {
  return cartId ?? undefined;
}

const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : getEnv("APP_URL").trim().replace(/\/$/, "");

let apiAxios = createApiAxios({
  baseURL,
  getSessionSnapshot,
  setSessionLoggingOut,
  logoutAll: logoutAllFn,
  clearQueryClient: () => getGlobalQueryClient().clear(),
  getAuthRedirectPath: (opts) =>
    getAuthRedirectPath({
      ...opts,
      refCode: parseRefFromSearch(typeof window !== "undefined" ? window.location.search : ""),
    }),
});

/** Override the base URL at runtime (used by Capacitor mobile app). */
export function setApiBaseUrl(url: string): void {
  apiAxios.defaults.baseURL = url.replace(/\/$/, "");
}

function isAxiosError(err: unknown): err is AxiosError {
  return (err as AxiosError)?.isAxiosError === true;
}

function toApiResponseError(err: unknown): ApiResponseError {
  if (isAxiosError(err) && err.response) {
    const body = err.response.data as ApiError | undefined;
    return new ApiResponseError(
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? err.message,
      err.response.status,
      body
    );
  }
  return new ApiResponseError(
    "NETWORK_ERROR",
    err instanceof Error ? err.message : "Network error",
    0
  );
}

export const api = {
  async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const config: Record<string, unknown> = {};
      if (options?.params) config.params = options.params;
      if (options?.headers) config.headers = options.headers;
      if (options?.timeout) config.timeout = options.timeout;
      const res = await apiAxios.get<ApiResponse<T>>(path, config);
      return res.data;
    } catch (err) {
      throw toApiResponseError(err);
    }
  },

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const config: Record<string, unknown> = {};
      if (options?.timeout) config.timeout = options.timeout;
      if (body instanceof FormData) {
        const res = await apiAxios.post<ApiResponse<T>>(path, body, {
          timeout: options?.timeout,
          headers: options?.headers,
        });
        return res.data;
      }
      if (options?.headers) config.headers = options.headers;
      const res = await apiAxios.post<ApiResponse<T>>(path, body, config);
      return res.data;
    } catch (err) {
      throw toApiResponseError(err);
    }
  },

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const config: Record<string, unknown> = {};
      if (options?.headers) config.headers = options.headers;
      if (options?.timeout) config.timeout = options.timeout;
      const res = await apiAxios.put<ApiResponse<T>>(path, body, config);
      return res.data;
    } catch (err) {
      throw toApiResponseError(err);
    }
  },

  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const config: Record<string, unknown> = {};
      if (options?.headers) config.headers = options.headers;
      if (options?.timeout) config.timeout = options.timeout;
      const res = await apiAxios.patch<ApiResponse<T>>(path, body, config);
      return res.data;
    } catch (err) {
      throw toApiResponseError(err);
    }
  },

  async delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const config: Record<string, unknown> = {};
      if (options?.params) config.params = options.params;
      if (options?.headers) config.headers = options.headers;
      if (options?.timeout) config.timeout = options.timeout;
      const res = await apiAxios.delete<ApiResponse<T>>(path, config);
      return res.data;
    } catch (err) {
      throw toApiResponseError(err);
    }
  },
};

export { api as default };
