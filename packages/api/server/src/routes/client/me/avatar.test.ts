import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../../../../config/asset-storage.mjs", () => ({
  assetProfiles: {
    local: { S3_BUCKET: "", S3_ENDPOINT: "", ASSET_BASE_URL: "http://localhost:9011/local" },
    staging: { S3_BUCKET: "", S3_ENDPOINT: "", ASSET_BASE_URL: "http://localhost:9011/staging" },
  },
}));

const userId = new Types.ObjectId().toString();
const googleImage = "https://lh3.googleusercontent.com/a/example-photo";

const assetProfiles = {
  local: { S3_BUCKET: "", S3_ENDPOINT: "", ASSET_BASE_URL: "http://localhost:9011/local" },
  staging: { S3_BUCKET: "", S3_ENDPOINT: "", ASSET_BASE_URL: "http://localhost:9011/staging" },
};

const __mock = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  deleteAvatarIfOwned: vi.fn(),
  hasGoogleAccount: vi.fn(async () => false),
  getAuthUserImage: vi.fn(async () => null),
  profileDoc: null as Record<string, unknown> | null,
  profileUpdatePayload: null as Record<string, unknown> | null,
  uploadedKey: null as string | null,
  requireSession: vi.fn(
    async (_c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      await next();
    }
  ),
  requireVerifiedUser: vi.fn(
    async (_c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      await next();
    }
  ),
  auth: vi.fn(async (_c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("@oc/api-infra/db", () => ({
  default: vi.fn(async () => {}),
}));

vi.mock("@oc/api-storage/s3", () => ({
  buildAssetUrl: (key: string) => `${assetProfiles.local.ASSET_BASE_URL}/${key}`,
  uploadFile: __mock.uploadFile,
}));

vi.mock("@oc/api-server/lib/avatar/process-upload", () => ({
  AvatarUploadValidationError: class AvatarUploadValidationError extends Error {},
  validateAvatarFileMeta: vi.fn(),
  processAvatarUploadBytes: vi.fn(
    async (userId: string, _bytes: Uint8Array, _mime: string) => ({
      key: `avatars/${userId}/${Date.now()}-mock.webp`,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/webp" as const,
    })
  ),
}));

vi.mock("@oc/api-storage/avatar-storage", () => ({
  deleteAvatarIfOwned: __mock.deleteAvatarIfOwned,
  getAuthUserImage: __mock.getAuthUserImage,
  hasGoogleAccount: __mock.hasGoogleAccount,
}));

vi.mock("@oc/api-server/middleware/auth", () => ({
  isPublicRoute: () => false,
  resolveSession: vi.fn(async () => ({})),
  sessionMiddleware: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireSession: __mock.requireSession,
  requireVerifiedUser: __mock.requireVerifiedUser,
  getRequiredUserId: () => "test-user-id",
  auth: __mock.requireSession,
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock("@oc/auth-admin/avatar-sync", () => ({
  maybeSyncAvatarFromAuthUser: async (id: string, imageUrl: string) => {
    if (__mock.profileDoc && (__mock.profileDoc as Record<string, unknown>)._id === id) {
      if (!(__mock.profileDoc as Record<string, unknown>).avatarUrl) {
        __mock.profileUpdatePayload = { avatarUrl: imageUrl };
      }
    }
  },
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: (id: string) => ({
      select: () => ({
        lean: async () => {
          if (__mock.profileDoc && (__mock.profileDoc as Record<string, unknown>)._id === id)
            return __mock.profileDoc;
          return null;
        },
      }),
      lean: async () => __mock.profileDoc,
    }),
    findByIdAndUpdate: (id: string, update: Record<string, unknown>) => {
      __mock.profileUpdatePayload = update;
      if (__mock.profileDoc && (__mock.profileDoc as Record<string, unknown>)._id === id) {
        __mock.profileDoc = {
          ...__mock.profileDoc,
          ...update,
          ...(update.$unset ? { avatarUrl: undefined } : {}),
        };
        return { lean: async () => __mock.profileDoc };
      }
      return { lean: async () => null };
    },
  },
}));

beforeEach(() => {
  __mock.uploadFile.mockReset();
  __mock.uploadFile.mockImplementation(async (key: string) => {
    __mock.uploadedKey = key;
  });
  __mock.deleteAvatarIfOwned.mockReset();
  __mock.deleteAvatarIfOwned.mockImplementation(async () => {});
  __mock.hasGoogleAccount.mockReset();
  __mock.hasGoogleAccount.mockImplementation(async () => false);
  __mock.getAuthUserImage.mockReset();
  __mock.getAuthUserImage.mockImplementation(async () => null);
  __mock.requireSession.mockReset();
  __mock.requireSession.mockImplementation(
    async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      c.set("userId", userId);
      c.set("user", { id: userId, email: "user@example.com", image: null, emailVerified: true });
      await next();
    }
  );
  __mock.requireVerifiedUser.mockReset();
  __mock.requireVerifiedUser.mockImplementation(
    async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      c.set("userId", userId);
      c.set("user", { id: userId, email: "user@example.com", image: null, emailVerified: true });
      await next();
    }
  );
  __mock.auth.mockReset();
  __mock.auth.mockImplementation(
    async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      c.set("userId", userId);
      c.set("user", { id: userId, email: "user@example.com", image: null, emailVerified: true });
      await next();
    }
  );

  __mock.profileDoc = { _id: userId, email: "user@example.com" };
  __mock.profileUpdatePayload = null;
  __mock.uploadedKey = null;

  process.env.ASSET_BASE_URL = assetProfiles.local.ASSET_BASE_URL;
  process.env.S3_BUCKET = assetProfiles.local.S3_BUCKET;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /me/profile/avatar", () => {
  test("uploads to avatars/{userId}/ prefix and updates profile", async () => {
    const app = (await import("./avatar")).default;
    const formData = new FormData();
    formData.append("file", new File(["img"], "avatar.png", { type: "image/png" }));

    const response = await app.request("http://localhost/", {
      method: "POST",
      body: formData,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(__mock.uploadedKey).toMatch(new RegExp(`^avatars/${userId}/\\d+-mock\\.webp$`));
    expect(__mock.uploadFile).toHaveBeenCalledTimes(1);
    expect(__mock.profileUpdatePayload).toEqual({
      avatarUrl: `${assetProfiles.local.ASSET_BASE_URL}/${__mock.uploadedKey}`,
    });
    expect(body.data.avatarUrl).toBe(`${assetProfiles.local.ASSET_BASE_URL}/${__mock.uploadedKey}`);
  });

  test("deletes previous owned avatar after upload", async () => {
    __mock.profileDoc = {
      _id: userId,
      email: "user@example.com",
      avatarUrl: `${assetProfiles.local.ASSET_BASE_URL}/avatars/${userId}/old.png`,
    };

    const app = (await import("./avatar")).default;
    const formData = new FormData();
    formData.append("file", new File(["img"], "avatar.jpg", { type: "image/jpeg" }));

    await app.request("http://localhost/", {
      method: "POST",
      body: formData,
    });

    expect(__mock.deleteAvatarIfOwned).toHaveBeenCalledWith(
      `${assetProfiles.local.ASSET_BASE_URL}/avatars/${userId}/old.png`
    );
  });
});

describe("POST /me/profile/avatar/import-google", () => {
  beforeEach(() => {
    __mock.hasGoogleAccount.mockImplementation(async () => true);
    __mock.getAuthUserImage.mockImplementation(async () => googleImage);
  });

  test("sets avatarUrl from Better Auth user.image and deletes owned previous", async () => {
    __mock.profileDoc = {
      _id: userId,
      email: "user@example.com",
      avatarUrl: `${assetProfiles.local.ASSET_BASE_URL}/avatars/${userId}/custom.png`,
    };

    const app = (await import("./avatar")).default;
    const response = await app.request("http://localhost/import-google", { method: "POST" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(__mock.deleteAvatarIfOwned).toHaveBeenCalledWith(
      `${assetProfiles.local.ASSET_BASE_URL}/avatars/${userId}/custom.png`
    );
    expect(__mock.profileUpdatePayload).toEqual({ avatarUrl: googleImage });
    expect(body.data.avatarUrl).toBe(googleImage);
  });
});
