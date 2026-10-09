import { normalizeAuthClientError, safelyRunAuthRequest } from "@oc/auth-client";
import { describe, expect, test } from "vitest";

describe("normalizeAuthClientError", () => {
  test("maps timeout-like failures to AUTH_TIMEOUT", () => {
    const timeoutError = new Error("The operation timed out");
    timeoutError.name = "TimeoutError";

    expect(normalizeAuthClientError(timeoutError)).toEqual({
      code: "AUTH_TIMEOUT",
      message: "We could not reach the server in time. Please try again.",
    });
  });

  test("maps fetch/network failures to AUTH_NETWORK_ERROR", () => {
    expect(normalizeAuthClientError(new Error("fetch failed"))).toEqual({
      code: "AUTH_NETWORK_ERROR",
      message: "We could not reach the server. Please check your connection and try again.",
    });
  });

  test("uses fallback message for unknown failures", () => {
    expect(normalizeAuthClientError("boom")).toEqual({
      code: "AUTH_REQUEST_FAILED",
      message: "Authentication is temporarily unavailable. Please try again.",
    });
  });
});

describe("safelyRunAuthRequest", () => {
  test("returns original response when request succeeds", async () => {
    const response = await safelyRunAuthRequest(async () => ({ data: { ok: true } }));
    expect(response).toEqual({ data: { ok: true } });
  });

  test("normalizes thrown timeout errors instead of rejecting", async () => {
    const timeoutError = new Error("request timed out");
    timeoutError.name = "TimeoutError";

    const response = await safelyRunAuthRequest(async () => {
      throw timeoutError;
    });

    type Response = { error?: { code: string; message: string } };
    expect((response as Response).error).toEqual({
      code: "AUTH_TIMEOUT",
      message: "We could not reach the server in time. Please try again.",
    });
  });
});
