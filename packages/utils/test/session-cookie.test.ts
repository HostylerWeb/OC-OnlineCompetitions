import { describe, expect, it } from "vitest";
import { getCookieEnvTag, getSessionCookiePrefix } from "../src/session-cookie";

describe("getCookieEnvTag", () => {
  it("returns null for production apex hosts", () => {
    expect(getCookieEnvTag("https://onlinecompetitions.co.uk")).toBeNull();
    expect(getCookieEnvTag("https://admin.onlinecompetitions.co.uk")).toBeNull();
    expect(getCookieEnvTag("https://app.onlinecompetitions.co.uk")).toBeNull();
    expect(getCookieEnvTag("https://www.onlinecompetitions.co.uk")).toBeNull();
  });

  it("returns the tag for staging/agro subdomains", () => {
    expect(getCookieEnvTag("https://staging.onlinecompetitions.co.uk")).toBe("staging");
    expect(getCookieEnvTag("https://agro.onlinecompetitions.co.uk")).toBe("agro");
    expect(getCookieEnvTag("https://admin.staging.onlinecompetitions.co.uk")).toBe("staging");
    expect(getCookieEnvTag("https://admin.agro.onlinecompetitions.co.uk")).toBe("agro");
    expect(getCookieEnvTag("https://shop.staging.onlinecompetitions.co.uk")).toBe("staging");
  });

  it("returns null for invalid urls and localhost", () => {
    expect(getCookieEnvTag("not a url")).toBeNull();
    expect(getCookieEnvTag("")).toBeNull();
    expect(getCookieEnvTag("http://localhost:3222")).toBeNull();
  });
});

describe("getSessionCookiePrefix", () => {
  it("keeps the base prefix for production", () => {
    expect(getSessionCookiePrefix("https://onlinecompetitions.co.uk", "client")).toBe("client");
    expect(getSessionCookiePrefix("https://admin.onlinecompetitions.co.uk", "admin")).toBe("admin");
  });

  it("appends the env tag for non-production hosts", () => {
    expect(getSessionCookiePrefix("https://staging.onlinecompetitions.co.uk", "client")).toBe("client-staging");
    expect(getSessionCookiePrefix("https://agro.onlinecompetitions.co.uk", "client")).toBe("client-agro");
    expect(getSessionCookiePrefix("https://admin.staging.onlinecompetitions.co.uk", "admin")).toBe(
      "admin-staging"
    );
  });
});
