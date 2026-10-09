import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CH, invalidateByChannel, invalidateUser } from "./invalidate";
import { setRedisClient } from "./redis";

class FakeRedis {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    _modeOrTtl?: unknown,
    _ttl?: number,
    _nxFlag?: "NX"
  ): Promise<"OK" | null> {
    this.store.set(key, value);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) {
      if (this.store.delete(k)) n++;
    }
    return n;
  }

  async unlink(...keys: string[]): Promise<number> {
    return this.del(...keys);
  }

  async scan(
    _cursor: string,
    _type: "MATCH",
    pattern: string,
    _count: "COUNT",
    _n: number
  ): Promise<[string, string[]]> {
    const re = new RegExp(
      `^${pattern
        .replace(/[.+^${}()|]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".")}$`
    );
    const matched: string[] = [];
    for (const k of this.store.keys()) {
      if (re.test(k)) matched.push(k);
    }
    return ["0", matched];
  }

  _set(key: string, value: string): void {
    this.store.set(key, value);
  }

  _size(): number {
    return this.store.size;
  }

  _clear(): void {
    this.store.clear();
  }
}

const originalEnv = { ...process.env };
let fake: FakeRedis;

beforeEach(() => {
  process.env.REDIS_ENABLED = "true";
  process.env.REDIS_URL = "redis://fake:6379";
  fake = new FakeRedis();
  setRedisClient(fake as unknown as Parameters<typeof setRedisClient>[0]);
});

afterEach(() => {
  process.env = { ...originalEnv };
  setRedisClient(null);
  vi.restoreAllMocks();
});

describe("invalidateByChannel", () => {
  test("deletes all keys matching the channel pattern", async () => {
    fake._set("cache:onlinecompetitions:public:pub:settings:homepage_layout_settings", "a");
    fake._set("cache:onlinecompetitions:public:pub:settings:homepage_layout_settings:public", "b");
    fake._set("cache:onlinecompetitions:public:pub:settings:other_setting", "c");

    const n = await invalidateByChannel(CH.homepageLayoutSettings);
    expect(n).toBe(2);
    expect(fake._size()).toBe(1);
  });

  test("returns 0 when no keys match", async () => {
    fake._set("cache:onlinecompetitions:public:pub:settings:other", "x");
    const n = await invalidateByChannel(CH.homepageLayoutSettings);
    expect(n).toBe(0);
  });

  test("is a no-op when cache is disabled", async () => {
    process.env.REDIS_ENABLED = "false";
    fake._set("cache:onlinecompetitions:public:pub:settings:homepage_layout_settings", "a");
    const n = await invalidateByChannel(CH.homepageLayoutSettings);
    expect(n).toBe(0);
    expect(fake._size()).toBe(1);
  });

  test("is a no-op when client is null (Redis down)", async () => {
    setRedisClient(null);
    fake._set("cache:onlinecompetitions:public:pub:settings:homepage_layout_settings", "a");
    const n = await invalidateByChannel(CH.homepageLayoutSettings);
    expect(n).toBe(0);
  });
});

describe("invalidateUser", () => {
  test("deletes all per-user keys for the given userId", async () => {
    fake._set("cache:onlinecompetitions:user:abc:cart", "1");
    fake._set("cache:onlinecompetitions:user:abc:profile", "2");
    fake._set("cache:onlinecompetitions:user:xyz:cart", "3");

    const n = await invalidateUser("abc");
    expect(n).toBe(2);
    expect(fake._size()).toBe(1);
  });

  test("escapes special glob characters in userId", async () => {
    fake._set("cache:onlinecompetitions:user:user.test:cart", "1");
    fake._set("cache:onlinecompetitions:user:userXtest:cart", "2");
    const n = await invalidateUser("user.test");
    // Only the literal "user.test" should match.
    expect(n).toBe(1);
  });

  test("returns 0 for empty userId", async () => {
    const n = await invalidateUser("");
    expect(n).toBe(0);
  });
});
