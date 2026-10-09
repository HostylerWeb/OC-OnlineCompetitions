import { getEnv } from "@oc/env/server";

/** Fixed Better Auth origin allowlist — never mirror arbitrary `Origin` headers (client/admin H1). */
export function getStaticTrustedOrigins(appUrl: string): string[] {
  const origins = new Set<string>();
  const base = appUrl.replace(/\/$/, "");
  if (base) origins.add(base);

  try {
    const parsed = new URL(base);
    const host = parsed.hostname;
    const portSuffix = parsed.port ? `:${parsed.port}` : "";
    if (host.startsWith("www.")) {
      origins.add(`${parsed.protocol}//${host.slice(4)}${portSuffix}`);
    } else {
      origins.add(`${parsed.protocol}//www.${host}${portSuffix}`);
    }
    if (host === "localhost" || host === "127.0.0.1") {
      origins.add(`http://localhost${portSuffix}`);
      origins.add(`http://127.0.0.1${portSuffix}`);
    }
  } catch {
    // ignore malformed APP_URL
  }

  origins.add("capacitor://localhost");
  origins.add("http://localhost");
  origins.add("http://127.0.0.1");

  const staging = process.env.STAGING_APP_URL?.trim();
  if (staging) origins.add(staging.replace(/\/$/, ""));

  const extra = process.env.AUTH_TRUSTED_ORIGINS_EXTRA?.trim();
  if (extra) {
    for (const part of extra.split(",")) {
      const o = part.trim().replace(/\/$/, "");
      if (o) origins.add(o);
    }
  }

  return [...origins];
}

export function createTrustedOriginsResolver(appUrl: string) {
  const allowed = getStaticTrustedOrigins(appUrl);
  return (_request?: Request) => allowed;
}
