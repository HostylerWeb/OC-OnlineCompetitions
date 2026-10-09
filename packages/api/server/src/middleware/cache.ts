/**
 * Hono middleware: cache GET responses in Redis.
 *
 * - Only GET requests are cached.
 * - On HIT, the cached body is re-emitted as a fresh Response, and the
 *   handler chain is short-circuited (next() not called).
 * - On MISS, next() runs the handler; the response body is captured from
 *   c.res and stored in Redis. The response itself is left untouched so
 *   Hono renders it normally.
 * - On Redis error (or when disabled), the middleware is a no-op — the
 *   handler runs and `X-Cache: BYPASS` is set.
 *
 * Observability:
 *   - `X-Cache: HIT | MISS | BYPASS` is always set.
 *   - `X-Cache-Key: <hash>` is set in dev only (non-prod runtime).
 *   - A `[cache]` log line is emitted per request (info on HIT/MISS, warn
 *     on Redis errors).
 *
 * Per-route config lives in `cache-config.ts`.
 */

import {
  buildCacheKey,
  cacheGetRaw,
  cacheSetRaw,
  getRedis,
  getRedisNamespace,
  isCacheEnabled,
  tryGetRedis,
} from "@oc/api-infra/cache";
import { isLocalDevRuntime } from "@oc/api-infra/runtime-config";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { getBool } from "@oc/env/server";
import type { Context, MiddlewareHandler, Next } from "hono";

const log = createLogger("cache");
const X_CACHE_HEADER = "X-Cache";
const X_CACHE_KEY_HEADER = "X-Cache-Key";

export type CacheScope = "public" | "user";

export interface CacheRouteConfig {
  /** Stable route identifier used in the cache key (e.g. "competitions.list") */
  route: string;
  /** Cache scope. Determines whether userId is included in the key. */
  scope: CacheScope;
  /** TTL in seconds */
  ttlSeconds: number;
  /** Optional: an extra resource id embedded into the key (e.g. competition slug) */
  resourceIdResolver?: (c: Context) => string | null | undefined;
  /** Optional: an allowlist gate. Return true to cache, false to pass through. */
  shouldCache?: (c: Context) => boolean;
}

interface CapturedResponse {
  status: number;
  body: string;
  contentType: string;
}

async function readJsonBody(res: Response): Promise<CapturedResponse | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    const text = await res.clone().text();
    return { status: res.status, body: text, contentType };
  } catch {
    return null;
  }
}

function buildResponse(env: CapturedResponse): Response {
  return new Response(env.body, {
    status: env.status,
    headers: { "content-type": env.contentType },
  });
}

/**
 * Build the cache key for a request. Pure function for testability.
 */
export function buildKeyForRequest(c: Context, config: CacheRouteConfig): string {
  const userId = c.get("userId") ?? null;
  const url = new URL(c.req.url);
  const params: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    params[k] = v;
  }
  const resourceId = config.resourceIdResolver
    ? (config.resourceIdResolver(c) ?? undefined)
    : undefined;
  return buildCacheKey({
    route: config.route,
    scope: config.scope,
    userId,
    resourceId,
    params,
    namespace: getRedisNamespace(),
  });
}

export function redisCacheRoute(config: CacheRouteConfig): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (c.req.method !== "GET") return next();
    if (!isCacheEnabled() || !tryGetRedis()) {
      c.set("cacheStatus", "BYPASS");
      c.header(X_CACHE_HEADER, "BYPASS");
      return next();
    }
    if (config.shouldCache && !config.shouldCache(c)) {
      c.set("cacheStatus", "BYPASS");
      c.header(X_CACHE_HEADER, "BYPASS");
      return next();
    }

    const key = buildKeyForRequest(c, config);
    if (isLocalDevRuntime()) c.header(X_CACHE_KEY_HEADER, key);

    // 1. Try cache
    let cached: CapturedResponse | null = null;
    try {
      cached = await cacheGetRaw<CapturedResponse>(key);
    } catch (err) {
      cacheMiddlewareWarn(c, "get", err);
      cached = null;
    }
    if (cached?.body) {
      logCacheHit(c, key);
      c.header(X_CACHE_HEADER, "HIT");
      c.set("cacheStatus", "HIT");
      return buildResponse(cached);
    }

    // 2. Cache miss — stampede protection
    // Acquire a lock so only one worker recomputes; others poll briefly.
    const LOCK_TTL_MS = 5000;
    const lockKey = `${key}:lock`;
    let lockAcquired = false;
    try {
      const redis = await getRedis();
      if (redis) {
        const result = await redis.set(lockKey, "1", "PX", LOCK_TTL_MS, "NX");
        lockAcquired = result === "OK";
      }
    } catch {
      lockAcquired = false;
    }

    if (!lockAcquired) {
      // Poll for up to LOCK_TTL_MS for the other worker's result
      const deadline = Date.now() + LOCK_TTL_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
        let polled: CapturedResponse | null = null;
        try {
          polled = await cacheGetRaw<CapturedResponse>(key);
        } catch {
          // keep polling
        }
        if (polled?.body) {
          c.header(X_CACHE_HEADER, "HIT");
          c.set("cacheStatus", "HIT");
          return buildResponse(polled);
        }
      }
    }

    // 3. Run the handler (either lock holder, or lock expired)
    await next();

    // 4. Release lock (best-effort)
    if (lockAcquired) {
      try {
        const redis = await getRedis();
        if (redis) await redis.del(lockKey);
      } catch {
        // best-effort
      }
    }

    // 5. Capture and store (best-effort)
    if (c.res) {
      let captured: CapturedResponse | null = null;
      try {
        captured = await readJsonBody(c.res);
      } catch (err) {
        cacheMiddlewareWarn(c, "read", err);
        captured = null;
      }
      if (captured && captured.status >= 200 && captured.status < 300) {
        try {
          await cacheSetRaw(key, captured, config.ttlSeconds);
        } catch (err) {
          cacheMiddlewareWarn(c, "set", err);
        }
        logCacheMiss(c, key, captured.status, config.ttlSeconds);
        c.header(X_CACHE_HEADER, "MISS");
        c.set("cacheStatus", "MISS");
      } else {
        c.header(X_CACHE_HEADER, "BYPASS");
        c.set("cacheStatus", "BYPASS");
      }
    } else {
      c.header(X_CACHE_HEADER, "BYPASS");
      c.set("cacheStatus", "BYPASS");
    }
  };
}

declare module "hono" {
  interface ContextVariableMap {
    cacheStatus?: "HIT" | "MISS" | "BYPASS";
  }
}

/**
 * Single place to warn + Sentry-capture a cache-middleware error. Pulled out
 * to keep the read/write paths readable and to make the Sentry tags
 * consistent.
 */
function cacheMiddlewareWarn(c: Context, op: "get" | "set" | "read", err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  log.warn(`[${op}] failed for ${c.req.path}: ${msg}`);
  captureRouteError(err, {
    requestId: c.get("requestId"),
    path: c.req.path,
    operation: `cache.${op}`,
  });
}

function logCacheHit(c: Context, key: string): void {
  if (!shouldLogCacheEvents()) return;
  log.info(`HIT  ${key} (${c.req.method} ${c.req.path})`);
}

function logCacheMiss(c: Context, key: string, status: number, ttlSeconds: number): void {
  if (!shouldLogCacheEvents()) return;
  log.info(`MISS ${key} (${c.req.method} ${c.req.path}) → ${status} ttl=${ttlSeconds}s`);
}

/**
 * Per-request cache event logging is gated on `LOG_CACHE_HITS=true` to
 * avoid spamming the logs in dev. The X-Cache header on every response
 * remains the primary debugging signal.
 */
function shouldLogCacheEvents(): boolean {
  if (getBool("LOG_CACHE_HITS", false)) return true;
  if (!isLocalDevRuntime()) return false;
  return true;
}
