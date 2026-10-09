import { convertImageToWebp } from "@oc/api-server/lib/media-converter/convert-image";
import { replaceKeyExtension } from "@oc/api-server/lib/media-converter/scope";
import { DEFAULT_MEDIA_CONVERTER_SETTINGS } from "@oc/types";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_DIMENSION = 512;
export const AVATAR_WEBP_QUALITY = 85;

export const AVATAR_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const AVATAR_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export class AvatarUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarUploadValidationError";
  }
}

export function isAvatarUploadValidationError(err: unknown): err is AvatarUploadValidationError {
  return (
    err instanceof AvatarUploadValidationError ||
    (err instanceof Error && err.name === "AvatarUploadValidationError")
  );
}

export type DetectedAvatarFormat = "jpeg" | "png" | "webp";

function mimeForFormat(format: DetectedAvatarFormat): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
}

export function normalizeAvatarMime(mime: string): string {
  const lower = mime.trim().toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  return lower;
}

export function validateAvatarFileMeta(file: File): void {
  if (!file || typeof file.name !== "string") {
    throw new AvatarUploadValidationError("Invalid upload");
  }

  if (file.name.includes("\0") || file.name.includes("/") || file.name.includes("\\")) {
    throw new AvatarUploadValidationError("Invalid file name");
  }

  if (file.size <= 0) {
    throw new AvatarUploadValidationError("Empty file");
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw new AvatarUploadValidationError("File too large. Max 2MB.");
  }

  const mime = normalizeAvatarMime(file.type || "");
  if (!AVATAR_ALLOWED_MIME.has(mime)) {
    throw new AvatarUploadValidationError("Only JPEG, PNG, and WebP images are allowed");
  }

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/\0.*$/, "");
  if (!ext || !AVATAR_ALLOWED_EXTENSIONS.has(ext)) {
    throw new AvatarUploadValidationError("Only JPEG, PNG, and WebP images are allowed");
  }
}

export function detectAvatarFormat(bytes: Uint8Array): DetectedAvatarFormat | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

export function assertAvatarBytesMatchMime(bytes: Uint8Array, declaredMime: string): DetectedAvatarFormat {
  const detected = detectAvatarFormat(bytes);
  if (!detected) {
    throw new AvatarUploadValidationError("Unrecognized or unsupported image data");
  }

  const normalized = normalizeAvatarMime(declaredMime);
  const expected = mimeForFormat(detected);
  if (normalized !== expected) {
    throw new AvatarUploadValidationError("File content does not match its type");
  }

  return detected;
}

export interface ProcessedAvatarUpload {
  key: string;
  bytes: Uint8Array;
  contentType: "image/webp";
}

export async function processAvatarUploadBytes(
  userId: string,
  bytes: Uint8Array,
  declaredMime: string
): Promise<ProcessedAvatarUpload> {
  assertAvatarBytesMatchMime(bytes, declaredMime);

  const random = Math.random().toString(36).slice(2);
  const stemKey = `avatars/${userId}/${Date.now()}-${random}.bin`;

  let result: Awaited<ReturnType<typeof convertImageToWebp>>;
  try {
    result = await convertImageToWebp({
      key: stemKey,
      bytes,
      contentType: normalizeAvatarMime(declaredMime),
      settings: {
        ...DEFAULT_MEDIA_CONVERTER_SETTINGS.image,
        enabled: true,
        quality: AVATAR_WEBP_QUALITY,
        maxWidth: AVATAR_MAX_DIMENSION,
        maxHeight: AVATAR_MAX_DIMENSION,
      },
    });
  } catch {
    throw new AvatarUploadValidationError("Could not process image. Use a valid JPEG, PNG, or WebP file.");
  }

  if (result.contentType !== "image/webp" || result.bytes.length === 0) {
    throw new AvatarUploadValidationError("Could not convert image to a safe format");
  }

  const key = result.key.endsWith(".webp") ? result.key : replaceKeyExtension(result.key, "webp");

  return {
    key,
    bytes: result.bytes,
    contentType: "image/webp",
  };
}
