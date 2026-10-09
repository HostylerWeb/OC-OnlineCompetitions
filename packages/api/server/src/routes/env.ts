import { success } from "@oc/api-infra/response";
import { isLocalDevRuntime } from "@oc/api-infra/runtime-config";
import { getEnv } from "@oc/env/server";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return success(c, {
    appUrl: getEnv("APP_URL") ?? "not set",
    isLocalDev: isLocalDevRuntime(),
    assetBaseUrl: getEnv("ASSET_BASE_URL") ?? "not set",
    timestamp: new Date().toISOString(),
  });
});

export default app;
