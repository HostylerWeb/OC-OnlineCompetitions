/**
 * Lazy singleton ioredis client.
 *
 * - Reads REDIS_URL from env (default `redis://localhost:6379`).
 * - Connects on first use; never throws at import time.
 * - Fail-open: every public method catches and logs, returning a no-op result.
 * - For tests: `setRedisClient(ioredisMock)` injects a mock before any call.
 */

import { getBool, getEnv, getNum } from "@oc/env/server";
import { Redis, type RedisOptions } from "ioredis";

let _client: Redis | null = null;
let _initializing: Promise<Redis> | null = null;

function parseRedisUrl(): string {
  const url = getEnv("REDIS_URL")?.trim();
  return url || "redis://localhost:6379";
}

function buildOptions(): RedisOptions {
  return {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
    reconnectOnError(err) {
      return err.message.includes("READONLY") ? 1 : false;
    },
  };
}

export async function getRedis(): Promise<Redis | null> {
  if (getBool("REDIS_ENABLED", true) === false) return null;
  if (getBool("REDIS_BYPASS", false)) return null;

  if (_client) return _client;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    try {
      const client = new Redis(parseRedisUrl(), buildOptions());
      client.on("error", (err) => {
        if (process.env.NODE_ENV !== "test") {
          console.warn(`[cache] redis error: ${err.message}`);
        }
      });
      await client.connect();
      _client = client;
      return client;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cache] failed to connect to redis: ${msg}`);
      _initializing = null;
      return null as unknown as Redis;
    } finally {
      _initializing = null;
    }
  })();
  return _initializing;
}

/**
 * Synchronous access for hot paths where awaiting is acceptable; for first
 * use it triggers the lazy connect in the background and returns the existing
 * client. Prefer `getRedis()` for code that can await.
 */
export function tryGetRedis(): Redis | null {
  return _client;
}

export function setRedisClient(client: Redis | null): void {
  _client = client;
}

export async function closeRedis(): Promise<void> {
  if (_client) {
    try {
      await _client.quit();
    } catch {
      _client.disconnect();
    }
    _client = null;
  }
}

export function getRedisNamespace(): string {
  return getEnv("REDIS_NAMESPACE")?.trim() || "onlinecompetitions";
}

export function getRedisTtlDefault(): number {
  const val = getNum("REDIS_TTL_DEFAULT", 60);
  return val > 0 ? val : 60;
}

export function isCacheEnabled(): boolean {
  if (getBool("REDIS_ENABLED", true) === false) return false;
  if (getBool("REDIS_BYPASS", false)) return false;
  if (process.env.NODE_ENV === "development" && getBool("REDIS_ENABLED", true) === false) {
    return false;
  }
  return true;
}
