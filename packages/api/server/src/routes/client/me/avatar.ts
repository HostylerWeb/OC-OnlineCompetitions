import { Profile } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { getEnv } from "@oc/env/server";
import { requireSession } from "@oc/api-server/middleware/auth";
import {
  isAvatarUploadValidationError,
  processAvatarUploadBytes,
  validateAvatarFileMeta,
} from "@oc/api-server/lib/avatar/process-upload";
import {
  deleteAvatarIfOwned,
  getAuthUserImage,
  hasGoogleAccount,
} from "@oc/api-storage/avatar-storage";
import { buildAssetUrl, uploadFile } from "@oc/api-storage/s3";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireSession);

function rejectAnonymous(c: Parameters<typeof requireSession>[0]) {
  const user = c.get("user");
  if (user?.isAnonymous) {
    return error(c, ErrorCodes.FORBIDDEN, "Please sign in to manage your profile picture", 403);
  }
  return null;
}

app.post("/", async (c) => {
  try {
    const denied = rejectAnonymous(c);
    if (denied) return denied;

    const userId = c.get("userId")!;
    const user = c.get("user")!;

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Expected a multipart form upload (multipart/form-data)",
        400
      );
    }

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not read upload. Use JPEG, PNG, or WebP under 2MB.";
      return error(c, ErrorCodes.VALIDATION_ERROR, msg, 400);
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      return error(c, ErrorCodes.MISSING_PARAMS, "file is required", 400);
    }

    try {
      validateAvatarFileMeta(file);
    } catch (err) {
      if (isAvatarUploadValidationError(err)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, err.message, 400);
      }
      throw err;
    }

    await dbConnect();

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let processed: Awaited<ReturnType<typeof processAvatarUploadBytes>>;
    try {
      processed = await processAvatarUploadBytes(userId, bytes, file.type);
    } catch (err) {
      if (isAvatarUploadValidationError(err)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, err.message, 400);
      }
      throw err;
    }

    try {
      await uploadFile(processed.key, processed.bytes, processed.contentType);
    } catch (err) {
      console.error("[avatar.upload] storage failed:", err);
      const devDetail =
        getEnv("NODE_ENV") === "development" && err instanceof Error ? err.message : undefined;
      return error(
        c,
        ErrorCodes.INTERNAL_ERROR,
        devDetail ?? "Could not save your photo. Try again in a moment.",
        503
      );
    }

    const existing = await Profile.findById(userId).select("avatarUrl").lean();
    if (existing?.avatarUrl) {
      await deleteAvatarIfOwned(existing.avatarUrl).catch((err) =>
        console.error("Failed to delete old avatar:", err)
      );
    }

    const avatarUrl = buildAssetUrl(processed.key);
    const profile = await Profile.findByIdAndUpdate(
      userId,
      { avatarUrl },
      { returnDocument: "after", new: true }
    ).lean();

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    return success(c, {
      ...profile,
      isAdmin: user.role === "admin" || user.role === "manager",
      isVerified: user.emailVerified ?? profile.isVerified,
    });
  } catch (err: unknown) {
    console.error("[avatar.upload]", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "avatar.upload",
    });
    const devDetail =
      getEnv("NODE_ENV") === "development" && err instanceof Error ? err.message : undefined;
    return error(
      c,
      ErrorCodes.INTERNAL_ERROR,
      devDetail ?? "Internal server error",
      500,
      devDetail ? { cause: devDetail } : undefined
    );
  }
});

app.delete("/", async (c) => {
  try {
    const denied = rejectAnonymous(c);
    if (denied) return denied;

    const userId = c.get("userId")!;
    await dbConnect();

    const existing = await Profile.findById(userId).select("avatarUrl").lean();
    if (existing?.avatarUrl) {
      await deleteAvatarIfOwned(existing.avatarUrl);
    }

    const profile = await Profile.findByIdAndUpdate(
      userId,
      { $unset: { avatarUrl: 1 } },
      { returnDocument: "after" }
    ).lean();

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    return success(c, profile);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "avatar.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/import-google", async (c) => {
  try {
    const denied = rejectAnonymous(c);
    if (denied) return denied;

    const userId = c.get("userId")!;
    await dbConnect();

    const linked = await hasGoogleAccount(userId);
    if (!linked) {
      return error(c, ErrorCodes.FORBIDDEN, "Connect a Google account first", 403);
    }

    const image = await getAuthUserImage(userId);
    if (!image) {
      return error(c, ErrorCodes.NOT_FOUND, "No Google profile picture available", 404);
    }

    const existing = await Profile.findById(userId).select("avatarUrl").lean();
    if (existing?.avatarUrl) {
      await deleteAvatarIfOwned(existing.avatarUrl).catch((err) =>
        console.error("Failed to delete old avatar:", err)
      );
    }

    const profile = await Profile.findByIdAndUpdate(
      userId,
      { avatarUrl: image },
      { returnDocument: "after" }
    ).lean();

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    return success(c, profile);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "avatar.importGoogle",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
