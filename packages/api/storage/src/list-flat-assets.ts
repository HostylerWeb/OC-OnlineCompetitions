import { buildAssetUrl, listFlatObjectKeysPage, type S3Asset } from "./s3";

const FRAME_PREFIX = "frames/";
const FLAT_ROOTS = ["uploads/", "prizes/", "landing-videos/", "avatars/", "og-images/"] as const;

export interface FlatAssetsCursor {
  rootIndex: number;
  continuationToken?: string;
  /** Last object key returned; skip through this on the next page (same S3 list batch). */
  lastKey?: string;
}

function encodeFlatCursor(cursor: FlatAssetsCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeFlatCursor(raw: string | undefined): FlatAssetsCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as FlatAssetsCursor;
    if (typeof parsed.rootIndex !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function isFrameKey(key: string): boolean {
  return key.startsWith(FRAME_PREFIX) || key.includes("/frames/");
}

function assetFromKey(key: string, size: number, lastModified?: Date): S3Asset {
  return {
    key,
    size,
    lastModified: lastModified ?? new Date(0),
    url: buildAssetUrl(key),
  };
}

function matchesSearch(key: string, search?: string): boolean {
  if (!search) return true;
  return key.toLowerCase().includes(search.toLowerCase());
}

function isListableFile(key: string, size: number): boolean {
  return size > 0 && !key.endsWith("/") && !isFrameKey(key);
}

export async function listFlatAssetsPage(
  limit: number,
  cursorToken?: string,
  search?: string
): Promise<{ assets: S3Asset[]; nextCursor: string | undefined }> {
  const state: FlatAssetsCursor = decodeFlatCursor(cursorToken) ?? {
    rootIndex: 0,
  };

  const collected: S3Asset[] = [];

  while (collected.length < limit && state.rootIndex < FLAT_ROOTS.length) {
    const prefix = FLAT_ROOTS[state.rootIndex]!;
    const page = await listFlatObjectKeysPage(prefix, 1000, state.continuationToken);
    const objects = page.objects.filter((obj) => isListableFile(obj.key, obj.size));

    let advancedPastLastKey = !state.lastKey;

    for (const obj of objects) {
      const key = obj.key;
      if (!advancedPastLastKey) {
        if (key === state.lastKey) {
          advancedPastLastKey = true;
        }
        continue;
      }
      if (!matchesSearch(key, search)) continue;

      collected.push(assetFromKey(key, obj.size, obj.lastModified));
      state.lastKey = key;

      if (collected.length >= limit) break;
    }

    if (collected.length >= limit) {
      const hasMoreInBatch =
        advancedPastLastKey &&
        objects.some((obj) => {
          const key = obj.key;
          if (!matchesSearch(key, search)) return false;
          return state.lastKey ? key > state.lastKey : true;
        });

      if (hasMoreInBatch) {
        break;
      }

      if (page.nextCursor) {
        state.continuationToken = page.nextCursor;
        state.lastKey = undefined;
        break;
      }

      state.rootIndex += 1;
      state.continuationToken = undefined;
      state.lastKey = undefined;
      continue;
    }

    if (page.nextCursor) {
      state.continuationToken = page.nextCursor;
      state.lastKey = undefined;
      continue;
    }

    state.rootIndex += 1;
    state.continuationToken = undefined;
    state.lastKey = undefined;
  }

  const exhausted =
    state.rootIndex >= FLAT_ROOTS.length && !state.continuationToken && collected.length < limit;

  const nextCursor =
    exhausted || (collected.length === 0 && state.rootIndex >= FLAT_ROOTS.length)
      ? undefined
      : encodeFlatCursor(state);

  return { assets: collected.slice(0, limit), nextCursor };
}
