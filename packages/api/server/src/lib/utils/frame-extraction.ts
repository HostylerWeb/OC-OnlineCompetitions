import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { createExternalAxios } from "@oc/api-axios";
import {
  buildAssetUrl,
  deleteObjects,
  extractKeyFromUrl,
  getPresignedDownloadUrl,
  listAssets,
  uploadFile,
} from "@oc/api-storage/s3";
import { probeVideo } from "./probe-video";

const execFileAsync = promisify(execFile);

const videoDownloadAxios = createExternalAxios({
  baseURL: "",
  timeout: 300_000,
});

const FRAMES_SCALE = "1280:720";
const FRAMES_QUALITY = 2; // -q:v 2 = near-lossless JPEG (~75-120KB per 720p frame)

export interface ExtractFramesResult {
  prefix: string;
  count: number;
  fps: number;
  metadata: {
    source: {
      width: number;
      height: number;
      fps: number;
      duration: number;
      codec: string;
      size: number;
    };
    extraction: {
      fps: number;
      width: number;
      height: number;
      quality: number;
      totalFrames: number;
    };
  };
}

export interface ExtractFramesOptions {
  /**
   * Called after each frame is uploaded to S3 with the current frame count.
   * Throttled by caller to avoid hammering MongoDB.
   */
  onProgress?: (count: number) => void;
}

/**
 * Extract video frames as JPEGs and upload them to S3.
 *
 * Downloads the video from S3, probes it for source metadata,
 * runs ffmpeg to extract frames at the source video's native framerate,
 * uploads each frame back to S3, then cleans up temp files.
 *
 * @param videoUrl  The full S3/CDN URL of the uploaded video
 * @param competitionId  The competition ObjectId string (used as the S3 directory name)
 * @returns The CDN frames prefix, total frame count, fps, and full source/extraction metadata
 */
export async function extractFrames(
  videoUrl: string,
  competitionId: string,
  options?: ExtractFramesOptions
): Promise<ExtractFramesResult> {
  const tmpDir = `/tmp/frames/${competitionId}`;
  const framesDir = join(tmpDir, "frames");

  // ── 1. Setup temp directory ──────────────────────────────────────────────
  await mkdir(framesDir, { recursive: true });

  let videoPath: string | undefined;

  try {
    // ── 2. Download video from S3 ──────────────────────────────────────────
    const downloadUrl = await getPresignedDownloadUrl(extractKeyFromUrl(videoUrl));
    videoPath = join(tmpDir, "input video");
    const videoBuffer = await fetchFile(downloadUrl);
    await writeFile(videoPath, videoBuffer);

    // ── 3. Probe source video metadata ─────────────────────────────────────
    const sourceMeta = await probeVideo(videoPath);
    const extractionFps = sourceMeta.fps;

    // ── 4. Extract frames with ffmpeg at source framerate ──────────────────
    await execFileAsync("ffmpeg", [
      "-i",
      videoPath,
      "-vf",
      `fps=${extractionFps},scale=${FRAMES_SCALE}`,
      "-q:v",
      String(FRAMES_QUALITY),
      join(framesDir, "frame_%04d.jpg"),
    ]);

    // ── 5. Upload frames to S3 ─────────────────────────────────────────────
    const frameFiles = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();

    if (frameFiles.length === 0) {
      throw new Error("ffmpeg produced no frame files");
    }

    try {
      for (const file of frameFiles) {
        const filePath = join(framesDir, file);
        const key = `frames/${competitionId}/${file}`;
        const content = await readFile(filePath);
        await uploadFile(key, content, "image/jpeg", {
          "Cache-Control": "public, max-age=31536000, immutable",
        });
        const uploaded = frameFiles.indexOf(file) + 1;
        options?.onProgress?.(uploaded);
      }
    } catch (err) {
      await deleteFrames(competitionId).catch((cleanupErr) =>
        console.error("Failed to clean up partial frames:", cleanupErr)
      );
      throw err;
    }

    const prefix = buildAssetUrl(`frames/${competitionId}/frame_`);

    const scaleParts = FRAMES_SCALE.split(":").map(Number);
    const scaleW = scaleParts[0] ?? 0;
    const scaleH = scaleParts[1] ?? 0;

    return {
      prefix,
      count: frameFiles.length,
      fps: extractionFps,
      metadata: {
        source: {
          width: sourceMeta.width,
          height: sourceMeta.height,
          fps: sourceMeta.fps,
          duration: sourceMeta.duration,
          codec: sourceMeta.codec,
          size: sourceMeta.size,
        },
        extraction: {
          fps: extractionFps,
          width: scaleW,
          height: scaleH,
          quality: FRAMES_QUALITY,
          totalFrames: frameFiles.length,
        },
      },
    };
  } finally {
    // ── 6. Always clean up temp files ──────────────────────────────────────
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Delete all frame files for a competition from S3.
 *
 * @param competitionId  The competition ObjectId string
 */
export async function deleteFrames(competitionId: string): Promise<void> {
  try {
    const prefix = `frames/${competitionId}/`;
    let cursor: string | undefined;

    do {
      const { assets, nextCursor } = await listAssets(prefix, 1000, cursor);
      cursor = nextCursor;

      if (assets.length > 0) {
        await deleteObjects(assets.map((a) => a.key));
      }
    } while (cursor);
  } catch (err) {
    console.error("Failed to delete frames:", err);
  }
}

async function fetchFile(url: string): Promise<Buffer> {
  const { data } = await videoDownloadAxios.get<ArrayBuffer>(url, { responseType: "arraybuffer" });
  return Buffer.from(data);
}
