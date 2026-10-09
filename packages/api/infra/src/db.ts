import { createLogger } from "@oc/api-logger";
import { getBool, getEnv } from "@oc/env/server";
import mongoose from "mongoose";
import { resolveMongoConnectOptions } from "./mongo-capabilities";
import { DEFAULT_AGGREGATE_MAX_TIME_MS } from "./mongo-query-options";

const logger = createLogger("api-infra:db");

// Eager check omitted — DATABASE_URL is validated lazily in dbConnect()
// so this module can be imported during next build without a DB connection.

// Connection pool + timeout configuration. Tuned for a long-running
// Node/Bun Hono server with bursty traffic:
//   - maxPoolSize 50: covers a burst of ~40 concurrent DB ops with headroom
//   - minPoolSize 5: pre-warmed connections ready for traffic spikes
//   - serverSelectionTimeoutMS 5s: fail fast on topology issues
//   - socketTimeoutMS 30s: prevents hanging queries on short OLTP paths
//   - maxIdleTimeMS 60s: releases idle connections to avoid server-side pressure
// Per-instance pool: 50 + 2 (monitoring) per replica member. With 1 app
// instance + 3-member replica set, max ~156 server-side connections.
//
// NOTE: `readPreference` is kept at the driver default ("primary") because
// the app performs write operations (orders, cart mutations) that must be
// immediately readable afterwards (read-your-writes consistency). Using
// "secondaryPreferred" would improve read-scaling but risks serving stale
// data after writes. If read-scaling becomes a bottleneck, consider
// routing only idempotent / read-only queries to secondaries at the query
// level rather than changing the connection default.
const globalForMongo = globalThis as typeof globalThis & {
  __mongoClient?: typeof mongoose;
  __mongoPromise?: Promise<typeof mongoose>;
};

mongoose.set("strictQuery", true);

let sessionIndexesEnsured = false;
let aggregateGuardInstalled = false;

function installDefaultAggregateMaxTime(): void {
  if (aggregateGuardInstalled) return;
  if (!getBool("MONGODB_ENFORCE_AGGREGATE_MAX_TIME_MS", true)) return;

  const origExec = mongoose.Aggregate.prototype.exec;
  mongoose.Aggregate.prototype.exec = function execWithMaxTime(
    this: mongoose.Aggregate<unknown>,
    ...args: Parameters<typeof origExec>
  ) {
    const internal = this as mongoose.Aggregate<unknown> & { options?: { maxTimeMS?: number } };
    if (internal.options?.maxTimeMS == null) {
      this.option({ maxTimeMS: DEFAULT_AGGREGATE_MAX_TIME_MS });
    }
    return origExec.apply(this, args);
  };
  aggregateGuardInstalled = true;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (!getEnv("DATABASE_URL")) {
    throw new Error("DATABASE_URL is required");
  }

  if (globalForMongo.__mongoClient?.connection?.readyState === 1) return mongoose;

  if (!globalForMongo.__mongoPromise) {
    const mongoOptions = resolveMongoConnectOptions(getEnv("DATABASE_URL"));
    globalForMongo.__mongoPromise = mongoose
      .connect(getEnv("DATABASE_URL"), {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5_000,
        socketTimeoutMS: 30_000,
        maxIdleTimeMS: 60_000,
        ...mongoOptions,
      })
      .then((conn) => {
        globalForMongo.__mongoClient = conn;
        installDefaultAggregateMaxTime();
        ensureSessionTTLIndexes();
        setupDbShutdownHandlers();
        return conn;
      });
  }

  return globalForMongo.__mongoPromise;
}

mongoose.connection.on("connected", () => {
  console.log("[mongo] connected");
});

mongoose.connection.on("error", (err) => {
  console.error("[mongo] connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[mongo] disconnected");
});

async function ensureSessionTTLIndexes(): Promise<void> {
  if (sessionIndexesEnsured) return;
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    await db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  } catch (err) {
    if (err instanceof Error) {
      console.warn("[mongo] session TTL index creation failed:", err.message);
    }
  } finally {
    sessionIndexesEnsured = true;
  }
}

function setupDbShutdownHandlers() {
  const handleShutdown = async (signal: string) => {
    logger.info("Shutdown signal received, closing MongoDB connection", { signal });
    try {
      await mongoose.disconnect();
      logger.info("MongoDB connection closed gracefully");
    } catch (err) {
      logger.error("Error closing MongoDB connection", { err, signal });
    }
    process.exit(0);
  };

  if (process.env.VERCEL !== "1") {
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
  }
}

export default dbConnect;
