import { describe, expect, test } from "vitest";
import { CH, CHANNEL_PATTERNS } from "./keys";

/** Match a key against a glob pattern (Redis SCAN MATCH syntax). */
function globMatch(pattern: string, key: string): boolean {
  // Escape regex special chars except `*` and `?` and `[`.
  const re = new RegExp(
    `^${pattern
      .replace(/[.+^${}()|]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".")}$`
  );
  return re.test(key);
}

describe("CH constants", () => {
  test("all channels have a registered pattern", () => {
    for (const name of Object.values(CH)) {
      expect(typeof CHANNEL_PATTERNS[name]).toBe("string");
      expect(CHANNEL_PATTERNS[name].length).toBeGreaterThan(0);
    }
  });

  test("competitions pattern matches all variants", () => {
    const p = CHANNEL_PATTERNS[CH.competitions];
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:competitions:list:q=active")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:competitions:featured")).toBe(true);
    // Note: per-competition detail uses the singular `competition:` key
    // prefix; it's invalidated via CH.competitionDetail, not CH.competitions.
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:competition:abc:detail")).toBe(false);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:competition-categories:list")).toBe(false);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:winners:list")).toBe(false);
  });

  test("competitionDetail pattern matches per-competition keys", () => {
    const p = CHANNEL_PATTERNS[CH.competitionDetail];
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:competition:detail:abc-iphone")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:competition:xyz:landing-page")).toBe(false);
  });

  test("winners pattern matches list and stats but not other prefixes", () => {
    const p = CHANNEL_PATTERNS[CH.winners];
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:winners:list")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:winners:stats")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:winners:competition:abc")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:winners-other")).toBe(false);
  });

  test("user pattern matches per-user keys but not public keys", () => {
    const p = CHANNEL_PATTERNS[CH.user];
    expect(globMatch(p, "cache:onlinecompetitions:user:abc123:cart")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:user:abc123:profile")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:profile:abc")).toBe(false);
  });

  test("homepageLayoutSettings pattern matches only the singleton key", () => {
    const p = CHANNEL_PATTERNS[CH.homepageLayoutSettings];
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:settings:homepage_layout_settings")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:settings:homepage_layout_settings:public")).toBe(
      true
    );
  });

  test("complianceSettings pattern matches both public and private forms", () => {
    const p = CHANNEL_PATTERNS[CH.complianceSettings];
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:settings:compliance_settings")).toBe(true);
    expect(globMatch(p, "cache:onlinecompetitions:public:pub:settings:compliance_settings:public")).toBe(true);
  });

  test("namespace-agnostic (works for any namespace)", () => {
    const p = CHANNEL_PATTERNS[CH.competitions];
    expect(globMatch(p, "cache:dev:public:pub:competitions:list")).toBe(true);
    expect(globMatch(p, "cache:prod:public:pub:competitions:list")).toBe(true);
  });
});
