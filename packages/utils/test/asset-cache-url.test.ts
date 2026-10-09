import { describe, expect, it } from "vitest";
import {
  assetCacheVersion,
  getCompetitionImageUrl,
  withAssetCacheVersion,
} from "../src/asset-cache-url";

describe("assetCacheVersion", () => {
  it("parses ISO dates", () => {
    expect(assetCacheVersion("2024-01-15T12:00:00.000Z")).toBe(String(Date.parse("2024-01-15T12:00:00.000Z")));
  });
});

describe("withAssetCacheVersion", () => {
  it("appends v from updatedAt", () => {
    const url = "http://localhost:9011/onlinecompetitions-assets/prizes/abc.webp";
    const v = Date.parse("2024-06-01T00:00:00.000Z");
    expect(withAssetCacheVersion(url, "2024-06-01T00:00:00.000Z")).toBe(`${url}?v=${v}`);
  });

  it("infers v from versioned avatar key", () => {
    const url = "http://localhost:9011/onlinecompetitions-assets/avatars/u1/1710000000000-abc123.webp";
    expect(withAssetCacheVersion(url)).toBe(`${url}?v=1710000000000`);
  });

  it("does not version Google avatar URLs", () => {
    const url = "https://lh3.googleusercontent.com/a/default-user=s96-c";
    expect(withAssetCacheVersion(url, "2024-01-01")).toBe(url);
  });

  it("replaces existing v when version changes", () => {
    const base = "http://localhost:9011/x.webp?v=1";
    expect(withAssetCacheVersion(base, 2)).toBe("http://localhost:9011/x.webp?v=2");
  });
});

describe("getCompetitionImageUrl", () => {
  it("prefers prize image and applies updatedAt", () => {
    const updatedAt = "2024-03-01T10:00:00.000Z";
    const prize = "http://localhost:9011/prize.webp";
    expect(
      getCompetitionImageUrl({
        prizeImageUrl: prize,
        imageUrl: "http://localhost:9011/other.webp",
        updatedAt,
      })
    ).toBe(`${prize}?v=${Date.parse(updatedAt)}`);
  });
});
