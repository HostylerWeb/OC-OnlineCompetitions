import "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import {
  orderCompletedTtlSeconds,
  orderFailedTtlSeconds,
  orderPendingTtlSeconds,
  shouldSyncIndexesOnStartup,
} from "@oc/api-infra/mongo-retention";
import mongoose from "mongoose";

const log = createLogger("mongo-index-maintenance");

let maintenanceDone = false;

async function ensureBetterAuthIndexes(db: mongoose.mongo.Db): Promise<void> {
  const user = db.collection("user");
  await user.createIndex({ email: 1 }, { unique: true, sparse: true, name: "email_1_unique_sparse" });
  await user.createIndex({ role: 1 }, { name: "role_1" });

  const session = db.collection("session");
  await session.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_1_ttl" });
  await session.createIndex({ userId: 1 }, { name: "userId_1" });
  await session.createIndex({ userId: 1, expiresAt: 1 }, { name: "userId_1_expiresAt_1" });
}

function partialStatusFilter(statuses: string[]): Record<string, unknown> {
  return {
    status: { $in: statuses },
    deletedAt: null,
  };
}

async function upsertTtlIndex(
  collection: mongoose.mongo.Collection,
  key: Record<string, 1 | -1>,
  name: string,
  expireAfterSeconds: number,
  partialFilterExpression: Record<string, unknown>
): Promise<void> {
  if (expireAfterSeconds <= 0) {
    try {
      await collection.dropIndex(name);
      log.info(`Dropped TTL index ${name} (TTL disabled via env)`);
    } catch {
      // index may not exist
    }
    return;
  }

  const indexes = await collection.indexes();
  const existing = indexes.find((i) => i.name === name);
  if (
    existing &&
    existing.expireAfterSeconds === expireAfterSeconds &&
    JSON.stringify(existing.partialFilterExpression) === JSON.stringify(partialFilterExpression)
  ) {
    return;
  }

  if (existing) {
    try {
      await collection.dropIndex(name);
    } catch (err) {
      log.warn(`Could not drop index ${name} before recreate`, {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await collection.createIndex(key, {
    name,
    expireAfterSeconds,
    partialFilterExpression,
  });
  log.info(`Ensured TTL index ${name} expireAfterSeconds=${expireAfterSeconds}`);
}

async function ensureOrderRetentionIndexes(db: mongoose.mongo.Db): Promise<void> {
  const orders = db.collection("orders");

  await upsertTtlIndex(
    orders,
    { createdAt: 1 },
    "orders_pending_createdAt_ttl",
    orderPendingTtlSeconds(),
    partialStatusFilter(["pending", "processing"])
  );

  await upsertTtlIndex(
    orders,
    { updatedAt: 1 },
    "orders_completed_updatedAt_ttl",
    orderCompletedTtlSeconds(),
    partialStatusFilter(["completed", "refunded"])
  );

  await upsertTtlIndex(
    orders,
    { updatedAt: 1 },
    "orders_failed_updatedAt_ttl",
    orderFailedTtlSeconds(),
    partialStatusFilter(["failed"])
  );
}

async function syncRegisteredModelIndexes(): Promise<void> {
  const names = mongoose.modelNames();
  for (const name of names) {
    const model = mongoose.model(name);
    await model.syncIndexes();
  }
  log.info(`syncIndexes completed for ${names.length} models`);
}

export async function ensureMongoDatabaseOptimizations(): Promise<void> {
  if (maintenanceDone) return;
  if (mongoose.connection.readyState !== 1) return;

  const db = mongoose.connection.db;
  if (!db) return;

  try {
    await ensureBetterAuthIndexes(db);
    await ensureOrderRetentionIndexes(db);

    if (shouldSyncIndexesOnStartup()) {
      await syncRegisteredModelIndexes();
    } else {
      log.info("MONGODB_SYNC_INDEXES_ON_STARTUP=false — skipping model syncIndexes");
    }
  } catch (err) {
    log.warn("Mongo index maintenance failed (non-fatal)", {
      err: err instanceof Error ? err.message : String(err),
    });
  } finally {
    maintenanceDone = true;
  }
}
