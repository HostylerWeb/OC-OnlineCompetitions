import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { runtimeConfig } from "@oc/api-infra/runtime-config";
import { captureRouteError, flushSentry, initSentry } from "@oc/api-infra/sentry";
import { sessionMiddleware } from "@oc/api-server/middleware/auth";
import { csrfProtection } from "@oc/api-server/middleware/csrf";
import {
  emailRateLimit,
  paymentRateLimit,
  rateLimitBodyReader,
} from "@oc/api-server/middleware/rate-limit";
import shopPayments from "@oc/api-server/routes/client/payments";
import shopCart from "@oc/api-server/routes/client/shop/cart";
import shopCategories from "@oc/api-server/routes/client/shop/categories";
import shopCheckout from "@oc/api-server/routes/client/shop/checkout";
import shopOrders from "@oc/api-server/routes/client/shop/orders";
import shopProducts from "@oc/api-server/routes/client/shop/products";
import { getClientAuth } from "@oc/auth-admin";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { handle } from "hono/vercel";
import mongoose from "mongoose";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  flushSentry(2_000).finally(() => process.exit(1));
});

initSentry();

const app = new Hono({ strict: false });

// Global error handler
app.onError(async (err, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  const statusCode =
    "status" in err && typeof err.status === "number"
      ? err.status
      : "statusCode" in err && typeof err.statusCode === "number"
        ? err.statusCode
        : 500;

  console.error(`[api] Error ${statusCode} on ${c.req.method} ${c.req.path}:`, err);

  captureRouteError(err, {
    requestId,
    path: c.req.path,
    userId: c.get("userId") ?? null,
    operation: "shop.api.error",
  });

  if (statusCode >= 500 && statusCode < 600) {
    return c.json(
      { error: { code: ErrorCodes.INTERNAL_ERROR, message: "Internal server error" } },
      statusCode as ContentfulStatusCode
    );
  }

  if (typeof err === "object" && err !== null && "message" in err) {
    return c.json(
      { error: { code: ErrorCodes.VALIDATION_ERROR, message: (err as Error).message } },
      statusCode as ContentfulStatusCode
    );
  }

  return c.json(
    { error: { code: ErrorCodes.INTERNAL_ERROR, message: "Internal server error" } },
    500
  );
});

// Auth instance (lazy  -  initialize on first request to survive build)
let authInstance: Awaited<ReturnType<typeof getClientAuth>> | null = null;
app.use("*", async (c, next) => {
  if (c.req.path === "/api/health" || c.req.path === "/api/health/ready") {
    return next();
  }
  if (!authInstance) {
    await dbConnect();
    authInstance = await getClientAuth();
  }
  c.set("authInstance", authInstance);
  return next();
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

// CORS
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
      "Cookie",
      "baggage",
      "sentry-trace",
    ],
    exposeHeaders: ["Set-Cookie"],
  })
);

app.use("*", rateLimitBodyReader);
app.use("*", emailRateLimit());
app.use("*", csrfProtection());

// Version endpoint  -  returns the build timestamp injected at Docker build
app.get("/api/version", (c) => {
  c.res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  return c.json({ sha: process.env.NEXT_PUBLIC_APP_VERSION || "dev" });
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

  const isHealthy = checks.database === "connected";
  if (!isHealthy) {
    return c.json({ status: "unhealthy", checks }, 503);
  }

  return c.json({ status: "healthy", checks });
});

// Auth routes (before session middleware  -  no session required for auth)
app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  return await authInstance!.handler(c.req.raw);
});

// Session middleware (after auth routes)
app.use("*", sessionMiddleware);
app.use("*", paymentRateLimit());

// Shop routes
app.route("/api/shop/products", shopProducts);
app.route("/api/shop/categories", shopCategories);
app.route("/api/shop/cart", shopCart);
app.route("/api/shop/orders", shopOrders);
app.route("/api/shop/checkout", shopCheckout);

// Payment routes
app.route("/api/payments", shopPayments);

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
