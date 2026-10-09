import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { authUrlIsHttps, isLocalDevRuntime, runtimeConfig } from "@oc/api-infra/runtime-config";
import { afterEach, describe, expect, test } from "vitest";

const RUNTIME_KEYS = [
  "SECURE_COOKIES",
  "LOG_ERROR_STACKS",
  "API_EXIT_ON_FATAL_ERROR",
  "API_REQUIRE_DB_AT_STARTUP",
  "ENABLE_LOCAL_PAYMENT_METHOD",
  "LOG_DB_CONNECT_DEBUG",
  "ALLOW_DEV_SCRIPTS",
  "APP_URL",
] as const;

function clearRuntimeEnv(): void {
  for (const key of RUNTIME_KEYS) {
    delete process.env[key];
  }
}

async function findForbiddenEnvReferences(dir: string): Promise<string[]> {
  const hits: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    if (entry.name === "globalSetup.ts") continue;

    const fullPath = join(entry.parentPath ?? dir, entry.name);
    const content = await readFile(fullPath, "utf8");
    if (/process\.env\.(?:NODE_ENV|CRON_ENABLED)/.test(content)) {
      hits.push(fullPath);
    }
  }

  return hits;
}

describe("runtime-config", () => {
  afterEach(() => {
    clearRuntimeEnv();
  });

  test("authUrlIsHttps derives from APP_URL", () => {
    process.env.APP_URL = "https://staging.onlinecompetitions.co.uk";
    expect(authUrlIsHttps()).toBe(true);

    process.env.APP_URL = "http://localhost:3111";
    expect(authUrlIsHttps()).toBe(false);
  });

  test("secureCookies defaults to HTTPS app URL when SECURE_COOKIES unset", () => {
    process.env.APP_URL = "https://onlinecompetitions.co.uk";
    expect(runtimeConfig.secureCookies).toBe(true);

    clearRuntimeEnv();
    process.env.APP_URL = "http://localhost:3111";
    expect(runtimeConfig.secureCookies).toBe(false);
  });

  test("isLocalDevRuntime is false for staging app URL", () => {
    process.env.APP_URL = "https://staging.onlinecompetitions.co.uk";
    expect(isLocalDevRuntime()).toBe(false);
  });
});

describe("runtime-config grep gate", () => {
  test("api/src must not reference NODE_ENV or CRON_ENABLED", async () => {
    const srcRoot = join(fileURLToPath(import.meta.url), "..", "..");
    const hits = await findForbiddenEnvReferences(srcRoot);
    expect(hits).toEqual([]);
  });
});
