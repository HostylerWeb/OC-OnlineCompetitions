import { getBool } from "@oc/env/server";

export function getLocalEnabledFromEnv(): boolean {
  return getBool("ENABLE_LOCAL_PAYMENT_METHOD", process.env.NODE_ENV !== "production");
}

export function getLocalEnvironmentFromEnv(): "sandbox" | "production" {
  const val = process.env.LOCAL_PAYMENT_ENVIRONMENT;
  return val === "production" ? "production" : "sandbox";
}

export function hasLocalEnvCredentials(): boolean {
  return true;
}
