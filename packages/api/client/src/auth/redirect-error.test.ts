import { describe, expect, test } from "vitest";
import {
  isAuthRedirectErrorKind,
  isExistingAccountRedirectError,
  isGoogleEmailMismatchError,
  resolveAuthRedirectError,
} from "./redirect-error";

describe("resolveAuthRedirectError", () => {
  test("maps Google email mismatch", () => {
    const result = resolveAuthRedirectError("email_doesn't_match");
    expect(result.title).toContain("Google");
    expect(result.message).toContain("different email");
    expect(result.errorCode).toBe("email_doesn't_match");
    expect(result.kind).toBe("google_email_mismatch");
  });

  test("maps core BASE_ERROR_CODES", () => {
    expect(resolveAuthRedirectError("EMAIL_NOT_VERIFIED").kind).toBe("email_verification");
    expect(resolveAuthRedirectError("INVALID_TOKEN").kind).toBe("password_reset");
    expect(resolveAuthRedirectError("SESSION_EXPIRED").kind).toBe("session");
  });

  test("maps lowercase OAuth redirect codes", () => {
    expect(resolveAuthRedirectError("state_mismatch").kind).toBe("oauth_retry");
    expect(resolveAuthRedirectError("unable_to_link_account").kind).toBe("account_linking");
    expect(resolveAuthRedirectError("banned").kind).toBe("banned");
  });

  test("maps signup_disabled to signup_disabled kind with account-not-found message", () => {
    const result = resolveAuthRedirectError("signup_disabled");
    expect(result.kind).toBe("signup_disabled");
    expect(result.title).toBe("Account not found");
    expect(result.message).toContain("isn't registered with Online Competitions");
  });

  test("normalizes email mismatch variants", () => {
    expect(resolveAuthRedirectError("email_doesnt_match").kind).toBe("google_email_mismatch");
  });

  test("prefers error_description when code is unknown", () => {
    const result = resolveAuthRedirectError("CUSTOM_CODE", "Provider rejected the request");
    expect(result.message).toBe("Provider rejected the request");
    expect(result.errorCode).toBe("CUSTOM_CODE");
    expect(result.title).toBe("CUSTOM CODE");
  });

  test("returns default when code is missing", () => {
    const result = resolveAuthRedirectError(null);
    expect(result.errorCode).toBeNull();
    expect(result.kind).toBe("default");
  });
});

describe("redirect error helpers", () => {
  test("detects existing account errors", () => {
    expect(isExistingAccountRedirectError("USER_ALREADY_EXISTS")).toBe(true);
    expect(isExistingAccountRedirectError("email_doesn't_match")).toBe(false);
  });

  test("detects Google email mismatch", () => {
    expect(isGoogleEmailMismatchError("email_doesn't_match")).toBe(true);
    expect(isGoogleEmailMismatchError("INVALID_EMAIL_OR_PASSWORD")).toBe(false);
  });

  test("isAuthRedirectErrorKind", () => {
    expect(isAuthRedirectErrorKind("banned", "banned")).toBe(true);
    expect(isAuthRedirectErrorKind("INVALID_TOKEN", "password_reset")).toBe(true);
  });
});
