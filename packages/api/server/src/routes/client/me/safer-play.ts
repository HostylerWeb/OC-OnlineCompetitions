import {
  applySelfExclusion,
  applySpendLimit,
  buildSaferPlayState,
  createSelfExclusionOverrideRequest,
} from "@oc/api-compliance/compliance-user-service";
import { ComplianceError } from "@oc/api-errors";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { requireSession } from "@oc/api-server/middleware/auth";
import { createOverrideRequestSchema, userSpendLimitUpdateSchema } from "@oc/api-validation";
import type { SelfExclusionDuration } from "@oc/types";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireSession);

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();
    const state = await buildSaferPlayState(userId);
    return success(c, state);
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.saferPlay.get",
    });
    console.error("Error fetching safer play state:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    const body = await c.req.json();
    await dbConnect();

    const parsed = userSpendLimitUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "),
        400
      );
    }

    await applySpendLimit(userId, parsed.data.monthlySpendLimit, { source: "user" });

    const state = await buildSaferPlayState(userId);
    return success(c, state);
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.saferPlay.update",
    });
    console.error("Error updating spend limit:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/self-exclude", async (c) => {
  try {
    const userId = c.get("userId")!;
    const body = await c.req.json();
    await dbConnect();

    const duration = body.duration as SelfExclusionDuration | undefined;
    if (!duration || !["6months", "1year", "5years", "permanent"].includes(duration)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid self-exclusion duration", 400);
    }

    const result = await applySelfExclusion(userId, duration, {
      reason: "User self-excluded via Responsible Play",
      source: "user",
    });

    return success(c, {
      selfExcluded: true,
      selfExcludedUntil: result.selfExcludedUntil?.toISOString() ?? null,
      logoutRequired: true,
    });
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.saferPlay.selfExclude",
    });
    console.error("Error processing self-exclusion:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/request-override", async (c) => {
  try {
    const userId = c.get("userId")!;
    const body = await c.req.json();
    await dbConnect();

    const parsed = createOverrideRequestSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "),
        400
      );
    }

    const result = await createSelfExclusionOverrideRequest(userId, parsed.data.reason);

    // Notify admins about the override request
    void (async () => {
      await dbConnect();
      if (!mongoose.models.User) {
        mongoose.model("User", new mongoose.Schema({}, { strict: false, collection: "user" }));
      }
      const adminUsers = (await mongoose
        .model("User")
        .find({ role: "admin" }, { _id: 1 })
        .lean()) as Array<{ _id: mongoose.Types.ObjectId }>;
      if (adminUsers.length > 0) {
        const adminIds = adminUsers.map((u) => u._id.toString());
        void sendPushNotification(
          {
            title: "Self-Exclusion Override Request",
            body: `A user has requested a manual override of their self-exclusion.`,
            type: "system",
            tag: "self-exclusion-override",
            url: "/compliance-settings",
          },
          { userId: adminIds }
        ).catch(() => {});
      }
    })().catch(() => {});

    return success(c, result);
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.saferPlay.requestOverride",
    });
    console.error("Error creating override request:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
