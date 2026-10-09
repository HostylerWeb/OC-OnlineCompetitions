import axios, { type AxiosInstance, type AxiosError, AxiosHeaders } from "axios";

export interface ApiAxiosOptions {
  baseURL: string;
  redirectPath?: string;
  defaultTimeout?: number;
  getSessionSnapshot?: () => { isLoading: boolean; isAnonymous: boolean; isLoggingOut: boolean };
  setSessionLoggingOut?: (val: boolean) => void;
  logoutAll?: () => Promise<void>;
  clearQueryClient?: () => void;
  getAuthRedirectPath?: (opts: { refCode?: string; returnTo?: string }) => string;
}

const AUTH_BYPASS_PATHS = ["/api/auth-"];
const REDIRECT_THROTTLE_MS = 5_000;

export function createApiAxios(options: ApiAxiosOptions): AxiosInstance {
  const {
    baseURL,
    redirectPath = "/auth/login",
    defaultTimeout = 15_000,
    getSessionSnapshot,
    setSessionLoggingOut,
    logoutAll,
    clearQueryClient,
    getAuthRedirectPath,
  } = options;

  const instance = axios.create({
    baseURL,
    withCredentials: true,
    timeout: defaultTimeout,
    headers: { "Content-Type": "application/json", "X-Online Competitions-Client": "1" },
  });

  instance.interceptors.request.use((config) => {
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      const headers = AxiosHeaders.from(config.headers);
      headers.delete("Content-Type");
      headers.delete("content-type");
      config.headers = headers;
    } else {
      config.headers = AxiosHeaders.from(config.headers);
    }
    config.headers.set("X-Request-ID", crypto.randomUUID());
    if (typeof document !== "undefined") {
      const clickId = document.cookie.match(/(?:^|; )_aff_clickid=([^;]*)/)?.[1];
      if (clickId) {
        config.headers.set("X-Affiliate-Clickid", decodeURIComponent(clickId));
      }
      const source = document.cookie.match(/(?:^|; )_aff_source=([^;]*)/)?.[1];
      if (source) {
        config.headers.set("X-Affiliate-Source", decodeURIComponent(source));
      }
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status !== 401) return Promise.reject(error);

      const path = error.config?.url ?? "";
      if (AUTH_BYPASS_PATHS.some((p) => path.includes(p))) return Promise.reject(error);

      const snapshot = getSessionSnapshot?.();
      if (snapshot?.isLoggingOut || snapshot?.isLoading || snapshot?.isAnonymous) {
        return Promise.reject(error);
      }

      if (path.startsWith("/api/cart") || path.includes("/api/referral-code/claim")) {
        return Promise.reject(error);
      }

      const lastKey = "last_auth_redirect_time";
      const now = Date.now();
      const last = parseInt(sessionStorage?.getItem(lastKey) ?? "0", 10);
      if (now - last < REDIRECT_THROTTLE_MS) return Promise.reject(error);
      sessionStorage?.setItem(lastKey, String(now));

      setSessionLoggingOut?.(true);
      Promise.resolve().then(() => logoutAll?.());
      clearQueryClient?.();

      if (typeof window !== "undefined") {
        const returnTo = window.location.pathname + window.location.search;
        const redirectUrl = getAuthRedirectPath?.({ returnTo });
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
          window.location.href = `${redirectPath}${qs}`;
        }
      }

      return Promise.reject(error);
    },
  );

  return instance;
}
