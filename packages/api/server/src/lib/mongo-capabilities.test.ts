import {
  clearMongoCapabilitiesCache,
  probeMongoCapabilities,
  resolveMongoConnectOptions,
  withMongoTransactionOptional,
} from "@oc/api-infra/mongo-capabilities";
import mongoose from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const originalEnv = { ...process.env };
const originalConnection = mongoose.connection;

function mockConnection(overrides: Record<string, unknown>) {
  Object.defineProperty(mongoose, "connection", {
    configurable: true,
    value: {
      readyState: 1,
      ...overrides,
    },
  });
}

afterEach(() => {
  process.env = { ...originalEnv };
  clearMongoCapabilitiesCache();
  Object.defineProperty(mongoose, "connection", {
    configurable: true,
    value: originalConnection,
  });
});

describe("resolveMongoConnectOptions", () => {
  test("MONGODB_RETRY_WRITES env overrides URL and scheme defaults", () => {
    process.env.MONGODB_RETRY_WRITES = "false";
    expect(resolveMongoConnectOptions("mongodb+srv://cluster.example.net/onlinecompetitions")).toEqual({
      retryWrites: false,
    });

    process.env.MONGODB_RETRY_WRITES = "true";
    expect(
      resolveMongoConnectOptions("mongodb://localhost:27017/onlinecompetitions?retryWrites=false")
    ).toEqual({
      retryWrites: true,
    });
  });
});

describe("withMongoTransactionOptional", () => {
  beforeEach(() => {
    clearMongoCapabilitiesCache();
    delete process.env.ALLOW_NON_TX_CIP;
    process.env.DATABASE_URL = "mongodb://localhost:27017/onlinecompetitions?retryWrites=false";
  });

  test("calls fn(null) when transactions are unsupported", async () => {
    mockConnection({
      db: {
        admin: () => ({
          command: vi.fn(async () => ({ isWritablePrimary: true })),
        }),
      },
      startSession: vi.fn(async () => {
        throw new Error("startSession should not be called on standalone");
      }),
    });

    await probeMongoCapabilities();

    let sessionArg: mongoose.ClientSession | null | undefined;
    const result = await withMongoTransactionOptional(async (session) => {
      sessionArg = session;
      return "ok";
    });

    expect(result).toBe("ok");
    expect(sessionArg).toBeNull();
  });

  test("uses session when transactions are supported", async () => {
    process.env.DATABASE_URL = "mongodb+srv://cluster.example.net/onlinecompetitions";

    const endSession = vi.fn(async () => {});
    const withTransaction = vi.fn(async (fn: () => Promise<unknown>) => fn());
    const fakeSession = {
      withTransaction,
      endSession,
    };

    mockConnection({
      db: {
        admin: () => ({
          command: vi.fn(async () => ({ setName: "rs0" })),
        }),
      },
      startSession: vi.fn(async () => fakeSession),
    });

    await probeMongoCapabilities();

    let sessionArg: mongoose.ClientSession | null | undefined;
    const result = await withMongoTransactionOptional(async (session) => {
      sessionArg = session;
      return 42;
    });

    expect(result).toBe(42);
    expect(sessionArg).toBe(fakeSession);
    expect(withTransaction).toHaveBeenCalled();
    expect(endSession).toHaveBeenCalled();
  });
});
