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
import { getRedis } from "@oc/api-infra/cache/redis";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { runtimeConfig } from "@oc/api-infra/runtime-config";
import { captureRouteError, flushSentry, initSentry } from "@oc/api-infra/sentry";
import { sessionMiddleware } from "@oc/api-server/middleware/auth";
import {
  emailRateLimit,
  paymentRateLimit,
  rateLimitBodyReader,
} from "@oc/api-server/middleware/rate-limit";
import { csrfProtection } from "@oc/api-server/middleware/csrf";
import authEmergency from "@oc/api-server/routes/admin/auth/emergency";
import authSetup from "@oc/api-server/routes/admin/auth/setup";
import adminBalances from "@oc/api-server/routes/admin/balances";
import { adminBonusAwards } from "@oc/api-server/routes/admin/bonus-awards";
import adminBulkActions from "@oc/api-server/routes/admin/bulk-actions";
import adminCategories from "@oc/api-server/routes/admin/categories";
import adminCompetitionInstantPrizes from "@oc/api-server/routes/admin/competition-instant-prizes";
import adminCompetitions from "@oc/api-server/routes/admin/competitions";
import adminComplianceSettings from "@oc/api-server/routes/admin/compliance-settings";
import adminConversionPostbacks from "@oc/api-server/routes/admin/conversion-postbacks";
import adminConversionSettings from "@oc/api-server/routes/admin/conversion-settings";
import adminDashboard from "@oc/api-server/routes/admin/dashboard";
import adminDashboardReferral from "@oc/api-server/routes/admin/dashboard-referral";
import adminEmailSettings from "@oc/api-server/routes/admin/email-settings";
import adminEndingSoonSettings from "@oc/api-server/routes/admin/ending-soon-settings";
import adminExport from "@oc/api-server/routes/admin/export";
import adminHomepageLayoutSettings from "@oc/api-server/routes/admin/homepage-layout-settings";
import adminInstantPrizeWins from "@oc/api-server/routes/admin/instant-prize-wins";
import adminInstantPrizes from "@oc/api-server/routes/admin/instant-prizes";
import internalJobs from "@oc/api-server/routes/admin/jobs";
import adminLivestream from "@oc/api-server/routes/admin/livestream";
import adminMedia from "@oc/api-server/routes/admin/media";
import adminMediaConverterSettings from "@oc/api-server/routes/admin/media-converter-settings";
import adminNotifications from "@oc/api-server/routes/admin/notifications";
import adminOrders from "@oc/api-server/routes/admin/orders";
import adminPaymentMethods from "@oc/api-server/routes/admin/payment-methods";
import adminPromoCodes from "@oc/api-server/routes/admin/promo-codes";
import adminReferralMindmap from "@oc/api-server/routes/admin/referral-mindmap";
import adminReferralPurchases from "@oc/api-server/routes/admin/referral-purchases";
import adminReferralSettings from "@oc/api-server/routes/admin/referral-settings";
import adminReferrals from "@oc/api-server/routes/admin/referrals";
import adminSearch from "@oc/api-server/routes/admin/search";
import adminSelfExclusionOverrides from "@oc/api-server/routes/admin/self-exclusion-overrides";
import adminSeoSettings from "@oc/api-server/routes/admin/seo-settings";
import adminShopCategories from "@oc/api-server/routes/admin/shop/categories";
import adminShopOrders from "@oc/api-server/routes/admin/shop/orders";
import adminShopProductVariants from "@oc/api-server/routes/admin/shop/product-variants";
import adminShopProducts from "@oc/api-server/routes/admin/shop/products";
import adminUserCompliance from "@oc/api-server/routes/admin/user-compliance";
import adminUserProfile from "@oc/api-server/routes/admin/user-profile";
import adminUserReferral from "@oc/api-server/routes/admin/user-referral";
import adminUsers from "@oc/api-server/routes/admin/users";
import adminWinners from "@oc/api-server/routes/admin/winners";
import meProfile from "@oc/api-server/routes/client/me/profile";
import categories from "@oc/api-server/routes/common/categories";
import competitions from "@oc/api-server/routes/common/competitions";
import competitionsInstantPrizes from "@oc/api-server/routes/common/competitions/instant-prizes";
import competitionsLandingPage from "@oc/api-server/routes/common/competitions/landing-page";
import entries from "@oc/api-server/routes/common/entries";
import landingPage from "@oc/api-server/routes/common/landing-page";
import pushSubscriptions from "@oc/api-server/routes/common/push-subscriptions";
import stats from "@oc/api-server/routes/common/stats";
import winners from "@oc/api-server/routes/common/winners";
import { getAdminAuth } from "@oc/auth-admin";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { handle } from "hono/vercel";
import mongoose from "mongoose";

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
  setTimeout(() => process.exit(1), 1000);
});

if (process.env.VERCEL !== "1") {
  process.on("SIGTERM", async () => {
    console.log("[server] SIGTERM received, shutting down...");
    await mongoose.disconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[server] SIGINT received, shutting down...");
    await mongoose.disconnect();
    process.exit(0);
  });
}

export const dynamic = "force-dynamic";

initSentry();

// Warm up the Redis client at module load. Fail-open: if Redis is unreachable,
// the cache middleware will pass through to Mongo on every request.
void getRedis().catch((err) => {
  console.warn(`[cache] warm-up failed: ${err instanceof Error ? err.message : String(err)}`);
});

const app = new Hono();

// Error handler
app.onError(async (err, c) => {
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
let authInstance: Awaited<ReturnType<typeof getAdminAuth>> | null = null;
app.use("*", async (c, next) => {
  // Skip auth init for health endpoints so they can report status independently
  if (c.req.path === "/api/health" || c.req.path === "/api/health/ready") {
    return next();
  }
  if (!authInstance) {
    await dbConnect();
    authInstance = await getAdminAuth();
  }
  c.set("authInstance", authInstance);
  return next();
});

// Request body size limit (must be >= MAX_FILE_SIZE in packages/api/server/src/routes/admin/media.ts)
const ADMIN_BODY_LIMIT_BYTES = 10 * 1024 * 1024;
app.use("*", async (c, next) => {
  const contentLength = Number.parseInt(c.req.header("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > ADMIN_BODY_LIMIT_BYTES) {
    const limitMB = ADMIN_BODY_LIMIT_BYTES / 1024 / 1024;
    return c.json(
      {
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: `Request body exceeds ${limitMB}MB`,
        },
      },
      413
    );
  }
  await next();
});

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
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

// CORS (admin origins)
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^https:\/\/.*\.onlinecompetitions\.win$/,
  /^https:\/\/onlinecompetitions\.win$/,
];

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
      "X-Setup-Secret",
      "X-Emergency-Secret",
      "Cookie",
      "baggage",
      "sentry-trace",
    ],
    exposeHeaders: ["Set-Cookie"],
  })
);

// Health endpoints
app.get("/api/version", (c) => {
  c.res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  return c.json({ sha: process.env.NEXT_PUBLIC_APP_VERSION || "dev" });
});

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

app.use("*", rateLimitBodyReader);
app.use("*", emailRateLimit());
app.use("*", csrfProtection());

// Auth routes (before session middleware — no session required for auth)
app.route("/api/auth-setup", authSetup);
app.route("/api/auth-emergency", authEmergency);

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  return await authInstance!.handler(c.req.raw);
});

// Session middleware (after auth routes)
app.use("*", sessionMiddleware);
app.use("*", paymentRateLimit());

// Me routes (admin's own profile)
app.route("/api/me/profile", meProfile);

// Common/shared routes
app.route("/api/competitions", competitions);
app.route("/api/competitions/:competitionId/instant-prizes", competitionsInstantPrizes);
app.route("/api/competitions/:slug/landing-page", competitionsLandingPage);
app.route("/api/landing-page", landingPage);
app.route("/api/categories", categories);
app.route("/api/winners", winners);
app.route("/api/stats", stats);
app.route("/api/entries", entries);
app.route("/api/push", pushSubscriptions);

// Admin-specific routes
app.route("/api/admin/compliance-settings", adminComplianceSettings);
app.route("/api/admin/self-exclusion-overrides", adminSelfExclusionOverrides);
app.route("/api/admin/dashboard", adminDashboard);
app.route("/api/admin/competitions-instant-prizes", adminCompetitionInstantPrizes);
app.route("/api/admin/bonus-awards", adminBonusAwards);
app.route("/api/admin/competitions", adminCompetitions);
app.route("/api/admin/categories", adminCategories);
app.route("/api/admin/orders", adminOrders);
app.route("/api/admin/instant-prize-wins", adminInstantPrizeWins);
app.route("/api/admin/users", adminUserCompliance);
app.route("/api/admin/users", adminUserProfile);
app.route("/api/admin/users", adminUserReferral);
app.route("/api/admin/users", adminUsers);
app.route("/api/admin/promo-codes", adminPromoCodes);
app.route("/api/admin/instant-prizes/templates", adminInstantPrizes);
app.route("/api/admin/livestream", adminLivestream);
app.route("/api/admin/referral-purchases", adminReferralPurchases);
app.route("/api/admin/referral-mindmap", adminReferralMindmap);
app.route("/api/admin/ending-soon-settings", adminEndingSoonSettings);
app.route("/api/admin/homepage-layout-settings", adminHomepageLayoutSettings);
app.route("/api/admin/referral-stats", adminDashboardReferral);
app.route("/api/admin/referral-settings", adminReferralSettings);
app.route("/api/admin/referrals", adminReferrals);
app.route("/api/admin/winners", adminWinners);
app.route("/api/admin/media", adminMedia);
app.route("/api/admin/media-converter-settings", adminMediaConverterSettings);
app.route("/api/admin/balances", adminBalances);
app.route("/api/admin/bulk", adminBulkActions);
app.route("/api/admin/email-settings", adminEmailSettings);
app.route("/api/admin/export", adminExport);
app.route("/api/admin/search", adminSearch);
app.route("/api/admin/payment-methods", adminPaymentMethods);
app.route("/api/admin/notifications", adminNotifications);
app.route("/api/admin/seo-settings", adminSeoSettings);
app.route("/api/admin/conversion-settings", adminConversionSettings);
app.route("/api/admin/conversion-postbacks", adminConversionPostbacks);
app.route("/api/admin/shop/products", adminShopProducts);
app.route("/api/admin/shop/products", adminShopProductVariants);
app.route("/api/admin/shop/categories", adminShopCategories);
app.route("/api/admin/shop/orders", adminShopOrders);
app.route("/api/internal/jobs", internalJobs);

export type AppType = typeof app;

// Export HTTP method handlers
const h = handle(app);
export const GET = h;
export const POST = h;
export const PUT = h;
export const DELETE = h;
export const PATCH = h;
export const HEAD = h;
export const OPTIONS = h;
