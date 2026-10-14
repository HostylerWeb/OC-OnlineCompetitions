/** MinIO / local asset origins for CSP in development (ports 9011 and 9021). */
export const DEV_ASSET_CSP_HOSTS =
  " http://localhost:9011 http://127.0.0.1:9011 http://localhost:9021 http://127.0.0.1:9021";

export function devAssetCspHosts(isDev: boolean): string {
  return isDev ? DEV_ASSET_CSP_HOSTS : "";
}

const ASSET_URL_ENV_KEYS = [
  "ASSET_BASE_URL",
  "NEXT_PUBLIC_ASSET_BASE_URL",
  "PUBLIC_ENV__ASSET_BASE_URL",
] as const;

function addCspOrigin(origins: Set<string>, value: string | undefined): void {
  if (!value?.trim()) return;
  try {
    const { protocol, host } = new URL(value.trim());
    origins.add(`${protocol}//${host}`);
  } catch {
    // ignore invalid URLs
  }
}

/**
 * Extra img/media/connect CSP origins from ASSET_BASE_URL (and related env).
 * Off by default — set CSP_ALLOW_ENV_ASSET_ORIGINS=true only on temporary/demo hosts
 * (e.g. Hostinger) until assets are on assets.*. Production local/staging stays strict.
 */
export function configuredAssetCspOrigins(): string {
  const allowed =
    process.env.CSP_ALLOW_ENV_ASSET_ORIGINS === "true" ||
    process.env.CSP_ALLOW_ENV_ASSET_ORIGINS === "1";
  if (!allowed) return "";

  const origins = new Set<string>();
  for (const key of ASSET_URL_ENV_KEYS) {
    addCspOrigin(origins, process.env[key]);
  }
  addCspOrigin(
    origins,
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_ENV__APP_URL
  );
  if (origins.size === 0) return "";
  return ` ${[...origins].join(" ")}`;
}
