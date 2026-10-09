import { randomUUID } from "node:crypto";
import dbConnect from "@oc/api-infra/db";
import { captureRouteError } from "@oc/api-infra/sentry";
import { getNum } from "@oc/env/server";
import mongoose from "mongoose";

const DEFAULT_JOB_LOCK_TTL_MS = 15 * 60 * 1000;
const JOB_LOCKS_COLLECTION = "internal_job_locks";

type JobOutcome = "success" | "failure";

type JobLockDocument<TPayload> = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  lockOwner?: string | null;
  lockExpiresAt?: Date | null;
  lastRunId?: string | null;
  lastRunStartedAt?: Date | null;
  lastRunCompletedAt?: Date | null;
  lastRunDurationMs?: number | null;
  lastRunOutcome?: JobOutcome | null;
  lastSuccessIdempotencyKey?: string | null;
  lastSuccessPayload?: TPayload;
};

export type InternalJobExecutionResult<TPayload> =
  | {
      status: "completed";
      runId: string;
      durationMs: number;
      payload: TPayload;
    }
  | {
      status: "replayed";
      runId: string | null;
      completedAt: string | null;
      payload: TPayload;
    }
  | {
      status: "locked";
    };

function sanitizeJobPayload(payload: unknown): unknown {
  if (payload == null) return payload;
  if (typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return { type: "array", length: payload.length };
  return payload;
}

function logInternalJobEvent(
  event: string,
  input: {
    jobName: string;
    runId?: string | null;
    idempotencyKey?: string;
    lockStatus?: "acquired" | "locked" | "released" | "replayed";
    durationMs?: number;
    outcome?: JobOutcome;
    payload?: unknown;
    completedAt?: string | null;
  }
): void {
  const mem = process.memoryUsage();
  console.log(
    JSON.stringify({
      event,
      domain: "internal_jobs",
      timestamp: new Date().toISOString(),
      jobName: input.jobName,
      runId: input.runId ?? null,
      idempotencyKeyPresent: Boolean(input.idempotencyKey),
      lockStatus: input.lockStatus ?? null,
      outcome: input.outcome ?? null,
      durationMs: input.durationMs ?? null,
      completedAt: input.completedAt ?? null,
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        externalBytes: mem.external,
      },
      summary: sanitizeJobPayload(input.payload),
    })
  );
}

function getInternalJobLocksCollection<TPayload>() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not ready");
  }
  return db.collection<JobLockDocument<TPayload>>(JOB_LOCKS_COLLECTION);
}

function parseJobLockTtlMs(): number {
  const parsed = getNum("INTERNAL_JOB_LOCK_TTL_MS", DEFAULT_JOB_LOCK_TTL_MS);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_JOB_LOCK_TTL_MS;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

async function tryAcquireJobLock(jobName: string, runId: string): Promise<boolean> {
  const collection = getInternalJobLocksCollection<unknown>();
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + parseJobLockTtlMs());

  try {
    const result = await collection.updateOne(
      {
        _id: jobName,
        $or: [
          { lockExpiresAt: { $exists: false } },
          { lockExpiresAt: null },
          { lockExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          updatedAt: now,
          lockOwner: runId,
          lockExpiresAt,
          lastRunId: runId,
          lastRunStartedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    return result.modifiedCount > 0 || result.upsertedCount > 0;
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return false;
    }
    throw error;
  }
}

async function releaseJobLock<TPayload>(input: {
  jobName: string;
  runId: string;
  startedAt: number;
  outcome: JobOutcome;
  idempotencyKey?: string;
  payload?: TPayload;
}): Promise<void> {
  const collection = getInternalJobLocksCollection<TPayload>();
  const completedAt = new Date();
  const durationMs = Math.max(0, Date.now() - input.startedAt);
  const update: Record<string, unknown> = {
    updatedAt: completedAt,
    lockOwner: null,
    lockExpiresAt: null,
    lastRunId: input.runId,
    lastRunCompletedAt: completedAt,
    lastRunDurationMs: durationMs,
    lastRunOutcome: input.outcome,
  };

  if (input.outcome === "success" && input.idempotencyKey && input.payload !== undefined) {
    update.lastSuccessIdempotencyKey = input.idempotencyKey;
    update.lastSuccessPayload = input.payload;
  }

  await collection.updateOne(
    {
      _id: input.jobName,
      lockOwner: input.runId,
    },
    {
      $set: update,
    }
  );
}

export async function runInternalJobWithLock<TPayload>(input: {
  jobName: string;
  idempotencyKey?: string;
  run: () => Promise<TPayload>;
}): Promise<InternalJobExecutionResult<TPayload>> {
  await dbConnect();

  const collection = getInternalJobLocksCollection<TPayload>();
  logInternalJobEvent("internal_job.start", {
    jobName: input.jobName,
    idempotencyKey: input.idempotencyKey,
  });

  if (input.idempotencyKey) {
    const existing = await collection.findOne(
      {
        _id: input.jobName,
        lastSuccessIdempotencyKey: input.idempotencyKey,
      },
      {
        projection: {
          lastRunId: 1,
          lastRunCompletedAt: 1,
          lastSuccessPayload: 1,
        },
      }
    );

    if (existing?.lastSuccessPayload !== undefined) {
      logInternalJobEvent("internal_job.replayed", {
        jobName: input.jobName,
        runId: existing.lastRunId ?? null,
        idempotencyKey: input.idempotencyKey,
        lockStatus: "replayed",
        completedAt: existing.lastRunCompletedAt?.toISOString() ?? null,
        payload: existing.lastSuccessPayload,
      });
      return {
        status: "replayed",
        runId: existing.lastRunId ?? null,
        completedAt: existing.lastRunCompletedAt?.toISOString() ?? null,
        payload: existing.lastSuccessPayload,
      };
    }
  }

  const runId = randomUUID();
  const acquired = await tryAcquireJobLock(input.jobName, runId);
  if (!acquired) {
    logInternalJobEvent("internal_job.locked", {
      jobName: input.jobName,
      runId,
      idempotencyKey: input.idempotencyKey,
      lockStatus: "locked",
    });
    return { status: "locked" };
  }
  logInternalJobEvent("internal_job.lock_acquired", {
    jobName: input.jobName,
    runId,
    idempotencyKey: input.idempotencyKey,
    lockStatus: "acquired",
  });

  const startedAt = Date.now();
  try {
    const payload = await input.run();
    const durationMs = Math.max(0, Date.now() - startedAt);
    await releaseJobLock({
      jobName: input.jobName,
      runId,
      startedAt,
      outcome: "success",
      idempotencyKey: input.idempotencyKey,
      payload,
    });
    logInternalJobEvent("internal_job.completed", {
      jobName: input.jobName,
      runId,
      idempotencyKey: input.idempotencyKey,
      lockStatus: "released",
      durationMs,
      outcome: "success",
      payload,
    });
    return {
      status: "completed",
      runId,
      durationMs,
      payload,
    };
  } catch (error: unknown) {
    const durationMs = Math.max(0, Date.now() - startedAt);
    await releaseJobLock({
      jobName: input.jobName,
      runId,
      startedAt,
      outcome: "failure",
    });
    logInternalJobEvent("internal_job.failed", {
      jobName: input.jobName,
      runId,
      idempotencyKey: input.idempotencyKey,
      lockStatus: "released",
      durationMs,
      outcome: "failure",
    });
    captureRouteError(error, {
      domain: "internal_jobs",
      operation: "runInternalJobWithLock",
      jobName: input.jobName,
      runId,
      lockStatus: "released",
      extras: {
        durationMs,
        idempotencyKeyPresent: Boolean(input.idempotencyKey),
      },
    });
    throw error;
  }
}
