import { configuredAssetCspOrigins, devAssetCspHosts } from "@oc/env/server";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.onlinecompetitions.co.uk" },
      { protocol: "https", hostname: "assets.staging.onlinecompetitions.co.uk" },
      { protocol: "http", hostname: "localhost", port: "9011", pathname: "/onlinecompetitions-assets/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "9011", pathname: "/onlinecompetitions-assets/**" },
      { protocol: "http", hostname: "localhost", port: "9021", pathname: "/onlinecompetitions-assets/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "9021", pathname: "/onlinecompetitions-assets/**" },
    ],
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    formats: ["image/avif", "image/webp"],
    qualities: [25, 50, 75, 90, 100],
    deviceSizes: [480, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 2678400,
    maximumDiskCacheSize: 250_000_000,
  },

  transpilePackages: [
    "@oc/env",
    "@oc/types",
    "@oc/utils",
  ],

  serverExternalPackages: ["sharp"],

  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const devAssetHosts = devAssetCspHosts(isDev);
    const configuredAssetHosts = configuredAssetCspOrigins();
    const csp =
      "base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; default-src 'self'; " +
      `media-src 'self' https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk${configuredAssetHosts}${devAssetHosts}; ` +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://umami.onlinecompetitions.co.uk https://js.stripe.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "frame-src https://challenges.cloudflare.com https://js.stripe.com; " +
      "worker-src 'self' blob:; child-src 'self' blob:; " +
      `connect-src 'self' https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk https://challenges.cloudflare.com https://umami.onlinecompetitions.co.uk https://api.stripe.com${configuredAssetHosts}${devAssetHosts}; ` +
      `img-src 'self' data: blob: https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk${configuredAssetHosts}${devAssetHosts}; ` +
      "font-src 'self' https://fonts.gstatic.com data:";

    return [
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/_next/image/:path*",
              headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
            },
          ]
        : []),
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/:all*(svg|png|jpg|jpeg|webp|avif|woff2|css|js)",
              headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
            },
            {
              source: "/:path*/",
              headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
            },
          ]
        : []),
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
