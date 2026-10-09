import { describe, expect, test } from "vitest";
import sharp from "sharp";
import { DEFAULT_MEDIA_CONVERTER_SETTINGS } from "@oc/types";
import { convertImageToWebp } from "./convert-image";

describe("convertImageToWebp", () => {
  test("converts PNG to WebP with new key", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const result = await convertImageToWebp({
      key: "uploads/test.png",
      bytes: new Uint8Array(png),
      contentType: "image/png",
      settings: {
        ...DEFAULT_MEDIA_CONVERTER_SETTINGS.image,
        enabled: true,
        quality: 80,
      },
    });

    expect(result.converted).toBe(true);
    expect(result.contentType).toBe("image/webp");
    expect(result.key).toBe("uploads/test.webp");
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });
});
