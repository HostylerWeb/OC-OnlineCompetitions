import { EmergencyError } from "@oc/api-errors";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { created, error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import {
  completeAdminEmergencyRecovery,
  getAdminEmergencyStatus,
  getEmergencySecretHeaderName,
  requestAdminEmergencyOtp,
} from "@oc/auth-admin/auth-emergency";
import { Hono } from "hono";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const status = await getAdminEmergencyStatus();
    return success(c, status);
  } catch (err: unknown) {
    console.error("Admin emergency status error:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "auth.emergency.getStatus",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to read emergency status", 500);
  }
});

app.post("/request", async (c) => {
  try {
    const emergencySecret = c.req.header(getEmergencySecretHeaderName()) ?? undefined;

    await requestAdminEmergencyOtp({ emergencySecret });

    return success(c, { sent: true });
  } catch (err: unknown) {
    if (err instanceof EmergencyError) {
      const code =
        err.code === "NOT_FOUND"
          ? ErrorCodes.NOT_FOUND
          : err.code === "FORBIDDEN"
            ? ErrorCodes.FORBIDDEN
            : ErrorCodes.VALIDATION_ERROR;
      return error(c, code, err.message, err.status);
    }

    console.error("Admin emergency OTP request error:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "auth.emergency.requestOtp",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to send emergency OTP", 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as { otp?: string };

    const result = await completeAdminEmergencyRecovery({ otp: body.otp ?? "" });

    return created(c, result);
  } catch (err: unknown) {
    if (err instanceof EmergencyError) {
      const code =
        err.code === "NOT_FOUND"
          ? ErrorCodes.NOT_FOUND
          : err.code === "FORBIDDEN"
            ? ErrorCodes.FORBIDDEN
            : ErrorCodes.VALIDATION_ERROR;
      return error(c, code, err.message, err.status);
    }

    console.error("Admin emergency recovery error:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "auth.emergency.recover",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to repair admin account", 500);
  }
});

export default app;
