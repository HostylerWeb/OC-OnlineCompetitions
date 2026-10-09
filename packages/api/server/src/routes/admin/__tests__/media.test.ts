import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import mediaApp, { resetMediaUsageCacheForTests } from "../media";

const __mock = vi.hoisted(() => ({
  adminId: "",
  adminEmail: "",
  uploadCalls: [] as Array<{
    key: string;
    contentType: string;
    bytes: number;
    extraHeaders: Record<string, string>;
  }>,
  deleteCalls: [] as string[],
  headResults: new Map<string, unknown | null>(),
  competitionDocs: [] as unknown[],
  instantPrizeDocs: [] as unknown[],
  winnerDocs: [] as unknown[],
  profileDocs: [] as unknown[],
}));

vi.mock("@oc/api-infra/db", () => ({
  default: vi.fn(async () => {}),
}));

vi.mock("@oc/api-server/middleware/auth", () => ({
  isPublicRoute: () => false,
  resolveSession: vi.fn(async () => ({})),
  sessionMiddleware: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireSession: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireVerifiedUser: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  getRequiredUserId: () => "test-user-id",
  auth: async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireAdmin: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("userId", __mock.adminId);
    c.set("email", __mock.adminEmail);
    await next();
  },
  requireManager: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>
  ) => {
    c.set("userId", __mock.adminId);
    c.set("email", __mock.adminEmail);
    await next();
  },
}));

vi.mock("@oc/api-storage/s3", () => ({
  buildAssetUrl: (key: string) => `http://assets.test/${key}`,
  getAssetBaseUrl: () => "http://assets.test",
  extractKeyFromUrl: (url: string) => {
    const prefix = "http://assets.test/";
    return url.startsWith(prefix) ? url.slice(prefix.length) : url;
  },
  deleteAsset: async (key: string) => {
    __mock.deleteCalls.push(key);
  },
  deleteObjects: async (keys: string[]) => {
    __mock.deleteCalls.push(...keys);
  },
  getPresignedUploadUrl: async (key: string, _ct: string) => `http://presigned.test/upload/${key}`,
  getPresignedDownloadUrl: async (key: string) => `http://presigned.test/download/${key}`,
  listAssets: async () => ({ assets: [], nextCursor: undefined }),
  uploadFile: async (
    key: string,
    body: Uint8Array | Blob,
    contentType: string,
    extraHeaders?: Record<string, string>
  ) => {
    const bytes = body instanceof Blob ? body.size : body.byteLength;
    __mock.uploadCalls.push({
      key,
      contentType,
      bytes,
      extraHeaders: extraHeaders ?? {},
    });
  },
  headObject: async (key: string) => {
    const v = __mock.headResults.get(key);
    if (v === undefined) return null;
    return v;
  },
}));

vi.mock("@oc/api-server/lib/media-converter/transform", () => ({
  transformUploadBytes: async (input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }) => ({ ...input, converted: false }),
}));

vi.mock("@oc/api-db/models", () => ({
  Competition: {
    find: (_query: Record<string, unknown>, _projection: string) => ({
      lean: async () => __mock.competitionDocs,
    }),
  },
  InstantPrize: {
    find: (_query: Record<string, unknown>, _projection: string) => ({
      lean: async () => __mock.instantPrizeDocs,
    }),
  },
  Winner: {
    find: (_query: Record<string, unknown>, _projection: string) => ({
      lean: async () => __mock.winnerDocs,
    }),
  },
  Profile: {
    find: (_query: Record<string, unknown>, _projection: string) => ({
      lean: async () => __mock.profileDocs,
    }),
  },
}));

const URL_BASE = "http://assets.test";
const IMG_URL = `${URL_BASE}/prizes/foo/x.jpg`;
const ORPHAN_URL = `${URL_BASE}/uploads/orphan.png`;
const INSTANT_URL = `${URL_BASE}/prizes/bar/iphone.jpg`;

describe("admin media routes — /usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMediaUsageCacheForTests();
    __mock.adminId = new Types.ObjectId().toString();
    __mock.adminEmail = "admin@onlinecompetitions.test";
    __mock.uploadCalls = [];
    __mock.deleteCalls = [];
    __mock.headResults = new Map();
    __mock.competitionDocs = [];
    __mock.instantPrizeDocs = [];
    __mock.winnerDocs = [];
    __mock.profileDocs = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns usage bucket for an image used by a competition", async () => {
    const compId = new Types.ObjectId();
    __mock.competitionDocs = [
      {
        _id: compId,
        slug: "luxury-suv",
        title: "Luxury SUV",
        imageUrl: IMG_URL,
        heroImageUrl: undefined,
        prizeImageUrl: undefined,
        prizeImages: [],
        prizeImagesSource: undefined,
        prizeImagesRemote: [],
      },
    ];

    const res = await mediaApp.request(
      `http://localhost/usage?urls=${encodeURIComponent(IMG_URL)}`
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.usages[IMG_URL]).toHaveLength(1);
    expect(body.data.usages[IMG_URL][0]).toMatchObject({
      kind: "competition",
      id: compId.toString(),
      label: "Luxury SUV",
      url: `/admin/competitions/${compId.toString()}`,
    });
  });

  test("returns empty bucket for an orphan URL", async () => {
    __mock.competitionDocs = [];
    __mock.instantPrizeDocs = [];
    __mock.winnerDocs = [];
    __mock.profileDocs = [];

    const res = await mediaApp.request(
      `http://localhost/usage?urls=${encodeURIComponent(ORPHAN_URL)}`
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.usages[ORPHAN_URL]).toEqual([]);
  });

  test("returns 400 when urls query is missing", async () => {
    const res = await mediaApp.request("http://localhost/usage");
    expect(res.status).toBe(400);
  });

  test("collects usages across competition, instantPrize and winner collections", async () => {
    const compId = new Types.ObjectId();
    const ipId = new Types.ObjectId();
    const winnerId = new Types.ObjectId();
    __mock.competitionDocs = [
      {
        _id: compId,
        slug: "suv",
        title: "Luxury SUV",
        imageUrl: IMG_URL,
        prizeImages: [],
        prizeImagesRemote: [],
      },
    ];
    __mock.instantPrizeDocs = [{ _id: ipId, name: "iPhone 17 Pro Max", images: [INSTANT_URL] }];
    __mock.winnerDocs = [{ _id: winnerId, fullName: "Alex Carter", prizeImageUrl: IMG_URL }];

    const res = await mediaApp.request(
      `http://localhost/usage?urls=${encodeURIComponent(`${IMG_URL},${INSTANT_URL}`)}`
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.usages[IMG_URL]).toHaveLength(2);
    const kinds = body.data.usages[IMG_URL].map((u: { kind: string }) => u.kind).sort();
    expect(kinds).toEqual(["competition", "winner"]);
    expect(body.data.usages[INSTANT_URL]).toHaveLength(1);
    expect(body.data.usages[INSTANT_URL][0]).toMatchObject({
      kind: "instantPrize",
      label: "iPhone 17 Pro Max",
    });
  });
});

describe("admin media routes — /metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mock.adminId = new Types.ObjectId().toString();
    __mock.adminEmail = "admin@onlinecompetitions.test";
    __mock.uploadCalls = [];
    __mock.deleteCalls = [];
    __mock.headResults = new Map();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns dimensions when S3 metadata is present", async () => {
    __mock.headResults.set("prizes/foo/x.jpg", {
      contentType: "image/jpeg",
      contentLength: 12345,
      lastModified: "Mon, 01 Jan 2024 00:00:00 GMT",
      etag: "abc",
      metadata: {
        "x-amz-meta-width": "1920",
        "x-amz-meta-height": "1080",
        "x-amz-meta-uploader-id": "user-1",
        "x-amz-meta-uploader-email": "u@example.com",
      },
    });

    const res = await mediaApp.request(
      `http://localhost/metadata?keys=${encodeURIComponent("prizes/foo/x.jpg")}`
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.metadata["prizes/foo/x.jpg"]).toMatchObject({
      contentType: "image/jpeg",
      size: 12345,
      lastModified: "Mon, 01 Jan 2024 00:00:00 GMT",
      width: 1920,
      height: 1080,
      uploaderId: "user-1",
      uploaderEmail: "u@example.com",
    });
  });

  test("returns null for missing keys instead of 404", async () => {
    const res = await mediaApp.request(
      `http://localhost/metadata?keys=${encodeURIComponent("uploads/missing.png")}`
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.metadata["uploads/missing.png"]).toBeNull();
  });

  test("returns 400 when keys query is missing", async () => {
    const res = await mediaApp.request("http://localhost/metadata");
    expect(res.status).toBe(400);
  });
});

describe("admin media routes — /delete-batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mock.adminId = new Types.ObjectId().toString();
    __mock.adminEmail = "admin@onlinecompetitions.test";
    __mock.uploadCalls = [];
    __mock.deleteCalls = [];
    __mock.competitionDocs = [];
    __mock.instantPrizeDocs = [];
    __mock.winnerDocs = [];
    __mock.profileDocs = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("skips in-use keys (returns success=false, error=in_use)", async () => {
    const compId = new Types.ObjectId();
    __mock.competitionDocs = [
      {
        _id: compId,
        slug: "suv",
        title: "Luxury SUV",
        imageUrl: IMG_URL,
        prizeImages: [],
        prizeImagesRemote: [],
      },
    ];

    const res = await mediaApp.request("http://localhost/delete-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys: ["prizes/foo/x.jpg"] }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.results).toHaveLength(1);
    expect(body.data.results[0]).toEqual({
      key: "prizes/foo/x.jpg",
      success: false,
      error: "in_use",
    });
    expect(__mock.deleteCalls).toHaveLength(0);
  });

  test("deletes orphan keys", async () => {
    __mock.competitionDocs = [];
    __mock.instantPrizeDocs = [];
    __mock.winnerDocs = [];
    __mock.profileDocs = [];

    const res = await mediaApp.request("http://localhost/delete-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys: ["uploads/a.png", "uploads/b.png"] }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.results).toHaveLength(2);
    expect(body.data.results.every((r: { success: boolean }) => r.success)).toBe(true);
    expect(__mock.deleteCalls.sort()).toEqual(["uploads/a.png", "uploads/b.png"]);
  });

  test("force:true bypasses in-use check", async () => {
    const compId = new Types.ObjectId();
    __mock.competitionDocs = [
      {
        _id: compId,
        slug: "suv",
        title: "Luxury SUV",
        imageUrl: IMG_URL,
        prizeImages: [],
        prizeImagesRemote: [],
      },
    ];

    const res = await mediaApp.request("http://localhost/delete-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys: ["prizes/foo/x.jpg"], force: true }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.results).toHaveLength(1);
    expect(body.data.results[0]).toEqual({ key: "prizes/foo/x.jpg", success: true });
    expect(__mock.deleteCalls).toEqual(["prizes/foo/x.jpg"]);
  });

  test("rejects invalid key prefix", async () => {
    const res = await mediaApp.request("http://localhost/delete-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys: ["frames/abc/frame_0001.jpg"] }),
    });
    expect(res.status).toBe(400);
  });
});

describe("admin media routes — /upload metadata capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __mock.adminId = new Types.ObjectId().toString();
    __mock.adminEmail = "admin@onlinecompetitions.test";
    __mock.uploadCalls = [];
    __mock.deleteCalls = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("captures uploader-id and uploader-email in S3 metadata headers", async () => {
    // 1x1 transparent PNG
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const formData = new FormData();
    formData.append("file", new File([png], "tiny.png", { type: "image/png" }));

    const res = await mediaApp.request("http://localhost/upload", {
      method: "POST",
      body: formData,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(__mock.uploadCalls).toHaveLength(1);
    const call = __mock.uploadCalls[0]!;
    expect(call.contentType).toBe("image/png");
    expect(call.extraHeaders["x-amz-meta-uploader-id"]).toBe(__mock.adminId);
    expect(call.extraHeaders["x-amz-meta-uploader-email"]).toBe("admin@onlinecompetitions.test");
    expect(call.extraHeaders["x-amz-meta-uploaded-at"]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(call.extraHeaders["x-amz-meta-width"]).toBe("1");
    expect(call.extraHeaders["x-amz-meta-height"]).toBe("1");
    expect(body.data.key).toMatch(/^uploads\/\d+-[a-z0-9]+\.png$/);
    expect(body.data.publicUrl).toMatch(/^http:\/\/assets\.test\/uploads\//);
  });

  test("omits dimension headers for non-image content", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3, 4])], "doc.pdf", { type: "application/pdf" })
    );

    const res = await mediaApp.request("http://localhost/upload", {
      method: "POST",
      body: formData,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(__mock.uploadCalls).toHaveLength(1);
    const call = __mock.uploadCalls[0]!;
    expect(call.extraHeaders["x-amz-meta-uploader-id"]).toBe(__mock.adminId);
    expect(call.extraHeaders["x-amz-meta-width"]).toBeUndefined();
    expect(call.extraHeaders["x-amz-meta-height"]).toBeUndefined();
    expect(body.data.key).toMatch(/^uploads\/\d+-[a-z0-9]+\.pdf$/);
  });
});
