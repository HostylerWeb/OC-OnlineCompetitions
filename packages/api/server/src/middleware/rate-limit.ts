import { createHash } from "node:crypto";
import { getRedis } from "@oc/api-infra/cache/redis";
import { getEnv } from "@oc/env/server";
import type { Context, MiddlewareHandler, Next } from "hono";

interface RateLimitRule {
  windowSeconds: number;
  maxPerEmail: number;
  maxPerIp: number;
}

const EMAIL_ENDPOINTS: Record<string, RateLimitRule> = {
  "sign-in/magic-link": { windowSeconds: 60, maxPerEmail: 3, maxPerIp: 5 },
  "sign-in/email-otp": { windowSeconds: 60, maxPerEmail: 5, maxPerIp: 10 },
  "email-otp/send-verification": { windowSeconds: 60, maxPerEmail: 5, maxPerIp: 10 },
  "email-otp/verify": { windowSeconds: 60, maxPerEmail: 5, maxPerIp: 10 },
  "sign-up/email-otp": { windowSeconds: 60, maxPerEmail: 5, maxPerIp: 10 },
  "forget-password": { windowSeconds: 60, maxPerEmail: 3, maxPerIp: 5 },
  "forget-password/reset": { windowSeconds: 60, maxPerEmail: 5, maxPerIp: 10 },
};

const DEV_MULTIPLIER = 10;

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 16);
}

function extractEmail(c: Context): string | null {
  try {
    const body = c.get("rateLimitBody") as Record<string, unknown> | undefined;
    if (body?.email && typeof body.email === "string") return body.email;
    const raw = c.get("rateLimitRaw") as string | undefined;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.email && typeof parsed.email === "string") return parsed.email;
    }
  } catch {
    return null;
  }
  return null;
}

function extractIp(c: Context): string {
  const fromProxy =
    c.req.header("cf-connecting-ip")?.trim() || c.req.header("x-real-ip")?.trim();
  if (fromProxy) return fromProxy;
  return "unknown";
}

function isDevEnv(): boolean {
  return getEnv("NODE_ENV") === "development" || getEnv("NODE_ENV") === "test";
}

function redisUnavailableResponse(c: Context) {
  return c.json(
    {
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Rate limiting is temporarily unavailable. Please try again shortly.",
      },
    },
    503
  );
}

export function emailRateLimit(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const url = new URL(c.req.url);
    const path = url.pathname.replace(/^\/api\/auth\//, "");
    const rule = EMAIL_ENDPOINTS[path];
    if (!rule) return next();

    const redis = await getRedis();
    if (!redis) {
      if (!isDevEnv()) return redisUnavailableResponse(c);
      return next();
    }

    const multiplier = isDevEnv() ? DEV_MULTIPLIER : 1;
    const maxEmail = rule.maxPerEmail * multiplier;
    const maxIp = rule.maxPerIp * multiplier;
    const windowMs = rule.windowSeconds * 1000;

    const ip = extractIp(c);
    const email = extractEmail(c);

    const keysToCheck: { key: string; max: number; label: string }[] = [];
    if (email) {
      const emailHash = hashEmail(email);
      keysToCheck.push({
        key: `ratelimit:email:${emailHash}:${path}`,
        max: maxEmail,
        label: "email",
      });
    }
    if (ip !== "unknown") {
      keysToCheck.push({
        key: `ratelimit:ip:${ip}:${path}`,
        max: maxIp,
        label: "ip",
      });
    }

    for (const { key, max } of keysToCheck) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }
      if (count > max) {
        return c.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests. Please wait before trying again.",
            },
          },
          429
        );
      }
    }

    return next();
  };
}

export function paymentRateLimit(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const url = new URL(c.req.url);
    const path = url.pathname.replace(/^\/api\//, "");

    const isPaymentSession = path.startsWith("payments/session") && c.req.method === "POST";
    const isCartDiscount = path === "cart/discount" && c.req.method === "POST";
    const isReferralClaim = path === "referral-code/claim" && c.req.method === "POST";
    const isDiscountValidate =
      (path === "discounts/validate" || path === "promo-codes/validate") &&
      c.req.method === "POST";

    if (!isPaymentSession && !isCartDiscount && !isReferralClaim && !isDiscountValidate) {
      return next();
    }

    const redis = await getRedis();
    if (!redis) {
      if (!isDevEnv()) return redisUnavailableResponse(c);
      return next();
    }

    const userId = c.get("userId") as string | undefined;
    const ip = extractIp(c);

    const maxPerUser = 10;
    const maxPerIp = 20;
    const windowMs = 60 * 1000;

    const keysToCheck: { key: string; max: number }[] = [];
    if (userId) {
      keysToCheck.push({ key: `ratelimit:user:${userId}:${path}`, max: maxPerUser });
    }
    if (ip !== "unknown") {
      keysToCheck.push({ key: `ratelimit:ip:${ip}:${path}`, max: maxPerIp });
    }

    for (const { key, max } of keysToCheck) {
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      if (count > max) {
        return c.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests. Please wait before trying again.",
            },
          },
          429
        );
      }
    }

    return next();
  };
}

export function pushSubscribeRateLimit(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (c.req.method !== "POST") return next();

    const redis = await getRedis();
    if (!redis) {
      if (!isDevEnv()) return redisUnavailableResponse(c);
      return next();
    }

    const ip = extractIp(c);
    const userId = c.get("userId") as string | undefined;
    const windowMs = 60 * 1000;
    const maxPerIp = isDevEnv() ? 60 : 15;
    const maxPerUser = isDevEnv() ? 30 : 10;

    const keys: { key: string; max: number }[] = [
      { key: `ratelimit:push:ip:${ip}`, max: maxPerIp },
    ];
    if (userId) keys.push({ key: `ratelimit:push:user:${userId}`, max: maxPerUser });

    for (const { key, max } of keys) {
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      if (count > max) {
        return c.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "Too many push subscription attempts. Please wait.",
            },
          },
          429
        );
      }
    }

    return next();
  };
}

export function contactRateLimit(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (c.req.method !== "POST") return next();

    const redis = await getRedis();
    if (!redis) {
      if (!isDevEnv()) return redisUnavailableResponse(c);
      return next();
    }

    const ip = extractIp(c);
    const windowMs = 15 * 60 * 1000;
    const max = isDevEnv() ? 30 : 5;
    const key = `ratelimit:contact:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, windowMs);
    if (count > max) {
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many contact requests. Please try again later.",
          },
        },
        429
      );
    }

    return next();
  };
}

/** Rate-limit public entries/winners scraping by IP (client H7). */
export function publicFeedRateLimit(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (c.req.method !== "GET") return next();

    const redis = await getRedis();
    if (!redis) {
      if (!isDevEnv()) return redisUnavailableResponse(c);
      return next();
    }

    const ip = extractIp(c);
    const path = new URL(c.req.url).pathname.replace(/^\/api\//, "");
    const windowMs = 60 * 1000;
    const max = isDevEnv() ? 300 : 120;
    const key = `ratelimit:public:${ip}:${path}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, windowMs);
    if (count > max) {
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please slow down.",
          },
        },
        429
      );
    }

    return next();
  };
}

export async function rateLimitBodyReader(c: Context, next: Next) {
  if (c.req.method !== "POST") return next();
  const url = c.req.url;
  const isAuthEndpoint = [
    "/api/auth/sign-in/magic-link",
    "/api/auth/sign-in/email-otp",
    "/api/auth/email-otp/send-verification",
    "/api/auth/email-otp/verify",
    "/api/auth/sign-up/email-otp",
    "/api/auth/forget-password",
    "/api/auth/forget-password/reset",
  ].some((p) => url.includes(p));

  if (!isAuthEndpoint) return next();

  try {
    const clone = c.req.raw.clone();
    const raw = await clone.text();
    c.set("rateLimitRaw", raw);
    if (raw) {
      c.set("rateLimitBody", JSON.parse(raw));
    }
  } catch {
    // body not parseable — proceed without rate limiting
  }

  return next();
}
