import "@oc/env/server";

import path from "node:path";
import { hostylerConsoleNoticeIndexHtmlPlugin } from "../../packages/utils/src/vite-hostyler-console-notice-plugin.ts";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import vike from "vike/plugin";
import { defineConfig } from "vite";

if ((process.env.FRAMEWORK || "").toLowerCase() !== "vike") {
  console.warn(`[vite] Expected FRAMEWORK=vike, got: ${process.env.FRAMEWORK}`);
}

export default defineConfig({
  plugins: [hostylerConsoleNoticeIndexHtmlPlugin(), react(), tailwindcss(), vike()],
  server: {
    allowedHosts: ["debug.onlinecompetitions.co.uk"],
  },
  envPrefix: ["PUBLIC_ENV__", "VITE_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@oc/utils": path.resolve(__dirname, "../../packages/utils/src/index.ts"),
      "@oc/utils/company": path.resolve(__dirname, "../../packages/utils/src/company.ts"),
      "@oc/utils/brand": path.resolve(__dirname, "../../packages/utils/src/brand.ts"),
      "@oc/utils/social": path.resolve(__dirname, "../../packages/utils/src/social.ts"),
    },
  },
  ssr: {
    noExternal: [
      "@oc/api-client",
      "@oc/api-db",
      "@oc/api-server",
      "@oc/auth-client",
      "@oc/icons",
      "@oc/content",
      "@oc/types",
      "@oc/utils",
      "@oc/auth-admin",
    ],
    external: [
      "react",
      "react-dom",
      "mongoose",
      "sharp",
      "fluent-ffmpeg",
      "web-push",
      "mongodb-memory-server",
    ],
  },
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        if (
          warning.code === "SOURCEMAP_ERROR" &&
          warning.message.includes("resolve original location")
        )
          return;
        defaultHandler(warning);
      },
    },
  },
});
