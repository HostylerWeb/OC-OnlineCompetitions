import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createExternalAxios } from "@oc/api-axios";
import { Competition, FrameExtractionJob } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { buildAssetUrl, uploadFile } from "@oc/api-storage/s3";
import Ffmpeg from "fluent-ffmpeg";
import { emitProgress } from "./extraction-events";
import { probeVideo } from "./probe-video";

const videoAxios = createExternalAxios({
  baseURL: "",
  timeout: 300_000,
});

let ffmpegPath: string | null = null;
try {
  ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
  Ffmpeg.setFfmpegPath(ffmpegPath!);
} catch {
  console.warn("[frame-extractor] ffmpeg not available, video processing disabled");
}

const FRAMES_SCALE = "1280:720";
const FRAMES_QUALITY = 2;
const TIMEOUT_MS = 15 * 60 * 1000;

export async function runExtraction(
  jobId: string,
  competitionId: string,
  videoUrl: string
): Promise<void> {
  if (!ffmpegPath) {
    await FrameExtractionJob.findByIdAndUpdate(jobId, {
      status: "failed",
      errorMessage: "Video processing not available (ffmpeg not installed)",
      completedAt: new Date(),
    });
    return;
  }
  await dbConnect();

  const tmpDir = `/tmp/frames/${competitionId}`;
  const framesDir = join(tmpDir, "frames");
  let videoPath: string | undefined;

  const timeout = setTimeout(() => {
    const err = "Timeout: extraction exceeded 15 minutes";
    finalizeJob(jobId, competitionId, err).catch((err) =>
      console.warn("[frame-extractor] finalize failed:", err)
    );
  }, TIMEOUT_MS);

  try {
    await mkdir(framesDir, { recursive: true });

    videoPath = join(tmpDir, "input.mp4");
    const { data } = await videoAxios.get<ArrayBuffer>(videoUrl, { responseType: "arraybuffer" });
    await writeFile(videoPath, Buffer.from(data));

    // ── Probe source video metadata ──────────────────────────────────────────
    const sourceMeta = await probeVideo(videoPath);
    const extractionFps = sourceMeta.fps;

    await FrameExtractionJob.findByIdAndUpdate(jobId, {
      status: "running",
      startedAt: new Date(),
    });

    await new Promise<void>((resolve, reject) => {
      let lastPct = -1;
      Ffmpeg(videoPath)
        .outputOptions([`-vf fps=${extractionFps},scale=${FRAMES_SCALE}`, `-q:v ${FRAMES_QUALITY}`])
        .noAudio()
        .output(join(framesDir, "frame_%04d.jpg"))
        .on("progress", (info) => {
          const pct = Math.round(info.percent ?? 0);
          if (pct !== lastPct && pct % 5 === 0) {
            lastPct = pct;
            const percentage = Math.min(pct, 99);
            FrameExtractionJob.findByIdAndUpdate(jobId, { percentage }).catch((err) =>
              console.warn("[frame-extractor] progress update failed:", err)
            );
            emitProgress(jobId, { type: "progress", framesExtracted: 0, percentage });
          }
        })
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    const frameFiles = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();
    const frameCount = frameFiles.length;

    if (frameCount === 0) {
      throw new Error("ffmpeg produced no frame files");
    }

    let uploadedFrames = 0;
    const batchSize = 5;
    for (let i = 0; i < frameFiles.length; i += batchSize) {
      const batch = frameFiles.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (file) => {
          const filePath = join(framesDir, file);
          const key = `frames/${competitionId}/${file}`;
          const content = await readFile(filePath);
          await uploadFile(key, content, "image/jpeg", {
            "Cache-Control": "public, max-age=31536000, immutable",
          });
        })
      );
      uploadedFrames += batch.length;
      const percentage = Math.round((uploadedFrames / frameCount) * 100);
      FrameExtractionJob.findByIdAndUpdate(jobId, {
        framesExtracted: uploadedFrames,
        framesTotal: frameCount,
        percentage,
      }).catch((err) => console.warn("[frame-extractor] progress update failed:", err));
      emitProgress(jobId, {
        type: "progress",
        framesExtracted: uploadedFrames,
        framesTotal: frameCount,
        percentage,
      });
    }

    clearTimeout(timeout);

    const prefix = buildAssetUrl(`frames/${competitionId}/frame_`);

    await FrameExtractionJob.findByIdAndUpdate(jobId, {
      status: "completed",
      framesExtracted: frameCount,
      framesTotal: frameCount,
      percentage: 100,
      completedAt: new Date(),
    });

    const scaleParts = FRAMES_SCALE.split(":").map(Number);
    const scaleW = scaleParts[0] ?? 0;
    const scaleH = scaleParts[1] ?? 0;

    const comp = await Competition.findById(competitionId);
    if (comp) {
      comp.landingPageVideoFramesPrefix = prefix;
      comp.landingPageVideoFrameCount = frameCount;
      comp.landingPageVideoFps = extractionFps;
      comp.landingPageVideoMetadata = {
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
          totalFrames: frameCount,
        },
      };
      await comp.save();
      void invalidateByChannelSafe(CH.landingPage, CH.competitionDetail).catch(() => {});
    }

    emitProgress(jobId, { type: "completed", prefix, count: frameCount });
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    await finalizeJob(jobId, competitionId, message);
  } finally {
    clearTimeout(timeout);
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch((err) =>
        console.warn("[frame-extractor] cleanup failed:", err)
      );
    }
  }
}

async function finalizeJob(
  jobId: string,
  competitionId: string,
  errorMessage: string
): Promise<void> {
  await FrameExtractionJob.findByIdAndUpdate(jobId, {
    status: "failed",
    errorMessage,
    completedAt: new Date(),
  }).catch((err) => console.warn("[frame-extractor] finalize failed:", err));

  try {
    const comp = await Competition.findById(competitionId);
    if (comp) {
      comp.frameExtractionJobId = null;
      await comp.save();
      void invalidateByChannelSafe(CH.landingPage, CH.competitionDetail).catch(() => {});
    }
  } catch {}

  const { deleteFrames } = await import("./frame-extraction");
  await deleteFrames(competitionId).catch((err) =>
    console.warn("[frame-extractor] deleteFrames failed:", err)
  );

  emitProgress(jobId, { type: "failed", error: errorMessage });
}
