import { beforeEach, describe, expect, test } from "vitest";
import {
  decideEnsureFreshVerificationOtp,
  getVerifyOtpEnsuredStorageKey,
  hasVerifyOtpEnsuredFlag,
  setVerifyOtpEnsuredFlag,
} from "./ensureFreshVerificationOtp";

const sessionStore = new Map<string, string>();

beforeEach(() => {
  sessionStore.clear();
  globalThis.sessionStorage = {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sessionStore.set(key, value);
    },
    removeItem: (key: string) => {
      sessionStore.delete(key);
    },
    clear: () => sessionStore.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe("decideEnsureFreshVerificationOtp", () => {
  test("skips without page email", () => {
    expect(
      decideEnsureFreshVerificationOtp({
        pageEmail: "",
        sessionEmail: "user@example.com",
        isAnonymous: false,
        hasEnsuredFlag: false,
      })
    ).toEqual({ action: "skip", reason: "no-email" });
  });

  test("skips when code is in URL (lazy mount)", () => {
    expect(
      decideEnsureFreshVerificationOtp({
        pageEmail: "user@example.com",
        sessionEmail: "user@example.com",
        isAnonymous: false,
        hasEnsuredFlag: false,
        skipBecauseCodeInUrl: true,
      })
    ).toEqual({ action: "skip", reason: "code-in-url" });
  });

  test("skips without session or for anonymous users", () => {
    expect(
      decideEnsureFreshVerificationOtp({
        pageEmail: "user@example.com",
        sessionEmail: null,
        isAnonymous: false,
        hasEnsuredFlag: false,
      })
    ).toEqual({ action: "skip", reason: "no-session" });

    expect(
      decideEnsureFreshVerificationOtp({
        pageEmail: "user@example.com",
        sessionEmail: "user@example.com",
        isAnonymous: true,
        hasEnsuredFlag: false,
      })
    ).toEqual({ action: "skip", reason: "anonymous" });
  });

  test("skips when session email does not match page email", () => {
    expect(
      decideEnsureFreshVerificationOtp({
        pageEmail: "user@example.com",
        sessionEmail: "other@example.com",
        isAnonymous: false,
        hasEnsuredFlag: false,
      })
    ).toEqual({ action: "skip", reason: "email-mismatch" });
  });

  test("skips when already ensured this session", () => {
    expect(
      decideEnsureFreshVerificationOtp({
        pageEmail: "user@example.com",
        sessionEmail: "user@example.com",
        isAnonymous: false,
        hasEnsuredFlag: true,
      })
    ).toEqual({ action: "skip", reason: "already-ensured" });
  });

  test("sends when session matches and flag unset", () => {
    expect(
      decideEnsureFreshVerificationOtp({
        pageEmail: "User@Example.com",
        sessionEmail: "user@example.com",
        isAnonymous: false,
        hasEnsuredFlag: false,
      })
    ).toEqual({ action: "send" });
  });
});

describe("verify OTP ensured sessionStorage flag", () => {
  test("uses normalized email in storage key", () => {
    expect(getVerifyOtpEnsuredStorageKey("  User@Example.COM ")).toBe(
      "onlinecompetitions_verify_otp_ensured_user@example.com"
    );
  });

  test("tracks ensured state per email", () => {
    setVerifyOtpEnsuredFlag("user@example.com");
    expect(hasVerifyOtpEnsuredFlag("user@example.com")).toBe(true);
    expect(hasVerifyOtpEnsuredFlag("other@example.com")).toBe(false);
  });
});
