import {
  buildAssetUrl,
  extractKeyFromUrl,
  getAssetBaseUrl,
  resetS3ClientForTests,
} from "@oc/api-storage/s3";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../../config/asset-storage.mjs", () => ({
  assetProfiles: {
    local: { S3_BUCKET: "", S3_ENDPOINT: "", ASSET_BASE_URL: "" },
    staging: { S3_BUCKET: "", S3_ENDPOINT: "", ASSET_BASE_URL: "" },
  },
}));

const assetProfiles = {
  local: { S3_BUCKET: "", S3_ENDPOINT: "", ASSET_BASE_URL: "http://localhost:9011/local" },
  staging: { S3_BUCKET: "", S3_ENDPOINT: "", ASSET_BASE_URL: "http://localhost:9011/staging" },
};

const ENV_KEYS = [
  "ASSET_BASE_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "AWS_REGION",
  "S3_OBJECT_ACL",
  "S3_FORCE_PATH_STYLE",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function saveEnv(): void {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  resetS3ClientForTests();
}

function applyProfile(profile: "local" | "staging"): void {
  const { S3_BUCKET, S3_ENDPOINT, ASSET_BASE_URL, S3_OBJECT_ACL } = assetProfiles[profile];
  process.env.S3_BUCKET = S3_BUCKET;
  process.env.S3_ENDPOINT = S3_ENDPOINT;
  process.env.ASSET_BASE_URL = ASSET_BASE_URL;
  if (S3_OBJECT_ACL) process.env.S3_OBJECT_ACL = S3_OBJECT_ACL;
  else delete process.env.S3_OBJECT_ACL;
}

describe("S3 asset URL helpers", () => {
  afterEach(() => {
    restoreEnv();
  });

  test("local profile uses bucket path prefix in public URLs", () => {
    saveEnv();
    applyProfile("local");

    expect(getAssetBaseUrl()).toBe(assetProfiles.local.ASSET_BASE_URL);
    expect(buildAssetUrl("uploads/photo.png")).toBe(
      `${assetProfiles.local.ASSET_BASE_URL}/uploads/photo.png`
    );
    expect(buildAssetUrl("/uploads/photo.png")).toBe(
      `${assetProfiles.local.ASSET_BASE_URL}/uploads/photo.png`
    );
  });

  test("staging profile uses bucket path prefix in public URLs", () => {
    saveEnv();
    applyProfile("staging");

    expect(getAssetBaseUrl()).toBe(assetProfiles.staging.ASSET_BASE_URL);
    expect(buildAssetUrl("prizes/macbook/123.png")).toBe(
      `${assetProfiles.staging.ASSET_BASE_URL}/prizes/macbook/123.png`
    );
  });

  test("extractKeyFromUrl reverses buildAssetUrl for both profiles", () => {
    saveEnv();
    applyProfile("local");
    const localUrl = buildAssetUrl("uploads/a.png");
    expect(extractKeyFromUrl(localUrl)).toBe("uploads/a.png");

    applyProfile("staging");
    const stagingUrl = buildAssetUrl("uploads/a.png");
    expect(extractKeyFromUrl(stagingUrl)).toBe("uploads/a.png");
  });

  test("ASSET_BASE_URL strips trailing slash", () => {
    saveEnv();
    process.env.ASSET_BASE_URL = "https://cdn.example.com/bucket/";
    expect(getAssetBaseUrl()).toBe("https://cdn.example.com/bucket");
    expect(buildAssetUrl("x.png")).toBe("https://cdn.example.com/bucket/x.png");
  });
});

describe("S3 endpoint construction (buildEndpoint)", () => {
  afterEach(() => {
    restoreEnv();
  });

  async function importFresh(): Promise<{
    getPresignedUploadUrl: (key: string, contentType: string) => Promise<string>;
  }> {
    vi.resetModules();
    const mod = await import("@oc/api-storage/s3");
    return { getPresignedUploadUrl: mod.getPresignedUploadUrl };
  }

  test("appends S3_BUCKET to bare S3_ENDPOINT (R2 staging case)", async () => {
    saveEnv();
    delete process.env.ASSET_BASE_URL;
    process.env.S3_ENDPOINT = "https://assets.onlinecompetitions.co.uk";
    process.env.S3_BUCKET = "onlinecompetitions-assets-staging";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

    const { getPresignedUploadUrl: presign } = await importFresh();
    const url = await presign("prizes/foo/abc.png", "image/png");

    const parsed = new URL(url);
    expect(`${parsed.host}${parsed.pathname}`).toBe(
      "assets.onlinecompetitions.co.uk/onlinecompetitions-assets-staging/prizes/foo/abc.png"
    );
  });

  test("appends S3_BUCKET to S3_ENDPOINT with trailing slash", async () => {
    saveEnv();
    delete process.env.ASSET_BASE_URL;
    process.env.S3_ENDPOINT = "http://localhost:9011/";
    process.env.S3_BUCKET = "onlinecompetitions-assets";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "k";
    process.env.AWS_SECRET_ACCESS_KEY = "s";

    const { getPresignedUploadUrl: presign } = await importFresh();
    const url = await presign("uploads/x.png", "image/png");

    const parsed = new URL(url);
    expect(`${parsed.host}${parsed.pathname}`).toBe("localhost:9011/onlinecompetitions-assets/uploads/x.png");
  });

  test("does not double-prefix when bucket already in endpoint path", async () => {
    saveEnv();
    delete process.env.ASSET_BASE_URL;
    process.env.S3_ENDPOINT = "https://assets.onlinecompetitions.co.uk/onlinecompetitions-assets-staging";
    process.env.S3_BUCKET = "onlinecompetitions-assets-staging";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "k";
    process.env.AWS_SECRET_ACCESS_KEY = "s";

    const { getPresignedUploadUrl: presign } = await importFresh();
    const url = await presign("prizes/x.png", "image/png");

    const parsed = new URL(url);
    expect(`${parsed.host}${parsed.pathname}`).toBe(
      "assets.onlinecompetitions.co.uk/onlinecompetitions-assets-staging/prizes/x.png"
    );
  });

  test("strips trailing slash from S3_ENDPOINT before appending bucket", async () => {
    saveEnv();
    delete process.env.ASSET_BASE_URL;
    process.env.S3_ENDPOINT = "https://assets.onlinecompetitions.co.uk/";
    process.env.S3_BUCKET = "onlinecompetitions-assets-staging";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "k";
    process.env.AWS_SECRET_ACCESS_KEY = "s";

    const { getPresignedUploadUrl: presign } = await importFresh();
    const url = await presign("prizes/x.png", "image/png");

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://assets.onlinecompetitions.co.uk/onlinecompetitions-assets-staging/prizes/x.png"
    );
  });
});
