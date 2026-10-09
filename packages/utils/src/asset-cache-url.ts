const VERSIONED_ASSET_KEY_PATTERN = /\/(\d{13})-[a-z0-9]+\.(?:webp|jpe?g|png|gif|bin)/i;

const THIRD_PARTY_IMAGE_HOSTS =
  /^(?:lh\d+\.)?googleusercontent\.com$|^graph\.facebook\.com$|^platform-lookaside\.fbsbx\.com$/i;

export function assetCacheVersion(source?: string | number | Date | null): string | undefined {
  if (source == null) return undefined;
  if (source instanceof Date) return String(source.getTime());
  if (typeof source === "number" && Number.isFinite(source)) return String(source);
  const trimmed = String(source).trim();
  if (!trimmed) return undefined;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? String(parsed) : undefined;
}

function extractVersionFromAssetUrl(url: string): string | undefined {
  const match = url.match(VERSIONED_ASSET_KEY_PATTERN);
  return match?.[1];
}

function shouldVersionAssetUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    if (THIRD_PARTY_IMAGE_HOSTS.test(hostname)) return false;
  } catch {
    return true;
  }
  return true;
}

function appendCacheVersionParam(url: string, version: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("v") === version) return url;
    parsed.searchParams.set("v", version);
    return parsed.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(version)}`;
  }
}

/**
 * Stable cache key for Online Competitions-hosted assets: same `?v=` until `version` (e.g. competition updatedAt) changes.
 * Versioned S3 keys (avatars/{id}/{timestamp}-…) infer `v` from the path when no version is passed.
 * Third-party avatar URLs (Google, etc.) are returned unchanged.
 */
export function withAssetCacheVersion(
  url: string | null | undefined,
  version?: string | number | Date | null
): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (!shouldVersionAssetUrl(trimmed)) return trimmed;

  const explicit = assetCacheVersion(version);
  if (!explicit) {
    try {
      if (new URL(trimmed).searchParams.get("v")) return trimmed;
    } catch {
      if (/[?&]v=/.test(trimmed)) return trimmed;
    }
  }
  const resolved = explicit ?? extractVersionFromAssetUrl(trimmed);
  if (!resolved) return trimmed;

  return appendCacheVersionParam(trimmed, resolved);
}

type CompetitionImageFields = {
  prizeImageUrl?: string | null;
  imageUrl?: string | null;
  updatedAt?: string | null;
};

export function getCompetitionImageUrl(comp: CompetitionImageFields): string | undefined {
  const raw = comp.prizeImageUrl?.trim() || comp.imageUrl?.trim();
  return withAssetCacheVersion(raw, comp.updatedAt ?? undefined);
}
