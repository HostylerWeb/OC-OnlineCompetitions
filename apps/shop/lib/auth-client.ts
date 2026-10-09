import { getSessionCookiePrefix } from "@oc/utils";
import { anonymousClient, emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const AUTH_FETCH_TIMEOUT_MS = 10_000;

const shopUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SHOP_URL ?? "http://localhost:3444");

export const authClient = createAuthClient({
  baseURL: shopUrl,
  fetchOptions: {
    credentials: "include",
    onRequest: (context) => ({
      ...context,
      signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    }),
  },
  advanced: {
    cookiePrefix: getSessionCookiePrefix(shopUrl, "client"),
  },
  plugins: [anonymousClient(), emailOTPClient()],
});

export type AuthClientSession = typeof authClient.$Infer.Session;
