import type { MediaConverterImageSettings } from "@oc/types";
import sharp from "sharp";
import { replaceKeyExtension } from "./scope";

export interface ConvertImageResult {
  bytes: Uint8Array;
  contentType: "image/webp";
  key: string;
  converted: boolean;
}

export async function convertImageToWebp(
  input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
    settings: MediaConverterImageSettings;
  }
): Promise<ConvertImageResult> {
  const { key, bytes, contentType, settings } = input;
  const passthrough = {
    bytes,
    contentType: contentType as ConvertImageResult["contentType"] | string,
    key,
    converted: false,
  };

  if (contentType === "image/webp") {
    const pipeline = sharp(bytes).rotate().resize(settings.maxWidth, settings.maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });
    const out = await pipeline.webp({ quality: settings.quality }).toBuffer();
    if (out.length >= bytes.length) {
      return { ...passthrough, contentType: "image/webp" };
    }
    return {
      bytes: new Uint8Array(out),
      contentType: "image/webp",
      key,
      converted: true,
    };
  }

  const pipeline = sharp(bytes)
    .rotate()
    .resize(settings.maxWidth, settings.maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: settings.quality });

  const out = await pipeline.toBuffer();
  return {
    bytes: new Uint8Array(out),
    contentType: "image/webp",
    key: replaceKeyExtension(key, "webp"),
    converted: true,
  };
}
