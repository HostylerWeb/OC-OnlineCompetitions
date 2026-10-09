// bootstrap.ts — Hono application bootstrap.
//
// Order of operations:
//   1. Process-level error handlers
//   2. Sentry init
//   3. Redis warm-up (fail-open)
//   4. Build the Hono app + all middleware
//   5. Mount all routes
//   6. Export the configured `app`
//
// This file is environment-agnostic. It runs the same in Next.js, Vike, and a
// standalone Bun server.

import "./types";

import { ensureComplianceSettings } from "@oc/api-compliance/settings";
import { AVATAR_MAX_BYTES } from "@oc/api-server/lib/avatar/process-upload";
import { ensureMediaConverterSettings } from "@oc/api-server/lib/media-converter/settings";
import { dbConnect } from "@oc/api-db";
import { PaymentMethod } from "@oc/api-db/models";
import {
  AllocationError,
  CheckoutError,
  ComplianceError,
  EmergencyError,
  MaxTicketsPerUserExceededError,
  SetupError,
  TicketAvailabilityError,
  TicketSoldOutError,
} from "@oc/api-errors";
import { closeRedis, getRedis } from "@oc/api-infra/cache/redis";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { runtimeConfig } from "@oc/api-infra/runtime-config";
import { captureRouteError, flushSentry, initSentry } from "@oc/api-infra/sentry";
import { ensureAdsterraTracker } from "@oc/api-server/lib/affiliate/ensure-adsterra-tracker";
import { buildPublicPaymentConfig } from "@oc/api-server/lib/payment/build-payment-config";
import { ensureLocalPaymentMethod } from "@oc/api-server/lib/payment/ensure-local-payment-method";
import { ensurePaytriotPaymentMethod } from "@oc/api-server/lib/payment/ensure-paytriot-payment-method";
import { ensureStripePaymentMethod } from "@oc/api-server/lib/payment/ensure-stripe-payment-method";
import { paymentProcessors } from "@oc/api-server/lib/payment/providers";
import { registerStripeWebhooks } from "@oc/api-server/lib/payment/register-stripe-webhooks";
import { affiliateMiddleware } from "@oc/api-server/middleware/affiliate";
import { sessionMiddleware } from "@oc/api-server/middleware/auth";
import { redisCacheRoute } from "@oc/api-server/middleware/cache";
import { ALLOWED_ORIGIN_PATTERNS } from "@oc/api-server/middleware/allowed-origins";
import { csrfProtection } from "@oc/api-server/middleware/csrf";
import {
  emailRateLimit,
  paymentRateLimit,
  rateLimitBodyReader,
} from "@oc/api-server/middleware/rate-limit";
import balance from "@oc/api-server/routes/client/balance";
import cart from "@oc/api-server/routes/client/cart";
import contact from "@oc/api-server/routes/client/contact";
import discounts from "@oc/api-server/routes/client/discounts";
import meAvatar from "@oc/api-server/routes/client/me/avatar";
import meBonusAwardWins from "@oc/api-server/routes/client/me/bonus-award-wins";
import meEntries from "@oc/api-server/routes/client/me/entries";
import meInstantPrizeWins from "@oc/api-server/routes/client/me/instant-prize-wins";
import meOrders from "@oc/api-server/routes/client/me/orders";
import meProfile from "@oc/api-server/routes/client/me/profile";
import meReferral from "@oc/api-server/routes/client/me/referral";
import meReferrals from "@oc/api-server/routes/client/me/referrals";
import meSaferPlay from "@oc/api-server/routes/client/me/safer-play";
import meTickets from "@oc/api-server/routes/client/me/tickets";
import orders from "@oc/api-server/routes/client/orders";
import payments from "@oc/api-server/routes/client/payments";
import promoCodes from "@oc/api-server/routes/client/promo-codes";
import shopCategories from "@oc/api-server/routes/client/shop/categories";
import shopCheckout from "@oc/api-server/routes/client/shop/checkout";
import shopOrders from "@oc/api-server/routes/client/shop/orders";
import shopProducts from "@oc/api-server/routes/client/shop/products";
import verifyEmailLink from "@oc/api-server/routes/client/verify-email-link";
import categories from "@oc/api-server/routes/common/categories";
import competitions from "@oc/api-server/routes/common/competitions";
import competitionsInstantPrizes from "@oc/api-server/routes/common/competitions/instant-prizes";
import competitionsLandingPage from "@oc/api-server/routes/common/competitions/landing-page";
import complianceSettingsPublic from "@oc/api-server/routes/common/compliance-settings";
import endingSoonSettings from "@oc/api-server/routes/common/ending-soon-settings";
import entries from "@oc/api-server/routes/common/entries";
import homepageLayoutSettings from "@oc/api-server/routes/common/homepage-layout-settings";
import landingPage from "@oc/api-server/routes/common/landing-page";
import pushSubscriptions from "@oc/api-server/routes/common/push-subscriptions";
import referral from "@oc/api-server/routes/common/referral";
import referralCode from "@oc/api-server/routes/common/referral-code";
import referralCodes from "@oc/api-server/routes/common/referral-codes";
import referralSettingsPublic from "@oc/api-server/routes/common/referral-settings";
import seoSettingsPublic from "@oc/api-server/routes/common/seo-settings";
import stats from "@oc/api-server/routes/common/stats";
import winners from "@oc/api-server/routes/common/winners";
import { getClientAuth } from "@oc/auth-admin";
import { devAssetCspHosts, getEnv, validateEnv } from "@oc/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import mongoose from "mongoose";
import { flushPendingReferralAwards } from "./lib/bootstrap";
import { backfillTicketOrderNumbers } from "./lib/jobs/backfill-ticket-order-numbers";

// Validate critical env vars at startup
const missingVars = validateEnv();
if (missingVars.length > 0) {
  console.warn(`[env] Server starting with missing env vars: ${missingVars.join(", ")}`);
}

initSentry();

void getRedis().catch((err) => {
  console.warn(`[cache] warm-up failed: ${err instanceof Error ? err.message : String(err)}`);
});

// ---------------------------------------------------------------------------
// Process lifecycle handlers
// ---------------------------------------------------------------------------

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
  setTimeout(() => process.exit(1), 1000);
});

async function shutdownServer(signal: string): Promise<void> {
  console.log(`[server] ${signal} received, shutting down gracefully...`);
  const timeout = 10_000;
  try {
    await Promise.race([
      (async () => {
        await closeRedis();
        console.log("[server] Redis closed");
        await flushSentry(2000).catch(() => {});
        console.log("[server] Sentry flushed");
        await mongoose.disconnect();
        console.log("[server] MongoDB disconnected");
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Shutdown timed out")), timeout)
      ),
    ]);
  } catch (err) {
    console.error("[server] Shutdown error:", err);
  }
  process.exit(0);
}

if (getEnv("VERCEL") !== "1") {
  process.on("SIGTERM", () => void shutdownServer("SIGTERM"));
  process.on("SIGINT", () => void shutdownServer("SIGINT"));
}

// ---------------------------------------------------------------------------
// Build the Hono app
// ---------------------------------------------------------------------------

const app = new Hono();

// Verbose error middleware — logs full error details to console
app.onError(async (err, c) => {
  const errInfo = {
    type: err.name,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    cause: err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined,
  };
  console.error(`[API Error] ${c.req.method} ${c.req.path}:`, JSON.stringify(errInfo, null, 2));
  if (err.stack) {
    console.error(err.stack);
  }
  captureRouteError(err, { path: c.req.path });
  await flushSentry(2000).catch((err) => console.warn("[sentry] flush failed:", err));

  if (err instanceof ComplianceError) {
    return c.json(
      { error: { code: "COMPLIANCE_ERROR", message: err.message } },
      (err.status || 400) as ContentfulStatusCode
    );
  }
  if (err instanceof CheckoutError) {
    return c.json(
      { error: { code: "CHECKOUT_ERROR", message: err.message } },
      (err.status || 400) as ContentfulStatusCode
    );
  }
  if (err instanceof TicketSoldOutError) {
    return c.json(
      { error: { code: "TICKET_SOLD_OUT", message: err.message } },
      err.status as ContentfulStatusCode
    );
  }
  if (err instanceof MaxTicketsPerUserExceededError) {
    return c.json(
      { error: { code: "MAX_TICKETS_EXCEEDED", message: err.message } },
      err.status as ContentfulStatusCode
    );
  }
  if (err instanceof AllocationError) {
    return c.json(
      { error: { code: "ALLOCATION_ERROR", message: err.message } },
      err.status as ContentfulStatusCode
    );
  }
  if (err instanceof TicketAvailabilityError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status as ContentfulStatusCode
    );
  }
  if (err instanceof SetupError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status as ContentfulStatusCode
    );
  }
  if (err instanceof EmergencyError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status as ContentfulStatusCode
    );
  }

  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
});

// Auth instance (lazy — initialize on first request to survive build)
async function ensureBonusAwardFireIndexes(): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const indexes = await db.collection("bonusawardfires").indexes();
    if (indexes.some((i) => i.name === "bonusAwardId_1" && i.unique)) {
      console.warn("[API Init] Dropping stale unique index bonusAwardId_1 on bonusawardfires");
      await db.collection("bonusawardfires").dropIndex("bonusAwardId_1");
    }
    if (!indexes.some((i) => i.name === "assignmentId_1" && i.unique)) {
      await db.collection("bonusawardfires").createIndex({ assignmentId: 1 }, { unique: true });
    }
  } catch (err) {
    console.warn("[API Init] Failed to ensure bonus award fire indexes (non-fatal):", err);
  }
}

let authInstance: Awaited<ReturnType<typeof getClientAuth>> | null = null;
let complianceSettingsSeeded = false;
let adsterraSeeded = false;
app.use("*", async (c, next) => {
  if (c.req.path === "/api/health" || c.req.path === "/api/health/ready") {
    return next();
  }
  if (!authInstance) {
    console.log("[API Init] First request — initializing MongoDB and Auth...");
    console.log("[API Init] ENV check:", {
      NODE_ENV: getEnv("NODE_ENV"),
      DATABASE_URL: getEnv("DATABASE_URL")
        ? `${getEnv("DATABASE_URL").split("@").pop()}`
        : "MISSING",
      APP_URL: getEnv("APP_URL") ?? "MISSING",
      BETTER_AUTH_SECRET: getEnv("BETTER_AUTH_SECRET") ? "***set***" : "MISSING",
    });
    try {
      await dbConnect();
      console.log("[API Init] MongoDB connected");
      const { ensureMongoDatabaseOptimizations } = await import(
        "@oc/api-server/lib/mongo-index-maintenance"
      );
      await ensureMongoDatabaseOptimizations();
      await ensureBonusAwardFireIndexes();
      void flushPendingReferralAwards().catch(() => {});
      void backfillTicketOrderNumbers().catch((err) => {
        console.warn("[startup] Ticket orderNumber backfill failed (non-blocking):", err);
      });
      authInstance = await getClientAuth();
      console.log("[API Init] Auth instance created");
      if (!complianceSettingsSeeded) {
        try {
          await ensureComplianceSettings();
          complianceSettingsSeeded = true;
        } catch (seedErr) {
          console.warn(
            "[API Init] Compliance auto-seed failed (will retry on next read):",
            seedErr instanceof Error ? seedErr.message : String(seedErr)
          );
        }
      }
      try {
        await ensureMediaConverterSettings();
      } catch (seedErr) {
        console.warn(
          "[API Init] Media converter auto-seed failed (will retry on next read):",
          seedErr instanceof Error ? seedErr.message : String(seedErr)
        );
      }
      if (!adsterraSeeded) {
        try {
          await ensureAdsterraTracker();
          adsterraSeeded = true;
        } catch (seedErr) {
          console.warn(
            "[API Init] Adsterra auto-seed failed (will retry on next read):",
            seedErr instanceof Error ? seedErr.message : String(seedErr)
          );
        }
      }
    } catch (initErr) {
      console.error("[API Init] Failed to initialize MongoDB or Auth:", initErr);
      throw initErr;
    }
  }
  c.set("authInstance", authInstance);
  return next();
});

// Debug endpoint — exposes env state for development debugging
if (getEnv("NODE_ENV") !== "production") {
  app.get("/api/_debug/env", (c) => {
    return c.json({
      NODE_ENV: getEnv("NODE_ENV"),
      DATABASE_URL: getEnv("DATABASE_URL") ? getEnv("DATABASE_URL").split("@").pop() : "MISSING",
      APP_URL: getEnv("APP_URL") ?? "MISSING",
      BETTER_AUTH_SECRET: getEnv("BETTER_AUTH_SECRET") ? "***set***" : "MISSING",
      S3_ENDPOINT: getEnv("S3_ENDPOINT") ?? "MISSING",
      MONGODB_READY_STATE: (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mongoose = require("mongoose");
          return mongoose.connection?.readyState;
        } catch {
          return "unknown";
        }
      })(),
    });
  });
}

// Request body size limit
app.use("*", async (c, next) => {
  const contentLength = Number.parseInt(c.req.header("content-length") ?? "", 10);
  if (!Number.isFinite(contentLength)) return next();

  const isAuthPath = c.req.path.startsWith("/api/auth/");
  const isAvatarUpload =
    c.req.method === "POST" && c.req.path === "/api/me/profile/avatar";
  const avatarMaxBytes = AVATAR_MAX_BYTES + 256 * 1024;
  const maxBytes = isAuthPath
    ? 5 * 1024 * 1024
    : isAvatarUpload
      ? avatarMaxBytes
      : 100 * 1024;
  if (contentLength > maxBytes) {
    const message = isAuthPath
      ? "Request body exceeds 5MB limit for auth endpoints"
      : isAvatarUpload
        ? `Profile photo must be ${AVATAR_MAX_BYTES / 1024 / 1024}MB or smaller`
        : "Request body exceeds 100KB limit";
    return c.json(
      {
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message,
        },
      },
      413
    );
  }
  await next();
});

// Security headers + CSP
app.use("*", async (c, next) => {
  const nonce = crypto.randomUUID();
  c.set("nonce", nonce);

  await next();

  const isDev = getEnv("NODE_ENV") === "development" || getEnv("NODE_ENV") === "test";
  const allowDev =
    isDev || (await (runtimeConfig as Record<string, unknown>).allowDevScripts) === true;

  const scriptSrc = allowDev
    ? `'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://umami.onlinecompetitions.co.uk https://js.stripe.com`
    : `'self' 'nonce-${nonce}' https://challenges.cloudflare.com https://umami.onlinecompetitions.co.uk https://js.stripe.com`;

  const styleSrc = allowDev
    ? `'self' 'unsafe-inline' https://fonts.googleapis.com`
    : `'self' 'unsafe-inline' https://fonts.googleapis.com`;

  const devAssetHosts = devAssetCspHosts(isDev);

  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  c.res.headers.set(
    "Content-Security-Policy",
    `base-uri 'self'; form-action 'self' https://gateway.paytriot.co.uk; object-src 'none'; default-src 'self'; script-src ${scriptSrc}; frame-src https://challenges.cloudflare.com https://gateway.paytriot.co.uk https://js.stripe.com https://hooks.stripe.com; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' https://onlinecompetitions.co.uk https://staging.onlinecompetitions.co.uk https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk https://umami.onlinecompetitions.co.uk https://challenges.cloudflare.com https://*.facebook.net https://tiny-glitter-95dd.cdn.onlinecompetitions.co.uk https://api.stripe.com https://www.google.com https://pay.google.com https://payments.google.com https://m.stripe.com https://q.stripe.com${devAssetHosts}; img-src 'self' data: https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk https://lh3.googleusercontent.com${devAssetHosts}; media-src 'self' https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk${devAssetHosts}; style-src ${styleSrc}; font-src 'self' https://fonts.gstatic.com https://js.stripe.com`
  );
  if (runtimeConfig.enableHsts) {
    c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

// Request ID + logging
app.use("*", async (c, next) => {
  const requestId = c.req.header("X-Request-ID") || crypto.randomUUID();
  c.set("requestId", requestId);
  c.res.headers.set("X-Request-ID", requestId);
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  if (!["/api/health", "/api/health/ready"].some((p) => c.req.path === p)) {
    console.log(
      JSON.stringify({
        requestId,
        timestamp: new Date().toISOString(),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration: ms,
      })
    );
  }
});

// CORS
app.use(
  "*",
  cors({
    origin: (origin) =>
      !origin || ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)) ? origin : null,
    credentials: true,
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-OnlineCompetitions-Client",
      "X-Affiliate-Clickid",
      "X-Affiliate-Source",
      "Cookie",
      "baggage",
      "sentry-trace",
    ],
    exposeHeaders: ["Set-Cookie"],
  })
);

app.use("*", csrfProtection());

// Version endpoint — returns the build timestamp injected at Docker build
app.get("/api/version", (c) => {
  c.res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  return c.json({ sha: import.meta.env?.VITE_APP_VERSION || "dev" });
});

// Health endpoints
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/api/health/ready", async (c) => {
  const dbState = mongoose.connection.readyState;
  const checks: Record<string, string> = {};

  if (dbState !== 1) {
    checks.database =
      dbState === 0 ? "disconnected" : dbState === 2 ? "connecting" : "disconnecting";
  } else {
    checks.database = "connected";
  }

  try {
    const redis = await getRedis();
    if (redis) {
      await redis.ping();
      checks.redis = "connected";
    } else {
      checks.redis = "not_configured";
    }
  } catch {
    checks.redis = "unreachable";
  }

  const isHealthy = checks.database === "connected";
  if (!isHealthy) {
    return c.json({ status: "unhealthy", checks }, 503);
  }

  return c.json({ status: "healthy", checks });
});

// Rate limiting for email-sending auth endpoints
app.use("*", rateLimitBodyReader);
app.use("*", emailRateLimit());

// Affiliate click ID + source — makes the tracking cookies/headers available
// via AsyncLocalStorage. Registered before the Better Auth handler so signups
// carry attribution (the auth client does not send custom headers).
app.use("*", affiliateMiddleware);

// Catch POST to magic-link/verify before the wildcard handler so the
// frontend verify-magic-link page can auto-submit a form (email clients
// don't execute JS, so they never reach this POST handler).
app.post("/api/auth/magic-link/verify", async (c) => {
  const body = await c.req.parseBody();
  const url = new URL(c.req.url);
  if (typeof body.token === "string") url.searchParams.set("token", body.token);
  if (typeof body.callbackURL === "string") url.searchParams.set("callbackURL", body.callbackURL);
  if (typeof body.errorCallbackURL === "string")
    url.searchParams.set("errorCallbackURL", body.errorCallbackURL);
  const newReq = new Request(url.toString(), {
    method: "GET",
    headers: c.req.raw.headers,
  });
  return await authInstance!.handler(newReq);
});

function redactAuthLogBody(body: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!body) return null;
  const redacted = { ...body };
  for (const key of ["password", "token", "otp", "code", "newPassword", "currentPassword"]) {
    if (key in redacted) redacted[key] = "[REDACTED]";
  }
  return redacted;
}

// Better Auth handler
app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const path = c.req.path;
  const shouldLog =
    path.includes("/sign-in/social") ||
    path.includes("/callback/") ||
    path.includes("/sign-in/email") ||
    path.includes("/sign-up/email") ||
    path.includes("/sign-out");

  let loggedBody: Record<string, unknown> | null = null;
  if (shouldLog && c.req.method === "POST") {
    try {
      const text = await c.req.raw.clone().text();
      try {
        loggedBody = JSON.parse(text) as Record<string, unknown>;
      } catch {
        loggedBody = Object.fromEntries(new URLSearchParams(text).entries()) as Record<
          string,
          unknown
        >;
      }
    } catch {
      loggedBody = null;
    }
  }

  console.log("[BetterAuth] request", {
    method: c.req.method,
    path,
    query: Object.fromEntries(Object.entries(c.req.query() as Record<string, string>)),
    body: redactAuthLogBody(loggedBody),
    cookie: shouldLog ? "[REDACTED]" : undefined,
  });

  const response = await authInstance!.handler(c.req.raw.clone());

  if (shouldLog) {
    console.log("[BetterAuth] response", {
      method: c.req.method,
      path,
      status: response.status,
      location: response.headers.get("location"),
      setCookie: response.headers.get("set-cookie")?.substring(0, 400),
    });
  }

  return response;
});

// Session middleware
app.use("*", sessionMiddleware);

// Rate limiting for payment endpoints (after session so userId is available)
app.use("*", paymentRateLimit());

// Public/config routes
app.route("/r", referral);
app.route("/api/competitions", competitions);
app.route("/api/competitions/:competitionId/instant-prizes", competitionsInstantPrizes);
app.route("/api/competitions/:slug/landing-page", competitionsLandingPage);
app.route("/api/landing-page", landingPage);
app.route("/api/ending-soon-settings", endingSoonSettings);
app.route("/api/homepage-layout-settings", homepageLayoutSettings);
app.route("/api/categories", categories);
app.route("/api/winners", winners);
app.route("/api/stats", stats);
app.route("/api/entries", entries);
app.route("/api/referral-settings", referralSettingsPublic);
app.route("/api/compliance-settings", complianceSettingsPublic);
app.route("/api/seo-settings", seoSettingsPublic);
app.route("/api/promo-codes", promoCodes);
app.route("/api/push", pushSubscriptions);

// Public payment config
app.get(
  "/api/public/payment-config",
  redisCacheRoute({
    route: "payment:config",
    scope: "public",
    ttlSeconds: 600,
  }),
  async (c) => {
    await dbConnect();
    await ensureLocalPaymentMethod();
    await ensurePaytriotPaymentMethod();
    await ensureStripePaymentMethod();
    const { ensureSiteCreditPaymentMethod } = await import(
      "@oc/api-server/lib/payment/ensure-site-credit-payment-method"
    );
    await ensureSiteCreditPaymentMethod();
    void registerStripeWebhooks().catch((err) => {
      console.error("Stripe webhook registration failed:", err);
    });
    const methods = (await PaymentMethod.find().lean()) as unknown as Parameters<
      typeof buildPublicPaymentConfig
    >[0]["methods"];
    const paytriotProcessor = paymentProcessors.find((p) => p.id === "paytriot");
    const stripeProcessor = paymentProcessors.find((p) => p.id === "stripe");
    const config = buildPublicPaymentConfig({
      methods,
      paytriotProcessor,
      stripeProcessor,
      stripePublishableKeyEnv: getEnv("STRIPE_PUBLISHABLE_KEY"),
      stripeEnvironmentEnv: getEnv("STRIPE_ENVIRONMENT") as "test" | "live" | undefined,
    });
    return c.json({ data: { config } });
  }
);

// Checkout/cart/payment routes
app.route("/api/cart", cart);
app.route("/api/orders", orders);
app.route("/api/payments", payments);
app.route("/api/balance", balance);
app.route("/api/contact", contact);
app.route("/api/discounts", discounts);
app.route("/api/referral-codes", referralCodes);
app.route("/api/referral-code", referralCode);

// Me routes
app.route("/api/me/orders", meOrders);
app.route("/api/me/entries", meEntries);
app.route("/api/me/profile", meProfile);
app.route("/api/me/profile/avatar", meAvatar);
app.route("/api/me/safer-play", meSaferPlay);
app.route("/api/me/referral", meReferral);
app.route("/api/me/referrals", meReferrals);
app.route("/api/me/tickets", meTickets);
app.route("/api/me/instant-prize-wins", meInstantPrizeWins);
app.route("/api/me/bonus-award-wins", meBonusAwardWins);

// Shop routes
app.route("/api/shop/products", shopProducts);
app.route("/api/shop/categories", shopCategories);
app.route("/api/shop/orders", shopOrders);
app.route("/api/shop/checkout", shopCheckout);

app.route("/api/verify-email-link", verifyEmailLink);

export { app };
