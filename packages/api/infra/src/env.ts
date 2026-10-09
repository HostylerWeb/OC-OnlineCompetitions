import { getEnv } from "@oc/env/server";

let _cache: { frontendUrl: string; apiUrl: string; shopUrl: string } | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

function getDefaults(): { frontendUrl: string; apiUrl: string; shopUrl: string } {
  const appUrl = getEnv("APP_URL")?.trim();
  const shopUrl = getEnv("SHOP_URL")?.trim();

  if (!appUrl) {
    return {
      apiUrl: "http://localhost:3000",
      frontendUrl: "http://localhost:3111",
      shopUrl: shopUrl || "http://localhost:3444",
    };
  }

  return {
    apiUrl: appUrl,
    frontendUrl: appUrl,
    shopUrl: shopUrl || "http://localhost:3444",
  };
}

export function getCurrentContext(): { frontendUrl: string; apiUrl: string; shopUrl: string } {
  const now = Date.now();
  if (_cache && now < _cacheExpiry) return _cache;

  const ctx = getDefaults();
  _cache = ctx;
  _cacheExpiry = now + CACHE_TTL_MS;
  return ctx;
}

export function invalidateContextCache(): void {
  _cache = null;
  _cacheExpiry = 0;
}
