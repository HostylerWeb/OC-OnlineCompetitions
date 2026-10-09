import { describe, expect, test, vi } from "vitest";
import sharp from "sharp";
import { DEFAULT_MEDIA_CONVERTER_SETTINGS } from "@oc/types";
import { transformUploadBytes } from "./transform";

vi.mock("./settings", () => ({
  getMediaConverterSettings: vi.fn(async () => DEFAULT_MEDIA_CONVERTER_SETTINGS),
}));

describe("transformUploadBytes", () => {
  test("no-ops when addon disabled", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 128, b: 255 } },
    })
      .png()
      .toBuffer();

    const out = await transformUploadBytes({
      key: "uploads/x.png",
      bytes: new Uint8Array(png),
      contentType: "image/png",
    });
    expect(out.converted).toBe(false);
    expect(out.contentType).toBe("image/png");
  });

  test("converts when addon and image scope enabled", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 128, b: 255 } },
    })
      .png()
      .toBuffer();

    const settings = {
      ...DEFAULT_MEDIA_CONVERTER_SETTINGS,
      addonEnabled: true,
      image: {
        ...DEFAULT_MEDIA_CONVERTER_SETTINGS.image,
        enabled: true,
        scopes: {
          ...DEFAULT_MEDIA_CONVERTER_SETTINGS.image.scopes,
          media_library: true,
        },
      },
    };

    const out = await transformUploadBytes({
      key: "uploads/x.png",
      bytes: new Uint8Array(png),
      contentType: "image/png",
      settings,
    });

    expect(out.converted).toBe(true);
    expect(out.contentType).toBe("image/webp");
    expect(out.key).toBe("uploads/x.webp");
  });
});
