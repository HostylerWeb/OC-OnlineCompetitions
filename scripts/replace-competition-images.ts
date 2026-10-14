/**
 * Upload generated competition images to local MinIO and update MongoDB URLs.
 * Files in .data/competition-images/: {slug}-card.jpg, {slug}-hero.jpg, {slug}-gallery-N.jpg
 *
 *   bun run scripts/replace-competition-images.ts
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";
import { S3mini } from "s3mini";
import sharp from "sharp";

const MONGO_URI =
  process.env.DEST_MONGO ??
  "mongodb://localhost:27018/onlinecompetitions?directConnection=true";
const ASSET_BASE =
  process.env.ASSET_BASE_URL ?? "http://localhost:9021/onlinecompetitions-assets";
const IMAGE_DIR = path.join(import.meta.dir, "../.data/competition-images");

const s3 = new S3mini({
  accessKeyId: process.env.S3_ACCESS_KEY ?? "oc_dev_access_key",
  secretAccessKey: process.env.S3_SECRET_KEY ?? "oc_dev_secret_key",
  endpoint: "http://127.0.0.1:9021/onlinecompetitions-assets",
  region: "us-east-1",
});

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await s3.listObjectsPaged("/", prefix, 500, cursor);
    for (const obj of page?.objects ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    cursor = page?.nextContinuationToken;
  } while (cursor);
  return keys;
}

async function deletePrefix(prefix: string) {
  const keys = await listKeys(prefix);
  await Promise.all(keys.map((key) => s3.deleteObject(key)));
  if (keys.length) console.log(`Deleted ${keys.length} under ${prefix}`);
}

async function uploadWebp(localImage: string, objectKey: string): Promise<string> {
  const body = await sharp(localImage).webp({ quality: 82 }).toBuffer();
  await s3.putObject(objectKey, body, "image/webp");
  return `${ASSET_BASE}/${objectKey}`;
}

async function main() {
  const files = (await readdir(IMAGE_DIR)).filter((f) => /\.(png|webp|jpe?g)$/i.test(f));
  const bySlug = new Map<string, { card?: string; hero?: string; gallery: string[] }>();

  for (const file of files) {
    const m = /^(.+)-(card|hero|gallery-\d+)\.(png|webp|jpe?g)$/i.exec(file);
    if (!m) continue;
    const slug = m[1];
    const kind = m[2];
    const full = path.join(IMAGE_DIR, file);
    let entry = bySlug.get(slug);
    if (!entry) {
      entry = { gallery: [] };
      bySlug.set(slug, entry);
    }
    if (kind === "card") entry.card = full;
    else if (kind === "hero") entry.hero = full;
    else entry.gallery.push(full);
  }

  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const col = mongo.db("onlinecompetitions").collection("competitions");

  for (const [slug, assets] of bySlug) {
    const comp = await col.findOne({ slug, deletedAt: null });
    if (!comp || !assets.card) continue;

    const prefix = `prizes/${slug}/`;
    await deletePrefix(prefix);

    const ts = Date.now();
    const imageUrl = await uploadWebp(assets.card, `${prefix}${ts}-card.webp`);

    let heroImageUrl = "";
    if (assets.hero) {
      heroImageUrl = await uploadWebp(assets.hero, `${prefix}${ts}-hero.webp`);
    } else if (comp.heroImageUrl) {
      heroImageUrl = await uploadWebp(assets.card, `${prefix}${ts}-hero.webp`);
    }

    assets.gallery.sort((a, b) => {
      const na = Number(/gallery-(\d+)/i.exec(path.basename(a))?.[1] ?? 0);
      const nb = Number(/gallery-(\d+)/i.exec(path.basename(b))?.[1] ?? 0);
      return na - nb;
    });

    const prizeImages: string[] = [];
    for (let i = 0; i < assets.gallery.length; i++) {
      prizeImages.push(await uploadWebp(assets.gallery[i], `${prefix}${ts}-gallery-${i + 1}.webp`));
    }

    await col.updateOne(
      { _id: comp._id },
      {
        $set: {
          imageUrl,
          heroImageUrl,
          prizeImages,
          updatedAt: new Date(),
        },
      },
    );
    console.log(`OK ${slug}`);
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
