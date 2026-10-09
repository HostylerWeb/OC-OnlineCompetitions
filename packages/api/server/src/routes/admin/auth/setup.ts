import { SetupError } from "@oc/api-errors";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { created, error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import {
  bootstrapAdmin,
  getAdminSetupStatus,
  getSetupSecretHeaderName,
} from "@oc/auth-admin/auth-setup";
import { Hono } from "hono";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const status = await getAdminSetupStatus();
    return success(c, status);
  } catch (err: unknown) {
    console.error("Admin setup status error:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "auth.setup.getStatus",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to read setup status", 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const setupSecret = c.req.header(getSetupSecretHeaderName()) ?? undefined;

    const result = await bootstrapAdmin({
      email: body.email,
      setupSecret,
    });

    return created(c, result);
  } catch (err: unknown) {
    if (err instanceof SetupError) {
      const code =
        err.code === "CONFLICT"
          ? ErrorCodes.CONFLICT
          : err.code === "FORBIDDEN"
            ? ErrorCodes.FORBIDDEN
            : ErrorCodes.VALIDATION_ERROR;
      return error(c, code, err.message, err.status);
    }

    console.error("Admin setup error:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "auth.setup.complete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to create admin account", 500);
  }
});

export default app;
