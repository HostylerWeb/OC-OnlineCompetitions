import {
  DEFAULT_MEDIA_CONVERTER_SETTINGS,
  MediaConverterSettings,
  type IMediaConverterSettings,
} from "@oc/api-db/models/MediaConverterSettings";
import dbConnect from "@oc/api-infra/db";

let cached: { at: number; value: IMediaConverterSettings } | null = null;
const CACHE_TTL_MS = 5_000;

function mergeSettings(raw: IMediaConverterSettings | null): IMediaConverterSettings {
  if (!raw) return DEFAULT_MEDIA_CONVERTER_SETTINGS;
  return {
    ...DEFAULT_MEDIA_CONVERTER_SETTINGS,
    ...raw,
    image: {
      ...DEFAULT_MEDIA_CONVERTER_SETTINGS.image,
      ...raw.image,
      scopes: {
        ...DEFAULT_MEDIA_CONVERTER_SETTINGS.image.scopes,
        ...raw.image?.scopes,
      },
    },
    video: {
      ...DEFAULT_MEDIA_CONVERTER_SETTINGS.video,
      ...raw.video,
      scopes: {
        ...DEFAULT_MEDIA_CONVERTER_SETTINGS.video.scopes,
        ...raw.video?.scopes,
      },
    },
  };
}

export function invalidateMediaConverterSettingsCache(): void {
  cached = null;
}

export async function ensureMediaConverterSettings(): Promise<IMediaConverterSettings> {
  await dbConnect();
  const result = (await MediaConverterSettings.findOneAndUpdate(
    { _id: "media_converter_settings" },
    { $setOnInsert: { ...DEFAULT_MEDIA_CONVERTER_SETTINGS } },
    { upsert: true, new: true, includeResultMetadata: true }
  )) as unknown as {
    value: IMediaConverterSettings | null;
    lastErrorObject?: { upserted?: unknown };
  };

  if (result?.lastErrorObject?.upserted) {
    console.log("[MEDIA-CONVERTER-AUTOSEED] settings document created with defaults");
  }

  invalidateMediaConverterSettingsCache();
  const merged = mergeSettings(result?.value ?? null);
  cached = { at: Date.now(), value: merged };
  return merged;
}

export async function getMediaConverterSettings(): Promise<IMediaConverterSettings> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  await dbConnect();
  const doc = await MediaConverterSettings.findById("media_converter_settings").lean();
  if (!doc) {
    return ensureMediaConverterSettings();
  }

  const merged = mergeSettings(doc as IMediaConverterSettings);
  cached = { at: now, value: merged };
  return merged;
}
