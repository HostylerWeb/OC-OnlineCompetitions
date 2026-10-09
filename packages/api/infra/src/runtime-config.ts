import { getBool, getEnv } from "@oc/env/server";

export function authUrlIsHttps(): boolean {
  return (getEnv("APP_URL") ?? "").startsWith("https://");
}

export function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1");
  }
}

export function isLocalDevRuntime(): boolean {
  const appUrl = getEnv("APP_URL")?.trim();

  if (!appUrl) {
    return true;
  }

  return isLocalhostUrl(appUrl);
}

export const runtimeConfig = {
  get secureCookies(): boolean {
    return getBool("SECURE_COOKIES", authUrlIsHttps());
  },
  get enableHsts(): boolean {
    return authUrlIsHttps();
  },
  get logErrorStacks(): boolean {
    return getBool("LOG_ERROR_STACKS", false);
  },
  get exitOnFatalError(): boolean {
    return getBool("API_EXIT_ON_FATAL_ERROR", false);
  },
  get requireDbAtStartup(): boolean {
    return getBool("API_REQUIRE_DB_AT_STARTUP", false);
  },
  get enableLocalPaymentMethod(): boolean {
    return getBool("ENABLE_LOCAL_PAYMENT_METHOD", false);
  },
  get logDbConnectDebug(): boolean {
    return getBool("LOG_DB_CONNECT_DEBUG", false);
  },
  get allowDevScripts(): boolean {
    return getBool("ALLOW_DEV_SCRIPTS", false);
  },
};

export function resetRuntimeConfigForTests(): void {}
