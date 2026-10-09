/**
 * One-off: point stored media URLs at local MinIO and .webp extensions.
 * Usage: bun run packages/api/server/src/lib/jobs/rewrite-local-asset-urls.ts
 *        bun run packages/api/server/src/lib/jobs/rewrite-local-asset-urls.ts --dry-run
 */

import dbConnect from "@oc/api-infra/db";
import {
  Competition,
  InstantPrize,
  Profile,
  SeoSettings,
  ShopProduct,
  ShopProductVariant,
  Winner,
} from "@oc/api-db/models";

const LOCAL_BASE = "http://localhost:9011/onlinecompetitions-assets";
const dryRun = process.argv.includes("--dry-run");

function rewriteUrl(value: string): string {
  let u = value
    .replace(/https:\/\/assets\.onlinecompetitions\.win\/onlinecompetitions-assets/gi, LOCAL_BASE)
    .replace(/https:\/\/assets\.staging\.onlinecompetitions\.win\/onlinecompetitions-assets/gi, LOCAL_BASE);
  u = u.replace(/\.(png|jpe?g)(?=($|\?|#))/gi, ".webp");
  return u;
}

function mapStrings(values: string[] | undefined): { next: string[]; changed: boolean } {
  if (!Array.isArray(values)) return { next: [], changed: false };
  let changed = false;
  const next = values.map((v) => {
    const n = rewriteUrl(v);
    if (n !== v) changed = true;
    return n;
  });
  return { next, changed };
}

async function main() {
  await dbConnect();
  let touched = 0;

  const competitions = await Competition.find({}).lean();
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
      "prizeImagesSource",
    ] as const) {
      const v = row[field];
      if (typeof v === "string") {
        const n = rewriteUrl(v);
        if (n !== v) updates[field] = n;
      }
    }
    const imgs = mapStrings(row.prizeImages as string[] | undefined);
    if (imgs.changed) updates.prizeImages = imgs.next;
    const remote = mapStrings(row.prizeImagesRemote as string[] | undefined);
    if (remote.changed) updates.prizeImagesRemote = remote.next;
    if (Object.keys(updates).length > 0) {
      touched += 1;
      if (!dryRun) await Competition.updateOne({ _id: row._id }, { $set: updates });
    }
  }

  for (const Model of [InstantPrize, ShopProduct, ShopProductVariant]) {
    const rows = await Model.find({}).select("_id images").lean();
    for (const doc of rows) {
      const row = doc as { _id: unknown; images?: string[] };
      const imgs = mapStrings(row.images);
      if (imgs.changed) {
        touched += 1;
        if (!dryRun) await Model.updateOne({ _id: row._id }, { $set: { images: imgs.next } });
      }
    }
  }

  const winners = await Winner.find({ prizeImageUrl: { $exists: true, $ne: null } }).lean();
  for (const w of winners) {
    const row = w as { _id: unknown; prizeImageUrl?: string };
    if (typeof row.prizeImageUrl === "string") {
      const n = rewriteUrl(row.prizeImageUrl);
      if (n !== row.prizeImageUrl) {
        touched += 1;
        if (!dryRun) await Winner.updateOne({ _id: row._id }, { $set: { prizeImageUrl: n } });
      }
    }
  }

  const profiles = await Profile.find({ avatarUrl: { $exists: true, $ne: null } }).lean();
  for (const p of profiles) {
    const row = p as { _id: unknown; avatarUrl?: string };
    if (typeof row.avatarUrl === "string") {
      const n = rewriteUrl(row.avatarUrl);
      if (n !== row.avatarUrl) {
        touched += 1;
        if (!dryRun) await Profile.updateOne({ _id: row._id }, { $set: { avatarUrl: n } });
      }
    }
  }

  const seo = await SeoSettings.findOne({}).lean();
  if (seo) {
    const row = seo as { defaultOgImageUrl?: string; referralOgImageUrl?: string };
    const seoUpdates: Record<string, string> = {};
    if (row.defaultOgImageUrl) {
      const n = rewriteUrl(row.defaultOgImageUrl);
      if (n !== row.defaultOgImageUrl) seoUpdates.defaultOgImageUrl = n;
    }
    if (row.referralOgImageUrl) {
      const n = rewriteUrl(row.referralOgImageUrl);
      if (n !== row.referralOgImageUrl) seoUpdates.referralOgImageUrl = n;
    }
    if (Object.keys(seoUpdates).length > 0) {
      touched += 1;
      if (!dryRun) await SeoSettings.updateOne({}, { $set: seoUpdates });
    }
  }

  console.log(
    dryRun
      ? `[dry-run] Would update ${touched} document(s).`
      : `Updated ${touched} document(s) → ${LOCAL_BASE} with .webp paths.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
