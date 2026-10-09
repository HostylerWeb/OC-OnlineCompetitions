/** MinIO / local asset origins for CSP in development (ports 9011 and 9021). */
export const DEV_ASSET_CSP_HOSTS =
  " http://localhost:9011 http://127.0.0.1:9011 http://localhost:9021 http://127.0.0.1:9021";

export function devAssetCspHosts(isDev: boolean): string {
  return isDev ? DEV_ASSET_CSP_HOSTS : "";
}
