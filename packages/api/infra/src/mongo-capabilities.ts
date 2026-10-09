import { getBool, getEnv } from "@oc/env/server";
import mongoose, { type ClientSession } from "mongoose";

export type MongoTopology = "standalone" | "replicaSet" | "sharded" | "unknown";

export interface MongoCapabilities {
  retryWritesSupported: boolean;
  transactionsSupported: boolean;
  topology: MongoTopology;
}

export interface MongoConnectOptions {
  retryWrites: boolean;
}

let cachedCapabilities: MongoCapabilities | null = null;

export function resolveMongoConnectOptions(databaseUrl: string): MongoConnectOptions {
  const envRetryWrites = getEnv("MONGODB_RETRY_WRITES");
  if (envRetryWrites === "true" || envRetryWrites === "false") {
    return { retryWrites: envRetryWrites === "true" };
  }

  try {
    const url = new URL(databaseUrl);
    const param = url.searchParams.get("retryWrites");
    if (param === "true" || param === "false") {
      return { retryWrites: param === "true" };
    }
  } catch {
    // Non-URL connection strings fall through to scheme defaults
  }

  const isSrv = databaseUrl.startsWith("mongodb+srv://");
  return { retryWrites: isSrv };
}

export function parseHelloResponse(
  hello: Record<string, unknown>,
  databaseUrl: string
): MongoCapabilities {
  const isMongos = hello.msg === "isdbgrid";
  const setName = typeof hello.setName === "string" ? hello.setName : undefined;
  const isReplicaSet = Boolean(setName);

  let topology: MongoTopology = "unknown";
  if (isMongos) {
    topology = "sharded";
  } else if (isReplicaSet) {
    topology = "replicaSet";
  } else {
    topology = "standalone";
  }

  const transactionsSupported = isReplicaSet || isMongos;
  const { retryWrites } = resolveMongoConnectOptions(databaseUrl);

  return {
    retryWritesSupported: retryWrites,
    transactionsSupported,
    topology,
  };
}

export async function probeMongoCapabilities(force = false): Promise<MongoCapabilities> {
  if (cachedCapabilities && !force) {
    return cachedCapabilities;
  }

  const conn = mongoose.connection;
  if (conn.readyState !== 1) {
    return {
      retryWritesSupported: resolveMongoConnectOptions(getEnv("DATABASE_URL")).retryWrites,
      transactionsSupported: false,
      topology: "unknown",
    };
  }

  try {
    const hello = (await conn.db!.admin().command({ hello: 1 })) as Record<string, unknown>;
    cachedCapabilities = parseHelloResponse(hello, getEnv("DATABASE_URL"));
  } catch (err: unknown) {
    console.warn(
      "[MongoDB] Capability probe failed:",
      err instanceof Error ? err.message : String(err)
    );
    cachedCapabilities = {
      retryWritesSupported: resolveMongoConnectOptions(getEnv("DATABASE_URL")).retryWrites,
      transactionsSupported: false,
      topology: "unknown",
    };
  }

  return cachedCapabilities;
}

export async function getMongoCapabilities(): Promise<MongoCapabilities> {
  return probeMongoCapabilities();
}

export function clearMongoCapabilitiesCache(): void {
  cachedCapabilities = null;
}

export function logMongoCapabilities(caps: MongoCapabilities): void {
  console.log(
    `[MongoDB] topology=${caps.topology} transactions=${caps.transactionsSupported} retryWrites=${caps.retryWritesSupported}`
  );
}

export async function logMongoCapabilitiesAfterConnect(): Promise<void> {
  const caps = await probeMongoCapabilities(true);
  logMongoCapabilities(caps);
}

export async function logMongoCapabilitiesAtStartup(): Promise<void> {
  return logMongoCapabilitiesAfterConnect();
}

mongoose.connection.on("reconnected", () => {
  clearMongoCapabilitiesCache();
});

export async function withMongoTransactionOptional<T>(
  fn: (session: ClientSession | null) => Promise<T>,
  options: { logPrefix?: string; strictOnTxFailure?: boolean } = {}
): Promise<T> {
  const prefix = options.logPrefix ?? "MongoDB";
  const forceNonTx = getBool("ALLOW_NON_TX_CIP", false);
  const forceTx = getBool("MONGODB_FORCE_TRANSACTIONS", false);
  const strictOnTxFailure = options.strictOnTxFailure ?? false;

  const caps = await getMongoCapabilities();

  if (forceNonTx || !caps.transactionsSupported) {
    if (!caps.transactionsSupported) {
      console.warn(
        `[${prefix}] MongoDB transactions unavailable (${caps.topology}) — using non-transactional path`
      );
    }
    return fn(null);
  }

  const conn = mongoose.connection;
  if (conn.readyState !== 1) {
    if (forceTx || strictOnTxFailure) {
      throw new Error("INTERNAL:Database not connected — transactions unavailable");
    }
    console.warn(`[${prefix}] Database not connected — using non-transactional path`);
    return fn(null);
  }

  const session = await conn.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } catch (txErr) {
    const message = txErr instanceof Error ? txErr.message : String(txErr);
    if (forceNonTx) {
      console.warn(`[${prefix}] Transaction failed, falling back to non-transactional:`, message);
      return fn(null);
    }
    if (strictOnTxFailure || forceTx) {
      if (forceTx) {
        throw new Error(`INTERNAL:Database transactions unavailable: ${message}`);
      }
      throw txErr;
    }
    console.warn(`[${prefix}] Transaction failed, falling back to non-transactional:`, message);
    return fn(null);
  } finally {
    await session.endSession();
  }
}
