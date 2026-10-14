import { getEnv } from "@oc/env/server";
import type { BetterAuthOptions } from "better-auth";
import { captcha } from "better-auth/plugins";

export function turnstileCaptchaPlugins(): NonNullable<BetterAuthOptions["plugins"]> {
  const secretKey = getEnv("TURNSTILE_SECRET_KEY");
  if (!secretKey) return [];
  return [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey,
    }),
  ];
}
