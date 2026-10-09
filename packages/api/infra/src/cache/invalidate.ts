/**
 * Cache invalidation.
 *
 * Two flavors:
 *  - `invalidateByChannel(channel)` — deletes all keys matching the channel's
 *    pattern (e.g. all competitions variants, all winners, all per-user keys).
 *  - `invalidateUser(userId)` — deletes all `cache:*:user:{userId}:*` keys.
 *
 * Implementation: SCAN + UNLINK in batches of 500.
 * SCAN is O(N) in the worst case but is the only safe way to delete a
 * pattern without blocking the server. For Online Competitions's expected scale
 * (< 100k keys) this is well within the budget.
 *
 * All operations fail open. If Redis is down, the call is a no-op.
 */

import type { Redis } from "ioredis";
import { CH, CHANNEL_PATTERNS, type ChannelName } from "./keys";
import { getRedis, isCacheEnabled } from "./redis";

const SCAN_BATCH = 500;

async function deleteByGlob(redis: Redis, pattern: string): Promise<number> {
  let cursor = "0";
  let total = 0;
  do {
    let batch: string[] = [];
    try {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", SCAN_BATCH);
      cursor = next;
      batch = keys;
    } catch {
      return total;
    }
    if (batch.length > 0) {
      try {
        await redis.unlink(...batch);
        total += batch.length;
      } catch {
        try {
          await redis.del(...batch);
          total += batch.length;
        } catch {
          // best-effort
        }
      }
    }
  } while (cursor !== "0");
  return total;
}

export async function invalidateByChannel(channel: ChannelName): Promise<number> {
  if (!isCacheEnabled()) return 0;
  const redis = await getRedis();
  if (!redis) return 0;
  const pattern = CHANNEL_PATTERNS[channel];
  if (!pattern) {
    console.warn(`[cache] no pattern registered for channel ${channel}`);
    return 0;
  }
  return deleteByGlob(redis, pattern);
}

/**
 * Invalidate all per-user keys for a specific userId.
 * Use after any mutation that affects user-specific data.
 */
export async function invalidateUser(userId: string): Promise<number> {
  if (!isCacheEnabled() || !userId) return 0;
  const redis = await getRedis();
  if (!redis) return 0;
  // Glob `*` in SCAN MATCH matches any chars including `:`; we need the
  // userId to be a single segment. Escape glob special chars except `*`.
  // (Redis glob special chars: * ? [ ] \)
  const escaped = userId.replace(/[\\*?[\]]/g, "\\$&");
  const pattern = `cache:*:user:${escaped}:*`;
  return deleteByGlob(redis, pattern);
}

export async function invalidateByKey(key: string): Promise<void> {
  if (!isCacheEnabled()) return;
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.unlink(key);
  } catch {
    try {
      await redis.del(key);
    } catch {
      // best-effort
    }
  }
}

export async function invalidateByKeys(keys: string[]): Promise<void> {
  if (!isCacheEnabled() || keys.length === 0) return;
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.unlink(...keys);
  } catch {
    try {
      await redis.del(...keys);
    } catch {
      // best-effort
    }
  }
}

export type { ChannelName };
export { CH };

/**
 * Invalidate one or more channels, swallowing any errors with a warning log.
 * Use this in admin mutations where the cache invalidation is best-effort
 * and we don't want a Redis hiccup to fail the whole write.
 */
export async function invalidateByChannelSafe(...channels: ChannelName[]): Promise<void> {
  await Promise.all(
    channels.map((channel) =>
      invalidateByChannel(channel).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[cache] failed to invalidate channel ${channel}: ${msg}`);
      })
    )
  );
}
