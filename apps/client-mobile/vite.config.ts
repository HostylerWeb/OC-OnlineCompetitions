import path from "node:path";
import { hostylerConsoleNoticeIndexHtmlPlugin } from "@oc/utils";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [hostylerConsoleNoticeIndexHtmlPlugin(), react(), tailwindcss()],
  envPrefix: ["PUBLIC_ENV__", "VITE_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 3666,
    host: true,
  },
});
