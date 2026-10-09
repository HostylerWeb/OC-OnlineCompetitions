import { Schema } from "mongoose";
import {
  DEFAULT_MEDIA_CONVERTER_SETTINGS,
  type MediaConverterScopeMap,
  type MediaConverterSettings,
} from "@oc/types";
import { m } from "../db";

const ScopeMapSchema = new Schema<MediaConverterScopeMap>(
  {
    media_library: { type: Boolean, default: true },
    competition_prizes: { type: Boolean, default: true },
    landing_videos: { type: Boolean, default: false },
    avatars: { type: Boolean, default: true },
    og_images: { type: Boolean, default: true },
  },
  { _id: false }
);

const ImageSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    quality: { type: Number, default: 82, min: 1, max: 100 },
    maxWidth: { type: Number, default: 2560, min: 320, max: 8192 },
    maxHeight: { type: Number, default: 2560, min: 320, max: 8192 },
    scopes: { type: ScopeMapSchema, default: () => ({}) },
  },
  { _id: false }
);

const VideoSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    quality: { type: Number, default: 75, min: 1, max: 100 },
    maxWidth: { type: Number, default: 1920, min: 480, max: 3840 },
    preserveAudio: { type: Boolean, default: true },
    scopes: { type: ScopeMapSchema, default: () => ({}) },
  },
  { _id: false }
);

const MediaConverterSettingsSchema = new Schema(
  {
    _id: { type: String, required: true, enum: ["media_converter_settings"] },
    addonEnabled: { type: Boolean, default: false },
    image: { type: ImageSettingsSchema, default: () => ({}) },
    video: { type: VideoSettingsSchema, default: () => ({}) },
  },
  { timestamps: true, _id: false }
);

export type IMediaConverterSettings = MediaConverterSettings;

export { DEFAULT_MEDIA_CONVERTER_SETTINGS };

export const MediaConverterSettings = m<IMediaConverterSettings>(
  "MediaConverterSettings",
  MediaConverterSettingsSchema
);
