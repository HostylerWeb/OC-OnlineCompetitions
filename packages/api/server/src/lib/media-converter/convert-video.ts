import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { MediaConverterVideoSettings } from "@oc/types";
import { replaceKeyExtension } from "./scope";

const execFileAsync = promisify(execFile);

let ffmpegPath: string | null = null;
try {
  ffmpegPath = require("@ffmpeg-installer/ffmpeg").path as string;
} catch {
  ffmpegPath = null;
}

export function isFfmpegAvailable(): boolean {
  return Boolean(ffmpegPath);
}

function qualityToCrf(quality: number): number {
  const clamped = Math.min(100, Math.max(1, quality));
  return Math.round(63 - (clamped / 100) * 48);
}

function inputExtensionFromContentType(contentType: string): string {
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("webm")) return "webm";
  return "mp4";
}

export interface ConvertVideoResult {
  bytes: Uint8Array;
  contentType: "video/webm";
  key: string;
  converted: boolean;
}

export async function convertVideoToWebm(
  input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
    settings: MediaConverterVideoSettings;
  }
): Promise<ConvertVideoResult> {
  const { key, bytes, contentType, settings } = input;

  if (!ffmpegPath) {
    console.warn("[media-converter] ffmpeg not available; skipping video conversion");
    return { bytes, contentType: input.contentType, key, converted: false };
  }

  if (contentType === "video/webm") {
    return { bytes, contentType: "video/webm", key, converted: false };
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "onlinecompetitions-webm-"));
  const inExt = inputExtensionFromContentType(contentType);
  const inputPath = join(tmpDir, `input.${inExt}`);
  const outputPath = join(tmpDir, "output.webm");

  try {
    await writeFile(inputPath, bytes);

    const crf = qualityToCrf(settings.quality);
    const scaleFilter = `scale='min(${settings.maxWidth},iw)':-2`;
    const args = [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libvpx-vp9",
      "-crf",
      String(crf),
      "-b:v",
      "0",
      "-vf",
      scaleFilter,
    ];

    if (settings.preserveAudio) {
      args.push("-c:a", "libopus");
    } else {
      args.push("-an");
    }

    args.push(outputPath);

    await execFileAsync(ffmpegPath!, args, { timeout: 600_000, maxBuffer: 16 * 1024 * 1024 });

    const out = await readFile(outputPath);
    return {
      bytes: new Uint8Array(out),
      contentType: "video/webm",
      key: replaceKeyExtension(key, "webm"),
      converted: true,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
