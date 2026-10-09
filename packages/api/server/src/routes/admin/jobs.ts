import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { runCheckBonusAwardMilestones } from "@oc/api-server/lib/jobs/check-bonus-awards";
import { runCheckCompetitionsForDraw } from "@oc/api-server/lib/jobs/check-competitions-for-draw";
import { runCleanupAbandonedOrders } from "@oc/api-server/lib/jobs/cleanup-abandoned-orders";
import { processScheduledNotifications } from "@oc/api-server/lib/jobs/process-scheduled-notifications";
import { runRetryOrderConfirmationEmails } from "@oc/api-server/lib/jobs/retry-order-confirmation-emails";
import { runTicketingAnomalyChecks } from "@oc/api-server/lib/jobs/ticketing-anomaly-checks";
import { runInternalJobWithLock } from "@oc/api-server/lib/utils/internal-job-runner";
import {
  getCronJobsSecretHeaderName,
  validateCronJobsSecret,
} from "@oc/auth-admin/internal-jobs-auth";
import { Hono } from "hono";

const app = new Hono();

const IDEMPOTENCY_HEADER = "Idempotency-Key";

app.use("*", async (c, next) => {
  const secretHeader = getCronJobsSecretHeaderName();
  const cronSecret = c.req.header(secretHeader) ?? undefined;
  if (!validateCronJobsSecret(cronSecret)) {
    return error(
      c,
      ErrorCodes.FORBIDDEN,
      "Invalid or missing cron jobs secret (set CRON_JOBS_SECRET).",
      403
    );
  }
  await next();
});

async function executeInternalJob<TPayload>(input: {
  c: Parameters<typeof success>[0];
  jobName: string;
  run: () => Promise<TPayload>;
}) {
  const requestId = input.c.get("requestId") ?? undefined;
  const idempotencyKey = input.c.req.header(IDEMPOTENCY_HEADER) ?? undefined;
  try {
    const result = await runInternalJobWithLock({
      jobName: input.jobName,
      idempotencyKey,
      run: input.run,
    });

    if (result.status === "locked") {
      return error(input.c, ErrorCodes.CONFLICT, "Job is already running", 409);
    }

    if (result.status === "replayed") {
      return success(input.c, {
        job: input.jobName,
        status: "replayed",
        runId: result.runId,
        completedAt: result.completedAt,
        data: result.payload,
      });
    }

    return success(input.c, {
      job: input.jobName,
      status: "completed",
      runId: result.runId,
      durationMs: result.durationMs,
      data: result.payload,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      domain: "internal_jobs",
      operation: "executeInternalJob",
      jobName: input.jobName,
      requestId,
      path: input.c.req.path,
      tags: {
        hasIdempotencyKey: Boolean(idempotencyKey),
      },
    });
    console.error(`[internal-jobs] ${input.jobName} failed`, err);
    return error(input.c, ErrorCodes.INTERNAL_ERROR, "Job execution failed", 500);
  }
}

app.post("/check-competitions-for-draw", async (c) => {
  return executeInternalJob({
    c,
    jobName: "check-competitions-for-draw",
    run: runCheckCompetitionsForDraw,
  });
});

app.post("/ticketing-anomaly-checks", async (c) => {
  return executeInternalJob({
    c,
    jobName: "ticketing-anomaly-checks",
    run: async () => {
      await runTicketingAnomalyChecks();
      return { healthy: true };
    },
  });
});

app.post("/cleanup-abandoned-orders", async (c) => {
  return executeInternalJob({
    c,
    jobName: "cleanup-abandoned-orders",
    run: runCleanupAbandonedOrders,
  });
});

app.post("/process-scheduled-notifications", async (c) => {
  return executeInternalJob({
    c,
    jobName: "process-scheduled-notifications",
    run: processScheduledNotifications,
  });
});

app.post("/check-bonus-awards", async (c) => {
  return executeInternalJob({
    c,
    jobName: "check-bonus-awards",
    run: async () => {
      const result = await runCheckBonusAwardMilestones();
      return { success: true, ...result };
    },
  });
});

app.post("/retry-order-confirmation-emails", async (c) => {
  return executeInternalJob({
    c,
    jobName: "retry-order-confirmation-emails",
    run: runRetryOrderConfirmationEmails,
  });
});

export default app;
