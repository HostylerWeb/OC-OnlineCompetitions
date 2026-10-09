import { getEnv } from "@oc/env/server";
import { S3mini } from "s3mini";

function hasCustomEndpoint(): boolean {
  return Boolean(getEnv("S3_ENDPOINT"));
}

export interface S3Asset {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
}

function buildEndpoint(): string {
  if (hasCustomEndpoint()) {
    const base = getEnv("S3_ENDPOINT").replace(/\/$/, "");
    const bucket = getEnv("S3_BUCKET");
    if (bucket) {
      try {
        const u = new URL(base);
        const firstSegment = u.pathname.split("/").find(Boolean);
        if (firstSegment !== bucket) {
          u.pathname = `${u.pathname === "/" ? "" : u.pathname}/${bucket}`;
          return u.toString().replace(/\/$/, "");
        }
      } catch {
        return base;
      }
    }
    return base;
  }
  const bucket = getEnv("S3_BUCKET");
  const region = getEnv("AWS_REGION");
  if (bucket && region) {
    return `https://${bucket}.s3.${region}.amazonaws.com`;
  }
  return "";
}

const _s3Config = {
  accessKeyId: getEnv("S3_ACCESS_KEY_ID") || getEnv("AWS_ACCESS_KEY_ID") || "",
  secretAccessKey: getEnv("S3_SECRET_ACCESS_KEY") || getEnv("AWS_SECRET_ACCESS_KEY") || "",
  endpoint: buildEndpoint(),
  region: getEnv("AWS_REGION") || "auto",
} as const;

function getS3mini(): S3mini {
  return new S3mini(_s3Config);
}

export function getAssetBaseUrl(): string {
  const assetBaseUrl = getEnv("ASSET_BASE_URL");
  if (assetBaseUrl) return assetBaseUrl.replace(/\/$/, "");

  if (hasCustomEndpoint()) {
    const endpoint = getEnv("S3_ENDPOINT").replace(/\/$/, "");
    const bucket = getEnv("S3_BUCKET");
    if (bucket && !new URL(endpoint).pathname.split("/").find((s) => s)) {
      return `${endpoint}/${bucket}`;
    }
    return endpoint;
  }

  const bucket = getEnv("S3_BUCKET");
  const region = getEnv("AWS_REGION");
  if (bucket && region) {
    return `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  throw new Error("No asset base URL configured: set ASSET_BASE_URL or S3_ENDPOINT or S3_BUCKET");
}

export function buildAssetUrl(key: string): string {
  const normalizedKey = key.replace(/^\/+/, "");
  return `${getAssetBaseUrl()}/${normalizedKey}`;
}

export const getPublicUrl = buildAssetUrl;

/** Versioned public keys (avatars, media) — safe to cache for a year in browsers and CDNs. */
export const S3_PUBLIC_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function extractKeyFromUrl(url: string): string {
  const prefix = `${getAssetBaseUrl()}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : url;
}

export async function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  const s3 = getS3mini();
  return s3.getPresignedUrl("PUT", key, 300, {}, { "content-type": contentType });
}

export type S3Metadata = Record<`x-amz-meta-${string}`, string>;

export interface ObjectMetadata {
  contentType?: string;
  contentLength?: number;
  lastModified?: string;
  etag?: string;
  metadata: S3Metadata;
}

export async function uploadFile(
  key: string,
  body: Uint8Array | Blob,
  contentType: string,
  extraHeaders?: Record<string, string>
): Promise<void> {
  const size = body instanceof Blob ? body.size : body.byteLength;
  const endpoint = buildEndpoint();
  console.log(
    `[s3.uploadFile] start key=${key} type=${contentType} size=${size} endpoint=${endpoint} extraHeaders=${extraHeaders ? Object.keys(extraHeaders).length : 0}`
  );
  const s3 = getS3mini();
  const data = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : body;
  try {
    const awsHeaders: Record<string, string> = {
      "cache-control": S3_PUBLIC_IMMUTABLE_CACHE_CONTROL,
    };
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        if (typeof v === "string") awsHeaders[k.toLowerCase()] = v;
      }
    }
    await s3.putObject(key, data, contentType, undefined, awsHeaders);
    console.log(`[s3.uploadFile] success key=${key} size=${size}`);
  } catch (err) {
    console.error(`[s3.uploadFile] error key=${key} size=${size} type=${contentType}:`, err);
    throw err;
  }
}

const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const S3_SERVICE = "s3";
const AWS_REQUEST_TYPE = "aws4_request";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

function encoder(): InstanceType<typeof TextEncoder> {
  return new TextEncoder();
}

async function sha256Hex(content: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", encoder().encode(content));
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

async function hmacRaw(key: ArrayBuffer | string, content: string): Promise<ArrayBuffer> {
  const keyData = typeof key === "string" ? encoder().encode(key) : new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder().encode(content));
}

async function getSigningKey(
  secretAccessKey: string,
  shortDate: string,
  region: string
): Promise<ArrayBuffer> {
  const kDate = await hmacRaw(`AWS4${secretAccessKey}`, shortDate);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, S3_SERVICE);
  return hmacRaw(kService, AWS_REQUEST_TYPE);
}

function uriResourceEscape(s: string): string {
  return encodeURIComponent(s).replace(/%2F/g, "/");
}

function canonicalQueryString(query: Record<string, string>): string {
  const keys = Object.keys(query).sort();
  return keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k]!)}`).join("&");
}

async function signedRequestHead(
  endpoint: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<{ url: string; headers: Record<string, string> }> {
  const url = new URL(endpoint);
  const encodedKey = key ? uriResourceEscape(key) : "";
  if (encodedKey) {
    url.pathname =
      url.pathname === "/" || url.pathname === ""
        ? `/${encodedKey.replace(/^\/+/, "")}`
        : `${url.pathname}/${encodedKey.replace(/^\/+/, "")}`;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const shortDate = `${year}${month}${day}`;
  const amzDate = `${shortDate}T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;
  const credentialScope = `${shortDate}/${region}/${S3_SERVICE}/${AWS_REQUEST_TYPE}`;

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": UNSIGNED_PAYLOAD,
    "x-amz-date": amzDate,
  };

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]!.trim()}`).join("\n");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    "HEAD",
    url.pathname,
    canonicalQueryString({}),
    canonicalHeaders,
    "",
    signedHeaders,
    UNSIGNED_PAYLOAD,
  ].join("\n");

  const stringToSign = [
    AWS_ALGORITHM,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSigningKey(secretAccessKey, shortDate, region);
  const sigBuf = await hmacRaw(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  headers.authorization = `${AWS_ALGORITHM} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: url.toString(), headers };
}

export async function headObject(key: string): Promise<ObjectMetadata | null> {
  const accessKeyId = getEnv("S3_ACCESS_KEY_ID") || getEnv("AWS_ACCESS_KEY_ID") || "";
  const secretAccessKey = getEnv("S3_SECRET_ACCESS_KEY") || getEnv("AWS_SECRET_ACCESS_KEY") || "";
  const region = getEnv("AWS_REGION") || "auto";
  const endpoint = buildEndpoint();
  if (!endpoint) {
    throw new Error("[s3.headObject] No endpoint configured");
  }

  const { url, headers } = await signedRequestHead(
    endpoint,
    key,
    accessKeyId,
    secretAccessKey,
    region
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(url, { method: "HEAD", headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[s3.headObject] network error key=${key}:`, err);
    return null;
  }
  clearTimeout(timeout);

  if (res.status === 404) return null;
  if (!res.ok && res.status !== 403) return null;

  const metadata: S3Metadata = {};
  res.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (lower.startsWith("x-amz-meta-")) {
      metadata[lower as `x-amz-meta-${string}`] = value;
    }
  });

  const contentLengthStr = res.headers.get("content-length");
  const contentLength = contentLengthStr ? Number.parseInt(contentLengthStr, 10) : NaN;

  return {
    contentType: res.headers.get("content-type") ?? undefined,
    contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
    lastModified: res.headers.get("last-modified") ?? undefined,
    etag: res.headers.get("etag") ?? undefined,
    metadata,
  };
}

export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const s3 = getS3mini();
  return s3.getPresignedUrl("GET", key, 300);
}

export async function listStorageDelimiterPage(
  prefix: string,
  limit: number,
  cursor?: string
): Promise<{ files: { key: string; size: number; lastModified: Date }[]; folders: string[]; nextCursor: string | undefined }> {
  const s3 = getS3mini();
  const result = await s3.listObjectsPaged("/", prefix, limit, cursor, { delimiter: "/" });
  const files: { key: string; size: number; lastModified: Date }[] = [];
  const folders: string[] = [];
  for (const obj of result?.objects ?? []) {
    if (!obj.Key) continue;
    if (obj.Key.endsWith("/") || obj.Size === 0) folders.push(obj.Key);
    else files.push({ key: obj.Key, size: obj.Size || 0, lastModified: obj.LastModified });
  }
  return { files, folders, nextCursor: result?.nextContinuationToken };
}

export async function listObjectKeysPage(
  prefix: string,
  limit: number,
  cursor?: string
): Promise<{ keys: { key: string; size: number }[]; nextCursor: string | undefined }> {
  const s3 = getS3mini();
  const result = await s3.listObjectsPaged("/", prefix, limit, cursor, { delimiter: "/" });
  const keys = (result?.objects ?? [])
    .filter((obj) => obj.Key && obj.Size > 0 && !obj.Key.endsWith("/"))
    .map((obj) => ({ key: obj.Key, size: obj.Size || 0 }));
  return { keys, nextCursor: result?.nextContinuationToken };
}

export async function listFolderPrefixesPage(
  prefix: string,
  limit: number,
  cursor?: string
): Promise<{ prefixes: string[]; nextCursor: string | undefined }> {
  const s3 = getS3mini();
  const result = await s3.listObjectsPaged("/", prefix, limit, cursor, { delimiter: "/" });
  const prefixes: string[] = [];
  for (const obj of result?.objects ?? []) {
    if (obj.Key.endsWith("/") || obj.Size === 0) {
      prefixes.push(obj.Key);
    }
  }
  return { prefixes, nextCursor: result?.nextContinuationToken };
}

export async function listAssets(
  prefix: string,
  limit: number,
  cursor?: string,
  search?: string
): Promise<{ assets: S3Asset[]; nextCursor: string | undefined }> {
  const s3 = getS3mini();
  const result = await s3.listObjectsPaged("/", prefix, limit, cursor, { delimiter: "/" });

  let assets: S3Asset[] = (result?.objects || []).map((obj) => ({
    key: obj.Key,
    size: obj.Size || 0,
    lastModified: obj.LastModified,
    url: buildAssetUrl(obj.Key),
  }));

  if (search) {
    const q = search.toLowerCase();
    assets = assets.filter((a) => a.key.toLowerCase().includes(q));
  }

  return { assets, nextCursor: result?.nextContinuationToken };
}

export async function deleteAsset(key: string): Promise<void> {
  console.log(`[s3.deleteAsset] start key=${key}`);
  const s3 = getS3mini();
  try {
    await s3.deleteObject(key);
    console.log(`[s3.deleteAsset] success key=${key}`);
  } catch (err) {
    console.error(`[s3.deleteAsset] error key=${key}:`, err);
    throw err;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  console.log(`[s3.deleteObjects] start keys=${JSON.stringify(keys)}`);
  const s3 = getS3mini();
  try {
    await Promise.all(keys.map((key) => s3.deleteObject(key)));
    console.log(`[s3.deleteObjects] success count=${keys.length}`);
  } catch (err) {
    console.error(`[s3.deleteObjects] error keys=${JSON.stringify(keys)}:`, err);
    throw err;
  }
}

export function resetS3ClientForTests(): void {
  void _s3Config;
}
