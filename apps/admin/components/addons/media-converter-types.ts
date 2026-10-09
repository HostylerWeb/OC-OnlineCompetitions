import type { MediaConverterScope } from "@oc/types";
import {
  DEFAULT_MEDIA_CONVERTER_SCOPES,
  DEFAULT_MEDIA_CONVERTER_SETTINGS,
  DEFAULT_MEDIA_CONVERTER_VIDEO_SCOPES,
} from "@oc/types";

export type { MediaConverterScope };

export const IMAGE_SCOPE_LABELS: Record<MediaConverterScope, string> = {
  media_library: "Media library uploads",
  competition_prizes: "Competition prize images",
  landing_videos: "Landing page frame strips (JPEG only today)",
  avatars: "Profile avatars",
  og_images: "Open Graph / SEO images",
};

export const VIDEO_SCOPE_LABELS: Record<MediaConverterScope, string> = {
  media_library: "Media library videos",
  competition_prizes: "Competition assets (if video)",
  landing_videos: "Competition landing page videos",
  avatars: "Profile avatars (not applicable)",
  og_images: "Social preview videos (if used)",
};

export interface ImageConverterUiState {
  enabled: boolean;
  outputWebp: boolean;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  scopes: Record<MediaConverterScope, boolean>;
}

export interface VideoConverterUiState {
  enabled: boolean;
  outputWebm: boolean;
  quality: number;
  maxWidth: number;
  preserveAudio: boolean;
  scopes: Record<MediaConverterScope, boolean>;
}

export const DEFAULT_IMAGE_CONVERTER: ImageConverterUiState = {
  enabled: DEFAULT_MEDIA_CONVERTER_SETTINGS.image.enabled,
  outputWebp: true,
  quality: DEFAULT_MEDIA_CONVERTER_SETTINGS.image.quality,
  maxWidth: DEFAULT_MEDIA_CONVERTER_SETTINGS.image.maxWidth,
  maxHeight: DEFAULT_MEDIA_CONVERTER_SETTINGS.image.maxHeight,
  scopes: { ...DEFAULT_MEDIA_CONVERTER_SCOPES, landing_videos: false },
};

export const DEFAULT_VIDEO_CONVERTER: VideoConverterUiState = {
  enabled: DEFAULT_MEDIA_CONVERTER_SETTINGS.video.enabled,
  outputWebm: true,
  quality: DEFAULT_MEDIA_CONVERTER_SETTINGS.video.quality,
  maxWidth: DEFAULT_MEDIA_CONVERTER_SETTINGS.video.maxWidth,
  preserveAudio: DEFAULT_MEDIA_CONVERTER_SETTINGS.video.preserveAudio,
  scopes: { ...DEFAULT_MEDIA_CONVERTER_VIDEO_SCOPES },
};

export function settingsToUiState(settings: {
  addonEnabled: boolean;
  image: Omit<ImageConverterUiState, "outputWebp">;
  video: Omit<VideoConverterUiState, "outputWebm">;
}): {
  addonEnabled: boolean;
  image: ImageConverterUiState;
  video: VideoConverterUiState;
} {
  return {
    addonEnabled: settings.addonEnabled,
    image: { ...settings.image, outputWebp: true },
    video: { ...settings.video, outputWebm: true },
  };
}

export function uiStateToSavePayload(state: {
  addonEnabled: boolean;
  image: ImageConverterUiState;
  video: VideoConverterUiState;
}) {
  return {
    addonEnabled: state.addonEnabled,
    image: {
      enabled: state.image.enabled,
      quality: state.image.quality,
      maxWidth: state.image.maxWidth,
      maxHeight: state.image.maxHeight,
      scopes: state.image.scopes,
    },
    video: {
      enabled: state.video.enabled,
      quality: state.video.quality,
      maxWidth: state.video.maxWidth,
      preserveAudio: state.video.preserveAudio,
      scopes: state.video.scopes,
    },
  };
}
