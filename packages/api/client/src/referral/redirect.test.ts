import type { User } from "@oc/types";
import { describe, expect, test } from "vitest";
import {
  applyAuthenticatedDestination,
  buildLoginUrl,
  buildVerifyRequiredPath,
  getPostVerificationPath,
  getReferralRefGateRedirect,
  isAuthFunnelPath,
  resolveAuthenticatedDestination,
  sanitizeReturnTo,
} from "./redirect";

const unverifiedUser: User = {
  id: "user-1",
  _id: "user-1",
  email: "user@example.com",
  firstName: "Test",
  lastName: "User",
  isAdmin: false,
  isVerified: false,
  isAnonymous: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("isAuthFunnelPath", () => {
  test("matches signup, login, and verify routes", () => {
    expect(isAuthFunnelPath("/auth/sign-up")).toBe(true);
    expect(isAuthFunnelPath("/auth/login")).toBe(true);
    expect(isAuthFunnelPath("/auth/verify")).toBe(true);
    expect(isAuthFunnelPath("/auth/verify?email=a@b.com")).toBe(true);
    expect(isAuthFunnelPath("/auth/verify-required")).toBe(true);
    expect(isAuthFunnelPath("/auth/verify-email")).toBe(true);
    expect(isAuthFunnelPath("/dashboard")).toBe(false);
  });
});

describe("sanitizeReturnTo", () => {
  test("allows safe in-app paths", () => {
    expect(sanitizeReturnTo("/checkout")).toBe("/checkout");
    expect(sanitizeReturnTo("/cart?ref=CODE")).toBe("/cart?ref=CODE");
  });

  test("rejects auth funnel and external paths", () => {
    expect(sanitizeReturnTo("/auth/login")).toBeUndefined();
    expect(sanitizeReturnTo("/auth/login?returnTo=%2Fcheckout")).toBeUndefined();
    expect(sanitizeReturnTo("//evil.example")).toBeUndefined();
    expect(sanitizeReturnTo("https://evil.example")).toBeUndefined();
    expect(sanitizeReturnTo(null)).toBeUndefined();
  });
});

describe("buildLoginUrl", () => {
  test("includes encoded returnTo when safe", () => {
    expect(buildLoginUrl({ returnTo: "/checkout" })).toBe("/auth/login?returnTo=%2Fcheckout");
  });

  test("preserves existingAccount flag", () => {
    expect(buildLoginUrl({ returnTo: "/checkout", existingAccount: true })).toBe(
      "/auth/login?returnTo=%2Fcheckout&existingAccount=1"
    );
  });

  test("omits unsafe returnTo values", () => {
    expect(buildLoginUrl({ returnTo: "/auth/login" })).toBe("/auth/login");
    expect(buildLoginUrl({ returnTo: "//evil.example", existingAccount: true })).toBe(
      "/auth/login?existingAccount=1"
    );
  });
});

describe("resolveAuthenticatedDestination", () => {
  test("prefers safe returnTo over admin fallback", () => {
    expect(
      resolveAuthenticatedDestination({
        returnTo: "/checkout",
        isAdmin: true,
        adminUrl: "http://localhost:3222",
      })
    ).toEqual({ type: "internal", path: "/checkout" });
  });

  test("sends admins to admin URL when no returnTo", () => {
    expect(
      resolveAuthenticatedDestination({
        isAdmin: true,
        adminUrl: "http://localhost:3222",
      })
    ).toEqual({ type: "external", url: "http://localhost:3222" });
  });
});

describe("applyAuthenticatedDestination", () => {
  test("navigates for internal destinations", () => {
    const calls: Array<{ path: string; options?: { replace?: boolean } }> = [];
    const navigate = (path: string, options?: { replace?: boolean }) => {
      calls.push({ path, options });
    };
    applyAuthenticatedDestination({ type: "internal", path: "/checkout" }, navigate);
    expect(calls).toEqual([{ path: "/checkout", options: { replace: true } }]);
  });
});

describe("buildVerifyRequiredPath", () => {
  test("uses canonical /auth/verify route", () => {
    expect(buildVerifyRequiredPath({ email: "user@example.com" })).toBe(
      "/auth/verify?email=user%40example.com"
    );
  });
});

describe("getPostVerificationPath", () => {
  test("returns safe returnTo paths", () => {
    expect(getPostVerificationPath("/checkout")).toBe("/checkout");
    expect(getPostVerificationPath("/competitions/abc")).toBe("/competitions/abc");
  });

  test("rejects auth funnel returnTo paths", () => {
    expect(getPostVerificationPath("/auth/login")).toBe("/dashboard");
    expect(getPostVerificationPath("/auth/verify?email=a@b.com")).toBe("/dashboard");
    expect(getPostVerificationPath("/auth/verify-required?email=a@b.com")).toBe("/dashboard");
    expect(getPostVerificationPath("/auth/sign-up?ref=CODE")).toBe("/dashboard");
  });

  test("falls back to dashboard for invalid values", () => {
    expect(getPostVerificationPath(null)).toBe("/dashboard");
    expect(getPostVerificationPath(undefined)).toBe("/dashboard");
    expect(getPostVerificationPath("https://evil.test")).toBe("/dashboard");
  });
});

describe("getReferralRefGateRedirect", () => {
  test("does nothing while loading or without ref", () => {
    expect(
      getReferralRefGateRedirect({
        pathname: "/competitions",
        search: "?ref=CODE",
        ref: "CODE",
        user: null,
        isAnonymous: true,
        isLoading: true,
      })
    ).toBeNull();

    expect(
      getReferralRefGateRedirect({
        pathname: "/competitions",
        search: "",
        ref: null,
        user: null,
        isAnonymous: true,
        isLoading: false,
      })
    ).toBeNull();
  });

  test("does not interrupt auth funnel pages", () => {
    expect(
      getReferralRefGateRedirect({
        pathname: "/auth/verify",
        search: "?email=user@example.com&ref=CODE",
        ref: "CODE",
        user: unverifiedUser,
        isAnonymous: false,
        isLoading: false,
      })
    ).toBeNull();
  });

  test("sends anonymous visitors with ref to signup", () => {
    expect(
      getReferralRefGateRedirect({
        pathname: "/competitions",
        search: "?ref=CODE",
        ref: "CODE",
        user: null,
        isAnonymous: true,
        isLoading: false,
      })
    ).toBe("/auth/sign-up?ref=CODE&returnTo=%2Fcompetitions%3Fref%3DCODE");
  });

  test("sends logged-in unverified users to verify", () => {
    expect(
      getReferralRefGateRedirect({
        pathname: "/cart",
        search: "?ref=CODE",
        ref: "CODE",
        user: unverifiedUser,
        isAnonymous: false,
        isLoading: false,
      })
    ).toBe(buildVerifyRequiredPath({ email: unverifiedUser.email, returnTo: "/cart?ref=CODE" }));
  });

  test("ignores verified users", () => {
    expect(
      getReferralRefGateRedirect({
        pathname: "/cart",
        search: "?ref=CODE",
        ref: "CODE",
        user: { ...unverifiedUser, isVerified: true },
        isAnonymous: false,
        isLoading: false,
      })
    ).toBeNull();
  });
});
