import { ErrorCodes } from "@oc/api-infra/error-codes";
import { beforeEach, describe, expect, test, vi } from "vitest";
import mediaConverterSettingsApp from "../media-converter-settings";

vi.mock("@oc/api-infra/db", () => ({
  default: vi.fn(async () => {}),
}));

const settingsStore = vi.hoisted(() => ({
  doc: {
    _id: "media_converter_settings" as const,
    addonEnabled: false,
    image: {
      enabled: false,
      quality: 82,
      maxWidth: 2560,
      maxHeight: 2560,
      scopes: {
        media_library: true,
        competition_prizes: true,
        landing_videos: false,
        avatars: true,
        og_images: true,
      },
    },
    video: {
      enabled: false,
      quality: 75,
      maxWidth: 1920,
      preserveAudio: true,
      scopes: {
        media_library: false,
        competition_prizes: false,
        landing_videos: true,
        avatars: false,
        og_images: false,
      },
    },
  },
}));

vi.mock("@oc/api-db/models/MediaConverterSettings", () => ({
  DEFAULT_MEDIA_CONVERTER_SETTINGS: settingsStore.doc,
  MediaConverterSettings: {
    findById: vi.fn(() => ({
      lean: async () => settingsStore.doc,
    })),
    findByIdAndUpdate: vi.fn((_id: string, update: { $set: Record<string, unknown> }) => {
      for (const [path, value] of Object.entries(update.$set)) {
        const parts = path.split(".");
        let cur: Record<string, unknown> = settingsStore.doc as unknown as Record<string, unknown>;
        for (let i = 0; i < parts.length - 1; i++) {
          cur = cur[parts[i]!] as Record<string, unknown>;
        }
        cur[parts[parts.length - 1]!] = value;
      }
      return { lean: async () => settingsStore.doc };
    }),
  },
}));

vi.mock("@oc/api-server/middleware/auth", () => ({
  requireAdmin: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("userId", "admin-id");
    await next();
  },
}));

vi.mock("@oc/api-server/lib/media-converter/settings", () => ({
  invalidateMediaConverterSettingsCache: vi.fn(),
}));

describe("admin media-converter-settings", () => {
  beforeEach(() => {
    settingsStore.doc.addonEnabled = false;
  });

  test("GET returns settings", async () => {
    const res = await mediaConverterSettingsApp.request("/");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { addonEnabled: boolean } };
    expect(json.data.addonEnabled).toBe(false);
  });

  test("PUT updates addonEnabled", async () => {
    const res = await mediaConverterSettingsApp.request("/", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ addonEnabled: true }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { addonEnabled: boolean } };
    expect(json.data.addonEnabled).toBe(true);
  });

  test("PUT rejects invalid body", async () => {
    const res = await mediaConverterSettingsApp.request("/", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: { quality: 500 } }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});
