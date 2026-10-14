/**
 * Prune S3/MinIO objects and strip dead image URLs from MongoDB.
 *
 * Keeps:
 * - All object keys referenced by active competitions
 * - The first N objects by sorted key (default 10) across the bucket
 *
 *   bun run scripts/prune-media-vps.ts --dry-run
 *   bun run scripts/prune-media-vps.ts --apply
 */
import { MongoClient } from "mongodb";
import { S3mini } from "s3mini";

const APPLY = process.argv.includes("--apply");
const FIRST_N = Number(process.env.PRUNE_KEEP_FIRST_N ?? "10");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const endpoint = `${process.env.S3_ENDPOINT?.replace(/\/$/, "")}/${process.env.S3_BUCKET}`;
const s3 = new S3mini({
  accessKeyId: process.env.S3_ACCESS_KEY ?? process.env.S3_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.S3_SECRET_KEY ?? process.env.S3_SECRET_ACCESS_KEY ?? "",
  endpoint,
  region: process.env.AWS_REGION ?? "us-east-1",
});

function keyFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const marker = "onlinecompetitions-assets/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split("?")[0] ?? null;
}

function collectCompetitionUrls(doc: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const f of [
    "imageUrl",
    "heroImageUrl",
    "prizeImageUrl",
    "ogImageUrl",
    "refOgImageUrl",
  ]) {
    const v = doc[f];
    if (typeof v === "string" && v) urls.push(v);
  }
  for (const arr of ["prizeImages", "prizeImagesRemote"]) {
    const v = doc[arr];
    if (Array.isArray(v)) {
      for (const u of v) if (typeof u === "string" && u) urls.push(u);
    }
  }
  return urls;
}

async function listAllKeys(): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await s3.listObjectsPaged("/", "", 1000, cursor);
    for (const o of page?.objects ?? []) {
      if (o.Key) keys.push(o.Key);
    }
    cursor = page?.nextContinuationToken;
  } while (cursor);
  return keys.sort();
}

async function main() {
  const allKeys = await listAllKeys();
  const firstKeys = new Set(allKeys.slice(0, FIRST_N));

  const mongo = new MongoClient(DATABASE_URL!);
  await mongo.connect();
  const db = mongo.db();

  const compKeep = new Set<string>();
  const competitions = await db
    .collection("competitions")
    .find({ deletedAt: null })
    .toArray();
  for (const c of competitions) {
    for (const url of collectCompetitionUrls(c as Record<string, unknown>)) {
      const k = keyFromUrl(url);
      if (k) compKeep.add(k);
    }
  }

  const keep = new Set<string>([...firstKeys, ...compKeep]);
  const toDelete = allKeys.filter((k) => !keep.has(k));

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        totalObjects: allKeys.length,
        keepFirstN: FIRST_N,
        keepFromCompetitions: compKeep.size,
        keepTotal: keep.size,
        deleteCount: toDelete.length,
        deleteSample: toDelete.slice(0, 20),
      },
      null,
      2
    )
  );

  if (!APPLY) {
    await mongo.close();
    return;
  }

  for (const key of toDelete) {
    await s3.deleteObject(key);
  }
  console.log(`Deleted ${toDelete.length} objects from storage`);

  const deletedUrls = new Set(
    toDelete.map((k) => `${process.env.ASSET_BASE_URL?.replace(/\/$/, "")}/${k}`)
  );

  const stripUrl = (url: unknown): unknown => {
    if (typeof url === "string" && deletedUrls.has(url.split("?")[0] ?? "")) return null;
    return url;
  };

  const stripArray = (arr: unknown): unknown => {
    if (!Array.isArray(arr)) return arr;
    return arr.filter((u) => typeof u === "string" && !deletedUrls.has(u.split("?")[0] ?? ""));
  };

  for (const c of competitions) {
    const $set: Record<string, unknown> = {};
    for (const f of ["imageUrl", "heroImageUrl", "prizeImageUrl", "ogImageUrl", "refOgImageUrl"]) {
      const v = (c as Record<string, unknown>)[f];
      if (typeof v === "string" && deletedUrls.has(v.split("?")[0] ?? "")) $set[f] = null;
    }
    for (const f of ["prizeImages", "prizeImagesRemote"]) {
      const v = (c as Record<string, unknown>)[f];
      if (Array.isArray(v)) {
        const next = stripArray(v) as string[];
        if (JSON.stringify(next) !== JSON.stringify(v)) $set[f] = next;
      }
    }
    if (Object.keys($set).length > 0) {
      await db.collection("competitions").updateOne({ _id: c._id }, { $set });
    }
  }

  const otherCollections: { name: string; fields: string[]; arrayFields?: string[] }[] = [
    { name: "categories", fields: ["imageUrl"] },
    { name: "shopproducts", fields: ["imageUrl"], arrayFields: ["images"] },
    { name: "instantprizes", fields: [], arrayFields: ["images"] },
    { name: "profiles", fields: ["avatarUrl"] },
    { name: "winners", fields: ["prizeImageUrl"] },
    { name: "homepagelayoutsettings", fields: ["heroImageUrl"] },
    { name: "seosettings", fields: ["defaultOgImageUrl"] },
  ];

  for (const { name, fields, arrayFields } of otherCollections) {
    const col = db.collection(name);
    const exists = await col.findOne({});
    if (!exists) continue;
    const cursor = col.find({});
    for await (const doc of cursor) {
      const $set: Record<string, unknown> = {};
      for (const f of fields) {
        const v = doc[f];
        if (typeof v === "string" && deletedUrls.has(v.split("?")[0] ?? "")) $set[f] = null;
      }
      for (const f of arrayFields ?? []) {
        const v = doc[f];
        if (Array.isArray(v)) {
          const next = stripArray(v);
          if (JSON.stringify(next) !== JSON.stringify(v)) $set[f] = next;
        }
      }
      if (Object.keys($set).length > 0) {
        await col.updateOne({ _id: doc._id }, { $set });
      }
    }
  }

  await mongo.close();
  console.log("Database references cleaned");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
