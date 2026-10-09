import type { IMediaConverterSettings } from "@oc/api-db/models/MediaConverterSettings";
import { createExternalAxios } from "@oc/api-axios";
import {
  buildAssetUrl,
  deleteAsset,
  getPresignedDownloadUrl,
  headObject,
  listStorageDelimiterPage,
  uploadFile,
} from "@oc/api-storage/s3";
import type { MediaConverterScope } from "@oc/types";
import { convertImageToWebp } from "./convert-image";
import { convertVideoToWebm } from "./convert-video";
import { getMediaConverterSettings } from "./settings";
import { inferUploadKind, isSkippableImageType, resolveScopeFromKey } from "./scope";
import { replaceStoredUrlsForKey } from "./url-replace";

const FRAME_PREFIX = "frames/";
const ROOT_PREFIXES = ["uploads/", "prizes/", "landing-videos/", "avatars/", "og-images/"] as const;

const downloadAxios = createExternalAxios({ baseURL: "", timeout: 600_000 });

export type BulkMediaKind = "image" | "video";

export interface BulkCatalogItem {
  key: string;
  kind: BulkMediaKind;
  scope: MediaConverterScope;
  contentType: string;
}

export interface BulkPreviewCounts {
  eligibleImages: number;
  eligibleVideos: number;
  alreadyTargetFormat: number;
  skipped: number;
  items: BulkCatalogItem[];
}

export type BulkConvertStatus = "converted" | "skipped" | "failed" | "already_optimal";

export interface BulkConvertResultItem {
  key: string;
  newKey: string;
  kind: BulkMediaKind;
  status: BulkConvertStatus;
  oldUrl: string;
  newUrl: string;
  originalKeyForDeletion?: string;
  verified: boolean;
  documentsUpdated: number;
  error?: string;
}

export interface BulkVerifyResultItem {
  key: string;
  ok: boolean;
  contentType?: string;
  contentLength?: number;
  error?: string;
}

function scopeEnabledForBulk(
  settings: IMediaConverterSettings,
  scope: MediaConverterScope,
  kind: BulkMediaKind
): boolean {
  if (!settings.addonEnabled) return false;
  if (kind === "image") {
    return settings.image.enabled && settings.image.scopes[scope] === true;
  }
  return settings.video.enabled && settings.video.scopes[scope] === true;
}

function isExcludedKey(key: string): boolean {
  const n = key.replace(/^\/+/, "");
  return n.startsWith(FRAME_PREFIX) || n.includes("/frames/");
}

async function collectFileKeysUnder(prefix: string): Promise<string[]> {
  const files: string[] = [];
  const queue: string[] = [prefix];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);

    let cursor: string | undefined;
    do {
      const page = await listStorageDelimiterPage(current, 500, cursor);
      for (const file of page.files) {
        if (!isExcludedKey(file.key)) files.push(file.key);
      }
      for (const folder of page.folders) {
        if (!seen.has(folder) && !isExcludedKey(folder)) queue.push(folder);
      }
      cursor = page.nextCursor;
    } while (cursor);
  }

  return files;
}

export async function buildBulkCatalog(settings?: IMediaConverterSettings): Promise<BulkPreviewCounts> {
  const cfg = settings ?? (await getMediaConverterSettings());
  const keys = new Set<string>();
  for (const root of ROOT_PREFIXES) {
    const found = await collectFileKeysUnder(root);
    for (const k of found) keys.add(k);
  }

  let eligibleImages = 0;
  let eligibleVideos = 0;
  let alreadyTargetFormat = 0;
  let skipped = 0;
  const items: BulkCatalogItem[] = [];

  for (const key of keys) {
    const scope = resolveScopeFromKey(key);
    if (!scope) {
      skipped += 1;
      continue;
    }

    const meta = await headObject(key);
    const contentType = meta?.contentType ?? "application/octet-stream";
    const kind = inferUploadKind(contentType);
    if (!kind) {
      skipped += 1;
      continue;
    }

    if (kind === "image" && isSkippableImageType(contentType)) {
      skipped += 1;
      continue;
    }

    if (!scopeEnabledForBulk(cfg, scope, kind)) {
      skipped += 1;
      continue;
    }

    if (kind === "image" && contentType === "image/webp") {
      alreadyTargetFormat += 1;
      continue;
    }
    if (kind === "video" && contentType === "video/webm") {
      alreadyTargetFormat += 1;
      continue;
    }

    if (kind === "image") eligibleImages += 1;
    else eligibleVideos += 1;

    items.push({ key, kind, scope, contentType });
  }

  items.sort((a, b) => a.key.localeCompare(b.key));

  return {
    eligibleImages,
    eligibleVideos,
    alreadyTargetFormat,
    skipped,
    items,
  };
}

export async function resolveEligibleCatalogItem(
  key: string,
  settings?: IMediaConverterSettings
): Promise<BulkCatalogItem | null> {
  const cfg = settings ?? (await getMediaConverterSettings());
  if (isExcludedKey(key)) return null;
  const scope = resolveScopeFromKey(key);
  if (!scope) return null;

  const meta = await headObject(key);
  const contentType = meta?.contentType ?? "application/octet-stream";
  const kind = inferUploadKind(contentType);
  if (!kind) return null;
  if (kind === "image" && isSkippableImageType(contentType)) return null;
  if (!scopeEnabledForBulk(cfg, scope, kind)) return null;
  if (kind === "image" && contentType === "image/webp") return null;
  if (kind === "video" && contentType === "video/webm") return null;

  return { key, kind, scope, contentType };
}

async function verifyConvertedObject(key: string, kind: BulkMediaKind): Promise<boolean> {
  const meta = await headObject(key);
  if (!meta?.contentLength || meta.contentLength <= 0) return false;
  const ct = meta.contentType ?? "";
  if (kind === "image") return ct === "image/webp";
  return ct === "video/webm";
}

export async function convertBulkItem(
  item: BulkCatalogItem,
  settings?: IMediaConverterSettings
): Promise<BulkConvertResultItem> {
  const cfg = settings ?? (await getMediaConverterSettings());
  const oldUrl = buildAssetUrl(item.key);
  const base: BulkConvertResultItem = {
    key: item.key,
    newKey: item.key,
    kind: item.kind,
    status: "skipped",
    oldUrl,
    newUrl: oldUrl,
    verified: false,
    documentsUpdated: 0,
  };

  if (!scopeEnabledForBulk(cfg, item.scope, item.kind)) {
    return { ...base, status: "skipped", error: "Scope disabled in settings" };
  }

  try {
    const downloadUrl = await getPresignedDownloadUrl(item.key);
    const res = await downloadAxios.get<ArrayBuffer>(downloadUrl, { responseType: "arraybuffer" });
    const bytes = new Uint8Array(res.data);

    const converted =
      item.kind === "image"
        ? await convertImageToWebp({
            key: item.key,
            bytes,
            contentType: item.contentType,
            settings: cfg.image,
          })
        : await convertVideoToWebm({
            key: item.key,
            bytes,
            contentType: item.contentType,
            settings: cfg.video,
          });

    if (!converted.converted) {
      return {
        ...base,
        status: "already_optimal",
        verified: await verifyConvertedObject(item.key, item.kind),
      };
    }

    await uploadFile(converted.key, converted.bytes, converted.contentType);
    const verified = await verifyConvertedObject(converted.key, item.kind);
    const newUrl = buildAssetUrl(converted.key);
    const { documentsUpdated } = await replaceStoredUrlsForKey(item.key, converted.key);

    return {
      key: item.key,
      newKey: converted.key,
      kind: item.kind,
      status: "converted",
      oldUrl,
      newUrl,
      originalKeyForDeletion: converted.key !== item.key ? item.key : undefined,
      verified,
      documentsUpdated,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Conversion failed";
    return { ...base, status: "failed", error: msg };
  }
}

export async function verifyBulkKeys(keys: string[]): Promise<BulkVerifyResultItem[]> {
  const results: BulkVerifyResultItem[] = [];
  for (const key of keys) {
    try {
      const meta = await headObject(key);
      if (!meta?.contentType || !meta.contentLength) {
        results.push({ key, ok: false, error: "Missing object or empty" });
        continue;
      }
      results.push({
        key,
        ok: true,
        contentType: meta.contentType,
        contentLength: meta.contentLength,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Head failed";
      results.push({ key, ok: false, error: msg });
    }
  }
  return results;
}

export async function deleteOriginalBulkKeys(keys: string[]): Promise<{ deleted: number; failed: string[] }> {
  const deduped = Array.from(new Set(keys.map((k) => k.replace(/^\/+/, "")))).filter(Boolean);
  let deleted = 0;
  const failed: string[] = [];
  for (const key of deduped) {
    try {
      await deleteAsset(key);
      deleted += 1;
    } catch {
      failed.push(key);
    }
  }
  return { deleted, failed };
}
