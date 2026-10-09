import type { IMediaConverterSettings } from "@oc/api-db/models/MediaConverterSettings";
import { createExternalAxios } from "@oc/api-axios";
import { deleteAsset, getPresignedDownloadUrl, headObject, uploadFile } from "@oc/api-storage/s3";
import { convertImageToWebp } from "./convert-image";
import { convertVideoToWebm } from "./convert-video";
import {
  inferUploadKind,
  isSkippableImageType,
  resolveScopeFromKey,
} from "./scope";
import { getMediaConverterSettings } from "./settings";

const downloadAxios = createExternalAxios({ baseURL: "", timeout: 600_000 });

export interface TransformUploadInput {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  settings?: IMediaConverterSettings;
}

export interface TransformUploadResult {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  converted: boolean;
}

function scopeEnabled(
  settings: IMediaConverterSettings,
  scope: NonNullable<ReturnType<typeof resolveScopeFromKey>>,
  kind: "image" | "video"
): boolean {
  if (!settings.addonEnabled) return false;
  if (kind === "image") {
    return settings.image.enabled && settings.image.scopes[scope] === true;
  }
  return settings.video.enabled && settings.video.scopes[scope] === true;
}

export async function transformUploadBytes(
  input: TransformUploadInput
): Promise<TransformUploadResult> {
  const settings = input.settings ?? (await getMediaConverterSettings());
  const scope = resolveScopeFromKey(input.key);
  const kind = inferUploadKind(input.contentType);

  if (!scope || !kind) {
    return { ...input, converted: false };
  }

  if (!scopeEnabled(settings, scope, kind)) {
    return { ...input, converted: false };
  }

  if (kind === "image") {
    if (isSkippableImageType(input.contentType)) {
      return { ...input, converted: false };
    }
    try {
      const result = await convertImageToWebp({
        key: input.key,
        bytes: input.bytes,
        contentType: input.contentType,
        settings: settings.image,
      });
      return {
        key: result.key,
        bytes: result.bytes,
        contentType: result.contentType,
        converted: result.converted,
      };
    } catch (err) {
      console.error("[media-converter] image conversion failed:", err);
      return { ...input, converted: false };
    }
  }

  try {
    const result = await convertVideoToWebm({
      key: input.key,
      bytes: input.bytes,
      contentType: input.contentType,
      settings: settings.video,
    });
    return {
      key: result.key,
      bytes: result.bytes,
      contentType: result.contentType,
      converted: result.converted,
    };
  } catch (err) {
    console.error("[media-converter] video conversion failed:", err);
    return { ...input, converted: false };
  }
}

export async function normalizeObjectAtKey(
  key: string,
  settings?: IMediaConverterSettings
): Promise<{ key: string; contentType: string; converted: boolean }> {
  const meta = await headObject(key);
  if (!meta?.contentType) {
    return { key, contentType: "application/octet-stream", converted: false };
  }

  const downloadUrl = await getPresignedDownloadUrl(key);
  const res = await downloadAxios.get<ArrayBuffer>(downloadUrl, { responseType: "arraybuffer" });
  const bytes = new Uint8Array(res.data);

  const transformed = await transformUploadBytes({
    key,
    bytes,
    contentType: meta.contentType,
    settings,
  });

  if (!transformed.converted) {
    return { key, contentType: meta.contentType, converted: false };
  }

  await uploadFile(transformed.key, transformed.bytes, transformed.contentType);
  if (transformed.key !== key) {
    await deleteAsset(key).catch((err) => console.error("[media-converter] delete old key:", err));
  }

  return {
    key: transformed.key,
    contentType: transformed.contentType,
    converted: true,
  };
}
