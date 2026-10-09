import { afterEach, describe, expect, test } from "vitest";
import { getRedisNamespace, getRedisTtlDefault, isCacheEnabled } from "./redis";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("isCacheEnabled", () => {
  test("enabled by default", () => {
    delete process.env.REDIS_ENABLED;
    delete process.env.REDIS_BYPASS;
    expect(isCacheEnabled()).toBe(true);
  });

  test("disabled when REDIS_ENABLED=false", () => {
    process.env.REDIS_ENABLED = "false";
    expect(isCacheEnabled()).toBe(false);
  });

  test("disabled when REDIS_BYPASS=true", () => {
    process.env.REDIS_BYPASS = "true";
    expect(isCacheEnabled()).toBe(false);
  });
});

describe("getRedisNamespace", () => {
  test("defaults to 'onlinecompetitions'", () => {
    delete process.env.REDIS_NAMESPACE;
    expect(getRedisNamespace()).toBe("onlinecompetitions");
  });

  test("uses env value", () => {
    process.env.REDIS_NAMESPACE = "staging";
    expect(getRedisNamespace()).toBe("staging");
  });
});

describe("getRedisTtlDefault", () => {
  test("defaults to 60s", () => {
    delete process.env.REDIS_TTL_DEFAULT;
    expect(getRedisTtlDefault()).toBe(60);
  });

  test("uses env value when valid", () => {
    process.env.REDIS_TTL_DEFAULT = "120";
    expect(getRedisTtlDefault()).toBe(120);
  });

  test("falls back to 60 for invalid env value", () => {
    process.env.REDIS_TTL_DEFAULT = "not-a-number";
    expect(getRedisTtlDefault()).toBe(60);
  });

  test("falls back to 60 for non-positive value", () => {
    process.env.REDIS_TTL_DEFAULT = "0";
    expect(getRedisTtlDefault()).toBe(60);
  });
});
