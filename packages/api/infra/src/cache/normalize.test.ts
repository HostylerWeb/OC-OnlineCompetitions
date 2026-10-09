import { describe, expect, test } from "vitest";
import { buildCacheKey, buildUserBatchKey } from "./normalize";

describe("buildCacheKey", () => {
  test("builds a stable key for a public singleton", () => {
    const k1 = buildCacheKey({
      route: "settings:homepage_layout_settings",
      scope: "public",
    });
    const k2 = buildCacheKey({
      route: "settings:homepage_layout_settings",
      scope: "public",
    });
    expect(k1).toBe(k2);
    expect(k1).toContain("cache:onlinecompetitions:public:pub:settings:homepage_layout_settings");
  });

  test("includes userId for user-scoped keys", () => {
    const a = buildCacheKey({
      route: "competition:availability",
      scope: "user",
      userId: "user_abc",
    });
    const b = buildCacheKey({
      route: "competition:availability",
      scope: "user",
      userId: "user_xyz",
    });
    expect(a).not.toBe(b);
    expect(a).toContain(":user:user_abc:");
    expect(b).toContain(":user:user_xyz:");
  });

  test("uses anon for missing userId on user-scoped", () => {
    const k = buildCacheKey({ route: "r", scope: "user" });
    expect(k).toContain(":user:anon:");
  });

  test("ignores null/undefined/empty params", () => {
    const a = buildCacheKey({
      route: "competitions.list",
      scope: "public",
      params: { a: "1", b: undefined, c: null, d: "", e: " " },
    });
    const b = buildCacheKey({
      route: "competitions.list",
      scope: "public",
      params: { a: "1" },
    });
    expect(a).toBe(b);
  });

  test("sorts keys for stable hashing", () => {
    const a = buildCacheKey({
      route: "competitions.list",
      scope: "public",
      params: { z: "1", a: "2", m: "3" },
    });
    const b = buildCacheKey({
      route: "competitions.list",
      scope: "public",
      params: { a: "2", m: "3", z: "1" },
    });
    expect(a).toBe(b);
  });

  test("lowercases case-insensitive params (status, category, search)", () => {
    const a = buildCacheKey({
      route: "competitions.list",
      scope: "public",
      params: { status: "ACTIVE", category: "Tech" },
    });
    const b = buildCacheKey({
      route: "competitions.list",
      scope: "public",
      params: { status: "active", category: "tech" },
    });
    expect(a).toBe(b);
  });

  test("does NOT lowercase case-sensitive params (page, limit, etc.)", () => {
    const a = buildCacheKey({
      route: "competitions.list",
      scope: "public",
      params: { page: "1", limit: "24" },
    });
    const b = buildCacheKey({
      route: "competitions.list",
      scope: "public",
      params: { page: "1", limit: "24" },
    });
    expect(a).toBe(b);
  });

  test("uses namespace from input", () => {
    const k = buildCacheKey({
      route: "r",
      scope: "public",
      namespace: "staging",
    });
    expect(k).toContain("cache:staging:");
  });

  test("trims trailing slashes from route", () => {
    const a = buildCacheKey({ route: "competitions.list/", scope: "public" });
    const b = buildCacheKey({ route: "competitions.list", scope: "public" });
    expect(a).toBe(b);
  });

  test("embeds resourceId in the key", () => {
    const a = buildCacheKey({
      route: "competition.detail",
      scope: "public",
      resourceId: "iphone-15-pro",
    });
    expect(a).toContain(":iphone-15-pro:");
  });

  test("hashes oversized query payloads", () => {
    const params: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      params[`k_${i}_${"x".repeat(20)}`] = `v_${i}_${"y".repeat(20)}`;
    }
    const k = buildCacheKey({ route: "r", scope: "public", params });
    expect(k).toMatch(/:h:[a-f0-9]{24}/);
  });

  test("caps very long keys with a hash", () => {
    const longResource = "a".repeat(200);
    const k = buildCacheKey({
      route: "competition.detail",
      scope: "public",
      resourceId: longResource,
    });
    // The resource segment itself is capped at 128 chars; if the resulting
    // key is still > MAX_KEY_LEN, the query portion gets hashed.
    expect(k.length).toBeLessThanOrEqual(1100);
  });

  test("sanitizes special chars in resourceId", () => {
    const k = buildCacheKey({
      route: "competition.detail",
      scope: "public",
      resourceId: "abc/iphone:pro 15",
    });
    expect(k).toContain(":abc_iphone_pro_15:");
  });
});

describe("buildUserBatchKey", () => {
  test("sorts and dedupes ids before hashing", () => {
    const a = buildUserBatchKey({
      route: "buying-power-batch",
      userId: "u1",
      ids: ["c", "a", "b", "a"],
    });
    const b = buildUserBatchKey({
      route: "buying-power-batch",
      userId: "u1",
      ids: ["a", "b", "c"],
    });
    expect(a).toBe(b);
  });

  test("different users get different keys", () => {
    const a = buildUserBatchKey({
      route: "buying-power-batch",
      userId: "u1",
      ids: ["a", "b"],
    });
    const b = buildUserBatchKey({
      route: "buying-power-batch",
      userId: "u2",
      ids: ["a", "b"],
    });
    expect(a).not.toBe(b);
  });

  test("uses 'all' when no ids provided", () => {
    const k = buildUserBatchKey({ route: "r", userId: "u1", ids: [] });
    expect(k).toContain(":all:");
  });
});
