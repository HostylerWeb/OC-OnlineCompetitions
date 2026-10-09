import {
  PaymentMethod,
  type PaymentProvider,
  setDefaultPaymentMethod,
} from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { mapInternalCapabilitiesToPublic } from "@oc/api-server/lib/payment/capabilities";
import { ensureLocalPaymentMethod, isLocalPaymentMethodEnabled } from "@oc/api-server/lib/payment/ensure-local-payment-method";
import { ensurePaytriotPaymentMethod } from "@oc/api-server/lib/payment/ensure-paytriot-payment-method";
import { ensureSiteCreditPaymentMethod } from "@oc/api-server/lib/payment/ensure-site-credit-payment-method";
import { ensureStripePaymentMethod } from "@oc/api-server/lib/payment/ensure-stripe-payment-method";
import { hasProviderEnvCredentials } from "@oc/api-server/lib/payment/payment-method-credentials";
import { getAdapter, paymentProcessors } from "@oc/api-server/lib/payment/providers";
import type { PaymentProviderId } from "@oc/api-server/lib/payment/providers/types";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { updatePaymentMethodSchema, validateBody } from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();

function sanitizePaymentMethod(method: {
  provider: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  environment?: string;
  checkoutMode?: string;
  priceIds?: Record<string, string>;
  updatedAt: Date;
}) {
  return {
    capabilities: mapInternalCapabilitiesToPublic(
      paymentProcessors.find((p) => p.id === method.provider)?.capabilities ?? {
        checkout: false,
        webhooks: false,
        refunds: false,
        subscriptions: false,
      }
    ),
    provider: method.provider,
    name: method.name,
    enabled: method.enabled,
    isDefault: method.isDefault,
    environment: method.environment ?? "sandbox",
    checkoutMode: (method.checkoutMode ?? "hosted") as "hosted" | "popup",
    hasCredentials:
      method.provider === "site_credit" ? true : hasProviderEnvCredentials(method.provider),
    priceIds: method.priceIds,
    updatedAt: method.updatedAt,
  };
}

const ACTIVE_PROVIDERS = ["local", "stripe", "paytriot", "site_credit"];

async function bootstrapPaymentMethods(): Promise<void> {
  await ensureLocalPaymentMethod();
  await ensurePaytriotPaymentMethod();
  await ensureStripePaymentMethod();
  await ensureSiteCreditPaymentMethod();
  await PaymentMethod.deleteMany({
    provider: { $nin: ACTIVE_PROVIDERS },
  } as any);
}

app.get("/", requireAdmin, async (c) => {
  try {
    await dbConnect();
    await bootstrapPaymentMethods();
    const methods = await PaymentMethod.find().lean();

    return success(
      c,
      methods.map((m) => sanitizePaymentMethod(m))
    );
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.paymentMethods.list",
    });
    const message = err instanceof Error ? err.message : "Failed to fetch payment methods";
    return error(c, ErrorCodes.FETCH_ERROR, message, 500);
  }
});

app.get("/:provider", requireAdmin, async (c) => {
  try {
    const { provider } = c.req.param();
    await dbConnect();

    const method = await PaymentMethod.findOne({ provider: provider as PaymentProvider }).lean();
    if (!method) {
      return error(c, ErrorCodes.NOT_FOUND, `Payment provider '${provider}' not found`, 404);
    }

    return success(c, {
      ...sanitizePaymentMethod(method),
      credentialsSource: "environment" as const,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.paymentMethods.getOne",
    });
    const message = err instanceof Error ? err.message : "Failed to fetch payment method";
    return error(c, ErrorCodes.FETCH_ERROR, message, 500);
  }
});

app.put(
  "/:provider",
  requireAdmin,
  async (c, next) => validateBody(c, next, updatePaymentMethodSchema),
  async (c) => {
    try {
      const { provider } = c.req.param();
      const body = c.get("body") as Record<string, unknown>;
      const { enabled, isDefault, environment, checkoutMode } = body;

      if (provider === "local" && enabled === true && !isLocalPaymentMethodEnabled()) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "Local payment cannot be enabled when ENABLE_LOCAL_PAYMENT_METHOD is off",
          400
        );
      }

      await dbConnect();

      const update: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof enabled === "boolean") update.enabled = enabled;
      if (typeof isDefault === "boolean") {
        update.isDefault = isDefault;
        if (isDefault) {
          await PaymentMethod.updateMany(
            { provider: { $ne: provider as PaymentProvider } },
            { $set: { isDefault: false } }
          );
        }
      }
      if (typeof environment === "string") {
        update.environment = environment;
      }
      if (checkoutMode === "hosted" || checkoutMode === "popup") {
        update.checkoutMode = checkoutMode;
      }

      const method = await PaymentMethod.findOneAndUpdate(
        { provider: provider as PaymentProvider },
        { $set: update },
        { upsert: true, returnDocument: "after" }
      ).lean();

      if (!method) {
        return error(c, ErrorCodes.NOT_FOUND, "Payment method not found", 404);
      }

      await invalidateByChannelSafe(CH.paymentConfig, CH.paymentProviders);
      return success(c, sanitizePaymentMethod(method));
    } catch (err: unknown) {
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.paymentMethods.update",
      });
      const message = err instanceof Error ? err.message : "Failed to update payment method";
      return error(c, ErrorCodes.UPDATE_ERROR, message, 500);
    }
  }
);

app.post("/:provider/set-default", requireAdmin, async (c) => {
  try {
    const provider = c.req.param("provider") as string;
    await dbConnect();

    await setDefaultPaymentMethod(provider);
    const method = await PaymentMethod.findOne({ provider: provider as PaymentProvider }).lean();
    if (!method) {
      return error(c, ErrorCodes.NOT_FOUND, "Payment method not found", 404);
    }

    await invalidateByChannelSafe(CH.paymentConfig, CH.paymentProviders);
    return success(c, sanitizePaymentMethod(method));
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.paymentMethods.setDefault",
    });
    const message = err instanceof Error ? err.message : "Failed to set default";
    return error(c, ErrorCodes.UPDATE_ERROR, message, 500);
  }
});

app.post("/:provider/test", requireAdmin, async (c) => {
  try {
    const { provider } = c.req.param();
    const { environment, sandboxCredentials, liveCredentials } = await c.req.json<{
      environment: "sandbox" | "live";
      sandboxCredentials?: {
        clientId?: string;
        secret?: string;
        webhookId?: string;
        merchantId?: string;
      };
      liveCredentials?: {
        clientId?: string;
        secret?: string;
        webhookId?: string;
        merchantId?: string;
      };
    }>();

    if (provider === "local") {
      return success(c, { success: true });
    }

    const creds = environment === "sandbox" ? (sandboxCredentials ?? {}) : (liveCredentials ?? {});

    if (provider === "paytriot") {
      const adapter = getAdapter("paytriot" as PaymentProviderId);
      const result = await adapter.testCredentials(
        environment,
        creds.clientId as string,
        creds.secret as string
      );
      return success(c, result);
    }

    if (provider === "stripe") {
      const adapter = getAdapter("stripe" as PaymentProviderId);
      const result = await adapter.testCredentials(
        environment,
        creds.clientId as string,
        creds.secret as string
      );
      return success(c, result);
    }

    return error(c, ErrorCodes.INVALID_PROVIDER, "Unknown payment provider", 400);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.paymentMethods.test",
    });
    const message = err instanceof Error ? err.message : "Failed to test credentials";
    return error(c, ErrorCodes.TEST_ERROR, message, 500);
  }
});

export default app;
