import {
  DEFAULT_MEDIA_CONVERTER_SETTINGS,
  MediaConverterSettings,
  type IMediaConverterSettings,
} from "@oc/api-db/models/MediaConverterSettings";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import {
  invalidateMediaConverterSettingsCache,
} from "@oc/api-server/lib/media-converter/settings";
import {
  buildBulkCatalog,
  convertBulkItem,
  deleteOriginalBulkKeys,
  resolveEligibleCatalogItem,
  verifyBulkKeys,
} from "@oc/api-server/lib/media-converter/bulk";
import {
  adminMediaConverterBulkConvertSchema,
  adminMediaConverterBulkDeleteOriginalsSchema,
  adminMediaConverterBulkVerifySchema,
  adminMediaConverterSettingsUpdateSchema,
} from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireAdmin);

app.get("/", async (c) => {
  try {
    await dbConnect();
    const settings = await MediaConverterSettings.findById("media_converter_settings").lean();
    return success(c, settings ?? DEFAULT_MEDIA_CONVERTER_SETTINGS);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.mediaConverterSettings.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put("/", async (c) => {
  try {
    const body = await c.req.json();
    await dbConnect();

    const parsed = adminMediaConverterSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid media converter settings", 400);
    }

    const updates: Record<string, unknown> = {};
    const data = parsed.data;

    if (typeof data.addonEnabled === "boolean") {
      updates.addonEnabled = data.addonEnabled;
    }

    if (data.image) {
      for (const field of ["enabled", "quality", "maxWidth", "maxHeight"] as const) {
        const v = data.image[field];
        if (typeof v === "number" || typeof v === "boolean") {
          updates[`image.${field}`] = v;
        }
      }
      if (data.image.scopes) {
        for (const [scope, enabled] of Object.entries(data.image.scopes)) {
          if (typeof enabled === "boolean") {
            updates[`image.scopes.${scope}`] = enabled;
          }
        }
      }
    }

    if (data.video) {
      for (const field of ["enabled", "quality", "maxWidth", "preserveAudio"] as const) {
        const v = data.video[field];
        if (typeof v === "number" || typeof v === "boolean") {
          updates[`video.${field}`] = v;
        }
      }
      if (data.video.scopes) {
        for (const [scope, enabled] of Object.entries(data.video.scopes)) {
          if (typeof enabled === "boolean") {
            updates[`video.scopes.${scope}`] = enabled;
          }
        }
      }
    }

    const settings = await MediaConverterSettings.findByIdAndUpdate(
      "media_converter_settings",
      { $set: updates },
      { upsert: true, returnDocument: "after" }
    ).lean<IMediaConverterSettings>();

    invalidateMediaConverterSettingsCache();

    return success(c, settings ?? DEFAULT_MEDIA_CONVERTER_SETTINGS);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.mediaConverterSettings.put",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/bulk/preview", async (c) => {
  try {
    await dbConnect();
    const preview = await buildBulkCatalog();
    return success(c, preview);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.mediaConverterSettings.bulkPreview",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to scan storage", 500);
  }
});

app.post("/bulk/convert", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = adminMediaConverterBulkConvertSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid convert request", 400);
    }

    await dbConnect();
    const settings = await MediaConverterSettings.findById("media_converter_settings").lean<IMediaConverterSettings>();

    const results = [];
    for (const key of parsed.data.keys) {
      const item = await resolveEligibleCatalogItem(key, settings ?? undefined);
      if (!item) {
        results.push({
          key,
          newKey: key,
          kind: "image" as const,
          status: "failed" as const,
          oldUrl: "",
          newUrl: "",
          verified: false,
          documentsUpdated: 0,
          error: "Key not eligible for conversion",
        });
        continue;
      }
      results.push(await convertBulkItem(item, settings ?? undefined));
    }

    return success(c, { results });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.mediaConverterSettings.bulkConvert",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Bulk conversion failed", 500);
  }
});

app.post("/bulk/verify", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = adminMediaConverterBulkVerifySchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid verify request", 400);
    }
    const results = await verifyBulkKeys(parsed.data.keys);
    const ok = results.every((r) => r.ok);
    return success(c, { ok, results });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.mediaConverterSettings.bulkVerify",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Verification failed", 500);
  }
});

app.post("/bulk/delete-originals", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = adminMediaConverterBulkDeleteOriginalsSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid delete request", 400);
    }
    const outcome = await deleteOriginalBulkKeys(parsed.data.keys);
    return success(c, outcome);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.mediaConverterSettings.bulkDeleteOriginals",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Delete originals failed", 500);
  }
});

export default app;
