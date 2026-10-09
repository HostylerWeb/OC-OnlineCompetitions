import {
  Competition,
  InstantPrize,
  Profile,
  SeoSettings,
  ShopProduct,
  ShopProductVariant,
  Winner,
} from "@oc/api-db/models";
import { buildAssetUrl, extractKeyFromUrl } from "@oc/api-storage/s3";

function keyFromStoredUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/+/, "");
      const bucketMarker = "onlinecompetitions-assets/";
      const markerIdx = path.indexOf(bucketMarker);
      if (markerIdx >= 0) {
        return path.slice(markerIdx + bucketMarker.length);
      }
      return extractKeyFromUrl(url);
    }
    return url.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function mapArrayUrls(values: string[] | undefined, targetKey: string, newUrl: string): string[] | null {
  if (!Array.isArray(values)) return null;
  let changed = false;
  const next = values.map((u) => {
    if (keyFromStoredUrl(u) === targetKey) {
      changed = true;
      return newUrl;
    }
    return u;
  });
  return changed ? next : null;
}

export async function replaceStoredUrlsForKey(
  originalKey: string,
  newKey: string
): Promise<{ documentsUpdated: number }> {
  const normalizedOriginal = originalKey.replace(/^\/+/, "");
  const newUrl = buildAssetUrl(newKey);
  let documentsUpdated = 0;

  const competitions = await Competition.find({})
    .select(
      "_id imageUrl heroImageUrl prizeImageUrl ogImageUrl refOgImageUrl landingPageVideoUrl prizeImages prizeImagesSource prizeImagesRemote"
    )
    .lean();

  for (const doc of competitions) {
    const row = doc as Record<string, unknown> & { _id: unknown };
    const updates: Record<string, unknown> = {};
    for (const field of [
      "imageUrl",
      "heroImageUrl",
      "prizeImageUrl",
      "ogImageUrl",
      "refOgImageUrl",
      "landingPageVideoUrl",
    ] as const) {
      const current = row[field];
      if (typeof current === "string" && keyFromStoredUrl(current) === normalizedOriginal) {
        updates[field] = newUrl;
      }
    }
    const prizeImages = mapArrayUrls(row.prizeImages as string[] | undefined, normalizedOriginal, newUrl);
    if (prizeImages) updates.prizeImages = prizeImages;
    if (
      typeof row.prizeImagesSource === "string" &&
      keyFromStoredUrl(row.prizeImagesSource) === normalizedOriginal
    ) {
      updates.prizeImagesSource = newUrl;
    }
    const prizeImagesRemote = mapArrayUrls(
      row.prizeImagesRemote as string[] | undefined,
      normalizedOriginal,
      newUrl
    );
    if (prizeImagesRemote) updates.prizeImagesRemote = prizeImagesRemote;

    if (Object.keys(updates).length > 0) {
      await Competition.updateOne({ _id: row._id }, { $set: updates });
      documentsUpdated += 1;
    }
  }

  const instantPrizes = await InstantPrize.find({}).select("_id images").lean();
  for (const doc of instantPrizes) {
    const row = doc as { _id: { toString(): string }; images?: string[] };
    const images = mapArrayUrls(row.images, normalizedOriginal, newUrl);
    if (images) {
      await InstantPrize.updateOne({ _id: row._id }, { $set: { images } });
      documentsUpdated += 1;
    }
  }

  const winners = await Winner.find({ prizeImageUrl: { $exists: true, $ne: null } }).select("_id prizeImageUrl").lean();
  for (const w of winners) {
    const row = w as { _id: unknown; prizeImageUrl?: string };
    if (typeof row.prizeImageUrl === "string" && keyFromStoredUrl(row.prizeImageUrl) === normalizedOriginal) {
      await Winner.updateOne({ _id: row._id }, { $set: { prizeImageUrl: newUrl } });
      documentsUpdated += 1;
    }
  }

  const profiles = await Profile.find({ avatarUrl: { $exists: true, $ne: null } }).select("_id avatarUrl").lean();
  for (const p of profiles) {
    const row = p as { _id: unknown; avatarUrl?: string };
    if (typeof row.avatarUrl === "string" && keyFromStoredUrl(row.avatarUrl) === normalizedOriginal) {
      await Profile.updateOne({ _id: row._id }, { $set: { avatarUrl: newUrl } });
      documentsUpdated += 1;
    }
  }

  for (const field of ["defaultOgImageUrl", "referralOgImageUrl"] as const) {
    const seo = await SeoSettings.findOne({}).select(field).lean();
    if (seo && typeof (seo as Record<string, string>)[field] === "string") {
      const val = (seo as Record<string, string>)[field];
      if (keyFromStoredUrl(val) === normalizedOriginal) {
        await SeoSettings.updateOne({}, { $set: { [field]: newUrl } });
        documentsUpdated += 1;
      }
    }
  }

  for (const Model of [ShopProduct, ShopProductVariant]) {
    const products = await Model.find({}).select("_id images").lean();
    for (const doc of products) {
      const row = doc as { _id: unknown; images?: string[] };
      const images = mapArrayUrls(row.images, normalizedOriginal, newUrl);
      if (images) {
        await Model.updateOne({ _id: row._id }, { $set: { images } });
        documentsUpdated += 1;
      }
    }
  }

  return { documentsUpdated };
}
