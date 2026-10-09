import { devAssetCspHosts } from "@oc/env/server";
import { getBool } from "@oc/env/next";
import type { NextConfig } from "next";

const OLD_ADMIN_REDIRECTS: { source: string; destination: string }[] = [
  { source: "/admin", destination: "/" },
  { source: "/admin/competitions", destination: "/competitions" },
  { source: "/admin/orders", destination: "/orders" },
  { source: "/admin/users", destination: "/users" },
  { source: "/admin/winners", destination: "/winners" },
  { source: "/admin/categories", destination: "/categories" },
  { source: "/admin/referrals", destination: "/referrals" },
  { source: "/admin/promo-codes", destination: "/promo-codes" },
  { source: "/admin/payment-methods", destination: "/payment-methods" },
  { source: "/admin/instant-prizes", destination: "/instant-prizes" },
  { source: "/admin/instant-prize-wins", destination: "/instant-prize-wins" },
  { source: "/admin/homepage-layout", destination: "/homepage-layout" },
  { source: "/admin/compliance", destination: "/compliance-settings" },
  { source: "/admin/email-settings", destination: "/email-settings" },
  { source: "/admin/draw", destination: "/livestream/draws" },
  { source: "/admin/draw/full", destination: "/livestream/draws/full" },
  { source: "/admin/sentry-debug", destination: "/sentry-debug" },
  { source: "/admin/access-denied", destination: "/auth/access-denied" },
  { source: "/login", destination: "/auth/login" },
  { source: "/forgot-password", destination: "/auth/forgot-password" },
  { source: "/reset-password", destination: "/auth/reset-password" },
  { source: "/setup", destination: "/auth/setup" },
  { source: "/emergency", destination: "/auth/emergency" },
  { source: "/access-denied", destination: "/auth/access-denied" },
];

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,

  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.onlinecompetitions.co.uk" },
      { protocol: "https", hostname: "assets.staging.onlinecompetitions.co.uk" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "googleuserconsent.com" },
      { protocol: "http", hostname: "localhost", port: "9011", pathname: "/onlinecompetitions-assets/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "9011", pathname: "/onlinecompetitions-assets/**" },
    ],
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    formats: ["image/avif", "image/webp"],
    qualities: [25, 50, 75, 80, 100],
    deviceSizes: [480, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 2678400,
    maximumDiskCacheSize: 500_000_000,
  },

  transpilePackages: [
    "@oc/api-admin",
    "@oc/api-email",
    "@oc/auth-admin",
    "@oc/api-compliance",
    "@oc/api-db",
    "@oc/api-infra",
    "@oc/api-server",
    "@oc/api-referrals",
    "@oc/icons",
    "@oc/content",
    "@oc/types",
    "@oc/utils",
  ],
  serverExternalPackages: ["mongoose", "@ffmpeg-installer/ffmpeg", "sharp"],

  experimental: {
    cpus: 1,
    optimizePackageImports: [
      "cmdk",
      "sonner",
      "@oc/icons",
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "react-day-picker",
      "@tanstack/react-table",
      "zustand",
      "@sentry/react",
      "react-window",
      "react-zoom-pan-pinch",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "react-hook-form",
    ],
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 100,
    turbopackFileSystemCacheForBuild: false,
  },

  async headers() {
    const devAssetHosts = devAssetCspHosts(process.env.NODE_ENV !== "production");
    const csp =
      "base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; default-src 'self'; " +
      `media-src 'self' https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk${devAssetHosts}; ` +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.facebook.net https://challenges.cloudflare.com https://umami.onlinecompetitions.co.uk https://js.stripe.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "frame-src https://*.facebook.net https://challenges.cloudflare.com https://js.stripe.com; " +
      "worker-src 'self' blob:; child-src 'self' blob:; " +
      `connect-src 'self' https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk https://*.facebook.net https://challenges.cloudflare.com https://umami.onlinecompetitions.co.uk https://api.stripe.com${devAssetHosts}; ` +
      `img-src 'self' data: https://assets.onlinecompetitions.co.uk https://assets.staging.onlinecompetitions.co.uk https://lh3.googleusercontent.com${devAssetHosts}; ` +
      "font-src 'self' https://fonts.gstatic.com";

    return [
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/_next/image/:path*",
              headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
            },
          ]
        : []),
      ...(process.env.NODE_ENV !== "production"
        ? [
            {
              source: "/_next/static/:path*",
              headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
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
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },

  async redirects() {
    return OLD_ADMIN_REDIRECTS.map(({ source, destination }) => ({
      source,
      destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
