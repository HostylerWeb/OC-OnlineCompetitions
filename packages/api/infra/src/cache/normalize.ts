/**
 * Cache key normalization.
 *
 * Goal: build a stable, deterministic key from (route, scope, userId, params)
 * so that the same logical request always hits the same key, regardless of
 * how the URL or query was written.
 *
 * Rules:
 *  - Strip null / undefined / empty-string values.
 *  - Lowercase a small allowlist of case-insensitive params (status, category, search).
 *  - Sort the remaining keys lexicographically.
 *  - URL-encode each key=value (separators stay readable).
 *  - Cap key length; if exceeded, hash the query portion.
 *  - User-scoped keys always include `userId ?? "anon"` to prevent cross-user
 *    cache leaks.
 */

import { createHash } from "node:crypto";

const MAX_KEY_LEN = 1024;
const MAX_QUERY_LEN = 800;

const CASE_INSENSITIVE_PARAMS = new Set(["status", "category", "search"]);

export type CacheScope = "public" | "user" | "admin" | "settings" | "resource";

export interface NormalizeKeyInput {
  route: string;
  scope: CacheScope;
  params?: Record<string, string | number | boolean | null | undefined>;
  userId?: string | null;
  resourceId?: string | null;
  namespace?: string;
}

function sanitizeSegment(s: string): string {
  return s.replace(/[:\s/\\]/g, "_").slice(0, 128);
}

function sha256Short(s: string, n = 16): string {
  return createHash("sha256").update(s).digest("hex").slice(0, n);
}

export function buildCacheKey(input: NormalizeKeyInput): string {
  const ns = input.namespace ?? "onlinecompetitions";
  const userPart =
    input.scope === "user" || input.scope === "admin"
      ? (input.userId ?? "anon")
      : input.scope === "public"
        ? "pub"
        : "sys";
  const resourcePart = input.resourceId ? sanitizeSegment(input.resourceId) : "all";

  const params = input.params ?? {};
  const cleaned: Array<[string, string]> = [];
  for (const [rawK, rawV] of Object.entries(params)) {
    if (rawV == null) continue;
    const s = String(rawV).trim();
    if (s === "") continue;
    const k = rawK.toLowerCase();
    const v = CASE_INSENSITIVE_PARAMS.has(k) ? s.toLowerCase() : s;
    cleaned.push([k, v]);
  }
  cleaned.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  let queryPart = cleaned
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  if (queryPart.length > MAX_QUERY_LEN) {
    queryPart = `h:${sha256Short(queryPart, 24)}`;
  }

  const route = input.route.replace(/\/+$/, "");
  const key = `cache:${ns}:${input.scope}:${userPart}:${route}:${resourcePart}:${queryPart}`;

  if (key.length > MAX_KEY_LEN) {
    const h = sha256Short(queryPart, 24);
    return `cache:${ns}:${input.scope}:${userPart}:${route}:${resourcePart}:h:${h}`;
  }
  return key;
}

/**
 * Build a per-user key with an embedded list of ids (sorted, deduped).
 * Used for batch endpoints like /api/competitions/buying-power-batch.
 */
export function buildUserBatchKey(input: {
  namespace?: string;
  route: string;
  userId: string | null | undefined;
  ids: string[];
  extra?: Record<string, string | number | boolean | null | undefined>;
}): string {
  const sorted = [...new Set(input.ids)].sort();
  const idsKey = sorted.join(",").slice(0, 256);
  return buildCacheKey({
    namespace: input.namespace,
    route: input.route,
    scope: "user",
    userId: input.userId,
    resourceId: idsKey ? `ids:${sha256Short(idsKey, 12)}` : "all",
    params: input.extra,
  });
}
