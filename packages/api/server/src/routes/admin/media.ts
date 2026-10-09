import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { findMediaUsages, type MediaUsage, parseUrlList } from "@oc/api-server/lib/media-usage";
import { requireManager } from "@oc/api-server/middleware/auth";
import {
  buildAssetUrl,
  deleteAsset,
  extractKeyFromUrl,
  getAssetBaseUrl,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  headObject,
  listAssets,
  uploadFile,
} from "@oc/api-storage/s3";
import { listFlatAssetsPage } from "@oc/api-storage/list-flat-assets";
import { Hono } from "hono";
import imageSize from "image-size";
import sharp from "sharp";

const app = new Hono();

app.use("*", requireManager);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_PREFIXES = ["prizes/", "uploads/", "og-images/"] as const;
const MAX_KEYS_PER_METADATA = 50;
const MAX_KEYS_PER_BATCH_DELETE = 100;
const USAGE_CACHE_TTL_MS = 60_000;

interface UploadDimensions {
  width: number;
  height: number;
}

interface CachedUsage {
  ts: number;
  usages: MediaUsage[];
}

const usageCache = new Map<string, CachedUsage>();

export function resetMediaUsageCacheForTests(): void {
  usageCache.clear();
}

function parseKeysList(raw: string | null | undefined, max: number): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  const parts = raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  const deduped = Array.from(new Set(parts));
  return deduped.slice(0, max);
}

function detectImageDimensions(bytes: Uint8Array): UploadDimensions | null {
  try {
    const result = imageSize(bytes);
    if (
      result &&
      typeof result.width === "number" &&
      typeof result.height === "number" &&
      result.width > 0 &&
      result.height > 0
    ) {
      return { width: result.width, height: result.height };
    }
  } catch {
    return null;
  }
  return null;
}

async function generateBlurDataUrl(bytes: Uint8Array): Promise<string | null> {
  try {
    const buf = await sharp(bytes)
      .resize(16, 16, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 20 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

app.post("/upload", async (c) => {
  const requestId = c.get("requestId") || "no-reqid";
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const keyParam = formData.get("key") as string | undefined;
  const slug = formData.get("slug") as string | undefined;

  const userId = (c.get("userId") ?? null) as string | null;
  const userEmail = (c.get("email") ?? null) as string | null;

  console.log(
    `[media.upload] ${requestId} received file=${file?.name} size=${file?.size} type=${file?.type} slug=${slug} keyParam=${keyParam} uploader=${userId ?? "anon"}`
  );

  if (!file) {
    console.warn(`[media.upload] ${requestId} no file in formData`);
    return error(c, ErrorCodes.MISSING_PARAMS, "file is required", 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    console.warn(`[media.upload] ${requestId} file too large: ${file.size} > ${MAX_FILE_SIZE}`);
    return error(c, ErrorCodes.VALIDATION_ERROR, "File too large. Max 10MB.", 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const random = Math.random().toString(36).slice(2);
  let key =
    keyParam ||
    (slug
      ? `prizes/${slug}/${Date.now()}-${random}.${ext}`
      : `uploads/${Date.now()}-${random}.${ext}`);

  console.log(`[media.upload] ${requestId} computed key=${key} ext=${ext}`);

  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    console.warn(`[media.upload] ${requestId} invalid key prefix: ${key}`);
    return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid key prefix", 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  let bytes = new Uint8Array(arrayBuffer);
  let contentType = file.type || "application/octet-stream";

  const { transformUploadBytes } = await import("@oc/api-server/lib/media-converter/transform");
  const transformed = await transformUploadBytes({ key, bytes, contentType });
  key = transformed.key;
  bytes = transformed.bytes;
  contentType = transformed.contentType;

  console.log(
    `[media.upload] ${requestId} reading file completed bytes=${bytes.byteLength} contentType=${contentType}`
  );

  let dimensions: UploadDimensions | null = null;
  let blurDataUrl: string | null = null;
  if (contentType.startsWith("image/")) {
    const head = bytes.subarray(0, Math.min(bytes.byteLength, 64 * 1024));
    dimensions = detectImageDimensions(head);
    console.log(
      `[media.upload] ${requestId} dimensions=${dimensions ? `${dimensions.width}x${dimensions.height}` : "unknown"}`
    );
    blurDataUrl = await generateBlurDataUrl(bytes);
  }

  const extraHeaders: Record<string, string> = {
    "x-amz-meta-uploaded-at": new Date().toISOString(),
  };
  if (userId) extraHeaders["x-amz-meta-uploader-id"] = userId;
  if (userEmail) extraHeaders["x-amz-meta-uploader-email"] = userEmail;
  if (dimensions) {
    extraHeaders["x-amz-meta-width"] = String(dimensions.width);
    extraHeaders["x-amz-meta-height"] = String(dimensions.height);
  }
  if (blurDataUrl) {
    extraHeaders["x-amz-meta-blur-data-url"] = blurDataUrl;
  }

  try {
    console.log(
      `[media.upload] ${requestId} calling uploadFile... extraHeaders=${Object.keys(extraHeaders).length}`
    );
    await uploadFile(key, bytes, contentType, extraHeaders);
    console.log(`[media.upload] ${requestId} uploadFile succeeded`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    console.error(`[media.upload] ${requestId} uploadFile failed for key=${key}:`, msg);
    return error(c, ErrorCodes.INTERNAL_ERROR, msg, 500);
  }

  const publicUrl = buildAssetUrl(key);
  console.log(`[media.upload] ${requestId} returning success url=${publicUrl} key=${key}`);
  return success(c, { publicUrl, key, blurDataUrl });
});

app.get("/presign-upload", async (c) => {
  const { key, contentType } = c.req.query();

  if (!key || !contentType) {
    return error(
      c,
      ErrorCodes.MISSING_PARAMS,
      "key and contentType query params are required",
      400
    );
  }

  const url = await getPresignedUploadUrl(key, contentType);
  return success(c, { url, publicUrl: buildAssetUrl(key) });
});

app.get("/presign-download", async (c) => {
  const { key } = c.req.query();

  if (!key) {
    return error(c, ErrorCodes.MISSING_PARAMS, "key query param is required", 400);
  }

  const url = await getPresignedDownloadUrl(key);
  return success(c, { url });
});

app.get("/assets", async (c) => {
  const prefix = c.req.query("prefix") ?? "";
  const flat = c.req.query("flat") === "1";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 50);
  const cursor = c.req.query("cursor") || undefined;
  const search = c.req.query("search") || undefined;
  const type = c.req.query("type") || undefined;

  if (limit < 1) {
    return error(c, ErrorCodes.INVALID_LIMIT, "limit must be >= 1", 400);
  }

  const result = flat
    ? await listFlatAssetsPage(limit, cursor, search)
    : await listAssets(prefix, limit, cursor, search);
  let { assets } = result;

  if (type === "image") {
    const imageExts = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"];
    assets = assets.filter(
      (a) =>
        (a.size === 0 && a.key.endsWith("/")) ||
        imageExts.some((ext) => a.key.toLowerCase().endsWith(ext))
    );
  } else if (type === "video") {
    const videoExts = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv"];
    assets = assets.filter(
      (a) =>
        (a.size === 0 && a.key.endsWith("/")) ||
        videoExts.some((ext) => a.key.toLowerCase().endsWith(ext))
    );
  } else if (type === "other") {
    const imageExts = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"];
    const videoExts = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv"];
    const allMediaExts = [...imageExts, ...videoExts];
    assets = assets.filter(
      (a) =>
        (a.size === 0 && a.key.endsWith("/")) ||
        !allMediaExts.some((ext) => a.key.toLowerCase().endsWith(ext))
    );
  }

  return success(c, { assets, nextCursor: result.nextCursor });
});

app.delete("/assets", async (c) => {
  const requestId = c.get("requestId") || "no-reqid";
  const keyParam = c.req.query("key");
  const urlParam = c.req.query("url");
  const body = await c.req
    .json<{ key?: string; url?: string }>()
    .catch(() => ({ key: "", url: "" }));
  const key =
    keyParam ||
    body.key ||
    (urlParam || body.url ? extractKeyFromUrl(urlParam || body.url || "") : "");

  console.log(
    `[media.delete] ${requestId} query key=${keyParam} url=${urlParam} body=${JSON.stringify(body)} resolvedKey=${key}`
  );

  if (!key) {
    console.warn(`[media.delete] ${requestId} no key resolved`);
    return error(c, ErrorCodes.MISSING_PARAMS, "key or url is required", 400);
  }

  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid key prefix", 400);
  }

  console.log(`[media.delete] ${requestId} calling deleteAsset key=${key}`);
  await deleteAsset(key);
  console.log(`[media.delete] ${requestId} success key=${key}`);

  return success(c, { success: true });
});

app.get("/usage", async (c) => {
  const requestId = c.get("requestId") || "no-reqid";
  const urlsRaw = c.req.query("urls");
  if (typeof urlsRaw !== "string" || urlsRaw.length === 0) {
    return error(c, ErrorCodes.MISSING_PARAMS, "urls query param is required", 400);
  }
  const urls = parseUrlList(urlsRaw);
  if (urls.length === 0) {
    return success(c, { usages: {} });
  }

  console.log(`[media.usage] ${requestId} requested urls=${urls.length}`);

  const now = Date.now();
  const usages: Record<string, MediaUsage[]> = {};
  const toFetch: string[] = [];

  for (const url of urls) {
    const cached = usageCache.get(url);
    if (cached && now - cached.ts < USAGE_CACHE_TTL_MS) {
      usages[url] = cached.usages;
    } else {
      usages[url] = [];
      toFetch.push(url);
    }
  }

  if (toFetch.length > 0) {
    try {
      const lookup = await findMediaUsages(toFetch);
      for (const url of toFetch) {
        const found = lookup.byUrl.get(url) ?? [];
        usages[url] = found;
        usageCache.set(url, { ts: now, usages: found });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Usage lookup failed";
      console.error(`[media.usage] ${requestId} error:`, msg);
      return error(c, ErrorCodes.INTERNAL_ERROR, msg, 500);
    }
  }

  return success(c, { usages });
});

app.get("/metadata", async (c) => {
  const requestId = c.get("requestId") || "no-reqid";
  const keysRaw = c.req.query("keys");
  if (typeof keysRaw !== "string" || keysRaw.length === 0) {
    return error(c, ErrorCodes.MISSING_PARAMS, "keys query param is required", 400);
  }
  const keys = parseKeysList(keysRaw, MAX_KEYS_PER_METADATA);
  if (keys.length === 0) {
    return success(c, { metadata: {} });
  }

  console.log(`[media.metadata] ${requestId} requested keys=${keys.length}`);

  const settled = await Promise.allSettled(
    keys.map(async (key) => ({ key, meta: await headObject(key) }))
  );

  const metadata: Record<string, unknown> = {};
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!;
    const key = keys[i]!;
    if (result.status === "rejected") {
      console.warn(`[media.metadata] ${requestId} head rejected for key=${key}`);
      metadata[key] = null;
      continue;
    }
    const { meta } = result.value;
    if (!meta) {
      metadata[key] = null;
      continue;
    }
    const out: Record<string, unknown> = {};
    if (meta.contentType) out.contentType = meta.contentType;
    if (typeof meta.contentLength === "number") out.size = meta.contentLength;
    if (meta.lastModified) out.lastModified = meta.lastModified;
    const width = meta.metadata["x-amz-meta-width"];
    const height = meta.metadata["x-amz-meta-height"];
    if (width) {
      const w = Number.parseInt(width, 10);
      if (Number.isFinite(w) && w > 0) out.width = w;
    }
    if (height) {
      const h = Number.parseInt(height, 10);
      if (Number.isFinite(h) && h > 0) out.height = h;
    }
    const uploaderId = meta.metadata["x-amz-meta-uploader-id"];
    const uploaderEmail = meta.metadata["x-amz-meta-uploader-email"];
    if (uploaderId) out.uploaderId = uploaderId;
    if (uploaderEmail) out.uploaderEmail = uploaderEmail;
    metadata[key] = out;
  }

  return success(c, { metadata });
});

app.post("/delete-batch", async (c) => {
  const requestId = c.get("requestId") || "no-reqid";
  let body: { keys?: unknown; force?: unknown };
  try {
    body = (await c.req.json()) as { keys?: unknown; force?: unknown };
  } catch {
    return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid JSON body", 400);
  }

  if (!Array.isArray(body.keys)) {
    return error(c, ErrorCodes.MISSING_PARAMS, "keys must be an array", 400);
  }
  const rawKeys = body.keys.filter((k): k is string => typeof k === "string");
  const keys = Array.from(new Set(rawKeys)).slice(0, MAX_KEYS_PER_BATCH_DELETE);
  const force = body.force === true;

  console.log(`[media.delete-batch] ${requestId} requested keys=${keys.length} force=${force}`);

  if (keys.length === 0) {
    return success(c, { results: [] });
  }

  const invalid = keys.filter((k) => !ALLOWED_PREFIXES.some((p) => k.startsWith(p)));
  if (invalid.length > 0) {
    return error(
      c,
      ErrorCodes.VALIDATION_ERROR,
      `Invalid key prefix (only prizes/ and uploads/ allowed): ${invalid.slice(0, 3).join(", ")}`,
      400
    );
  }

  let usagesByUrl: Map<string, unknown[]> = new Map();
  if (!force) {
    try {
      const base = getAssetBaseUrl().replace(/\/$/, "");
      const urls = keys.map((k) => `${base}/${k.replace(/^\/+/, "")}`);
      const lookup = await findMediaUsages(urls);
      usagesByUrl = lookup.byUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Usage lookup failed";
      console.error(`[media.delete-batch] ${requestId} usage error:`, msg);
      return error(c, ErrorCodes.INTERNAL_ERROR, msg, 500);
    }
  }

  const base = getAssetBaseUrl().replace(/\/$/, "");
  const results: Array<{ key: string; success: boolean; error?: string }> = [];

  for (const key of keys) {
    if (!force) {
      const url = `${base}/${key.replace(/^\/+/, "")}`;
      const usages = usagesByUrl.get(url) ?? [];
      if (usages.length > 0) {
        results.push({ key, success: false, error: "in_use" });
        continue;
      }
    }
    try {
      await deleteAsset(key);
      results.push({ key, success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "delete failed";
      console.error(`[media.delete-batch] ${requestId} delete failed key=${key}:`, msg);
      results.push({ key, success: false, error: msg });
    }
  }

  console.log(
    `[media.delete-batch] ${requestId} complete ok=${results.filter((r) => r.success).length} fail=${results.filter((r) => !r.success).length}`
  );
  return success(c, { results });
});

export default app;
