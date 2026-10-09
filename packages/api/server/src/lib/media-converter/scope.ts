import type { MediaConverterScope } from "@oc/types";

export function resolveScopeFromKey(key: string): MediaConverterScope | null {
  const normalized = key.replace(/^\/+/, "");
  if (normalized.startsWith("uploads/")) return "media_library";
  if (normalized.startsWith("prizes/")) return "competition_prizes";
  if (normalized.startsWith("landing-videos/")) return "landing_videos";
  if (normalized.startsWith("avatars/")) return "avatars";
  if (normalized.startsWith("og-images/")) return "og_images";
  return null;
}

export function replaceKeyExtension(key: string, newExt: string): string {
  const ext = newExt.startsWith(".") ? newExt : `.${newExt}`;
  const lastSlash = key.lastIndexOf("/");
  const base = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
  const dir = lastSlash >= 0 ? key.slice(0, lastSlash + 1) : "";
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${dir}${stem}${ext}`;
}

export function inferUploadKind(contentType: string): "image" | "video" | null {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return null;
}

export function isSkippableImageType(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return lower === "image/svg+xml" || lower === "image/gif";
}
