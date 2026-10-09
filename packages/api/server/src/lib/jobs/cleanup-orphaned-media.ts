#!/usr/bin/env bun
/**
 * Cleanup script: removes orphan S3 URLs from Competition.prizeImages.
 *
 * Some images referenced in prizeImages (and other image fields) are no longer
 * in the S3-compatible storage. This happens when:
 * - An admin started an upload but never saved the form
 * - An admin replaced an image in a prior session but the old URL remained
 * - S3 objects were deleted out-of-band
 *
 * This script:
 * 1. Scans every competition
 * 2. HEAD-checks every image URL
 * 3. Builds a filtered prizeImages array (only URLs that exist)
 * 4. By default, only PRINTS what would change (dry-run)
 * 5. With --apply, persists the cleaned arrays to MongoDB
 *
 * Usage:
 *   bun run packages/api/server/src/lib/jobs/cleanup-orphaned-media.ts
 *   bun run packages/api/server/src/lib/jobs/cleanup-orphaned-media.ts --apply
 *   bun run packages/api/server/src/lib/jobs/cleanup-orphaned-media.ts --apply --verbose
 */

import { Competition } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";

const HEAD_TIMEOUT_MS = 3000;
const HEAD_FETCH_PARALLELISM = 16;

export interface CleanupOrphanedMediaSummary {
  scannedCompetitions: number;
  scannedUrls: number;
  brokenUrls: number;
  fixedCompetitions: number;
  fixedUrls: number;
  errors: Array<{ id: string; error: string }>;
  applyMode: boolean;
  startedAt: string;
  finishedAt: string;
}

export interface CleanupOrphanedMediaOptions {
  apply?: boolean;
  verbose?: boolean;
  onProgress?: (msg: string) => void;
  log?: (msg: string) => void;
}

interface CompetitionImageFields {
  prizeImages?: string[];
  prizeImagesRemote?: string[];
  prizeImagesSource?: string;
  imageUrl?: string;
  prizeImageUrl?: string;
  heroImageUrl?: string;
}

async function headCheck(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeout);
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    if (res.status === 405 || res.status === 501) {
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), HEAD_TIMEOUT_MS);
      const getRes = await fetch(url, {
        method: "GET",
        signal: getController.signal,
        headers: { Range: "bytes=0-0" },
      });
      clearTimeout(getTimeout);
      return getRes.status === 200 || getRes.status === 206;
    }
    return false;
  } catch {
    return true;
  }
}

async function headCheckBatched(urls: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  for (let i = 0; i < urls.length; i += HEAD_FETCH_PARALLELISM) {
    const batch = urls.slice(i, i + HEAD_FETCH_PARALLELISM);
    const results = await Promise.all(
      batch.map(async (u) => ({ url: u, exists: await headCheck(u) }))
    );
    for (const r of results) map.set(r.url, r.exists);
  }
  return map;
}

function collectAllImageUrls(c: CompetitionImageFields): string[] {
  const urls: string[] = [];
  if (Array.isArray(c.prizeImages)) urls.push(...c.prizeImages);
  if (Array.isArray(c.prizeImagesRemote)) urls.push(...c.prizeImagesRemote);
  if (c.prizeImagesSource) urls.push(c.prizeImagesSource);
  if (c.imageUrl) urls.push(c.imageUrl);
  if (c.prizeImageUrl) urls.push(c.prizeImageUrl);
  if (c.heroImageUrl) urls.push(c.heroImageUrl);
  return Array.from(
    new Set(urls.filter((u): u is string => typeof u === "string" && u.length > 0))
  );
}

export async function runCleanupOrphanedMedia(
  options: CleanupOrphanedMediaOptions = {}
): Promise<CleanupOrphanedMediaSummary> {
  const applyMode = options.apply === true;
  const verbose = options.verbose === true;
  const log = options.log ?? ((m: string) => console.log(m));
  const onProgress = options.onProgress ?? (() => {});

  const startedAt = new Date().toISOString();

  log(`\n=== Cleanup orphaned S3 URLs in competitions ===`);
  log(`Mode: ${applyMode ? "APPLY" : "DRY-RUN (use --apply to persist)"}`);

  await dbConnect();
  log("Connected to MongoDB.");

  const summary: CleanupOrphanedMediaSummary = {
    scannedCompetitions: 0,
    scannedUrls: 0,
    brokenUrls: 0,
    fixedCompetitions: 0,
    fixedUrls: 0,
    errors: [],
    applyMode,
    startedAt,
    finishedAt: "",
  };

  const cursor = Competition.find({ deletedAt: null }).cursor();
  const updates: Array<{
    id: string;
    slug: string;
    oldPrizeImages: string[];
    newPrizeImages: string[];
  }> = [];

  for await (const c of cursor) {
    summary.scannedCompetitions++;
    onProgress(`scanned=${summary.scannedCompetitions} broken=${summary.brokenUrls}`);

    const allUrls = collectAllImageUrls(c as unknown as CompetitionImageFields);
    if (allUrls.length === 0) continue;

    summary.scannedUrls += allUrls.length;

    const urlExistsMap = await headCheckBatched(allUrls);
    const brokenForThisComp = [...urlExistsMap.values()].filter((exists) => !exists).length;
    summary.brokenUrls += brokenForThisComp;

    if (brokenForThisComp > 0) {
      const oldPrizeImages = (c as unknown as { prizeImages?: string[] }).prizeImages ?? [];
      const newPrizeImages = oldPrizeImages.filter((u: string) => urlExistsMap.get(u) ?? true);
      const removed = oldPrizeImages.length - newPrizeImages.length;

      summary.fixedCompetitions++;
      summary.fixedUrls += removed;
      updates.push({
        id: (c as unknown as { _id: { toString(): string } })._id.toString(),
        slug: (c as unknown as { slug?: string }).slug ?? "(no-slug)",
        oldPrizeImages,
        newPrizeImages,
      });

      if (verbose) {
        log(
          `\n  Competition: ${(c as unknown as { slug?: string }).slug ?? "(no-slug)"} (${(c as unknown as { _id: { toString(): string } })._id.toString()})`
        );
        for (const [url, exists] of urlExistsMap.entries()) {
          if (!exists) log(`    BROKEN: ${url}`);
        }
        log(
          `    prizeImages: ${oldPrizeImages.length} → ${newPrizeImages.length} (removed ${removed})`
        );
      }
    }
  }

  if (applyMode && updates.length > 0) {
    log(`\nPersisting ${updates.length} competition updates...`);
    for (const u of updates) {
      try {
        await Competition.updateOne(
          { _id: u.id as unknown as string },
          { $set: { prizeImages: u.newPrizeImages } }
        );
        void invalidateByChannelSafe(CH.competitionDetail, CH.landingPage).catch(() => {});
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push({ id: u.id, error: message });
        if (verbose) log(`    ERROR updating ${u.slug} (${u.id}): ${message}`);
      }
    }
  }

  summary.finishedAt = new Date().toISOString();

  log(`\n=== Summary ===`);
  log(`Competitions scanned: ${summary.scannedCompetitions}`);
  log(`URLs checked:         ${summary.scannedUrls}`);
  log(`Broken URLs found:    ${summary.brokenUrls}`);
  log(`Competitions to fix:  ${summary.fixedCompetitions}`);
  log(`URLs to remove:       ${summary.fixedUrls}`);
  log(`Duration:             ${summary.startedAt} → ${summary.finishedAt}`);
  if (summary.errors.length > 0) {
    log(`Errors:               ${summary.errors.length}`);
    for (const e of summary.errors) {
      log(`  - ${e.id}: ${e.error}`);
    }
  }
  if (!applyMode && summary.fixedCompetitions > 0) {
    log(`\nRe-run with --apply to persist these changes.`);
  }
  if (applyMode) {
    log(`\nDone. ${summary.fixedCompetitions} competitions updated.`);
  }

  return summary;
}

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

if (import.meta.main) {
  runCleanupOrphanedMedia({ apply: APPLY, verbose: VERBOSE })
    .then((summary) => {
      process.exit(summary.errors.length > 0 ? 0 : 0);
    })
    .catch((err: unknown) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
