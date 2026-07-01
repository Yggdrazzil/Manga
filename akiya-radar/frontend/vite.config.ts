/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// PREVIEW=1 produces a single self-contained HTML file (assets inlined) so the
// app can be previewed without a server. The bundle is emitted as a classic
// IIFE script (not an ES module) so it runs even in restrictive inline-render
// sandboxes (e.g. Claude Code's file preview panel).
const isPreview = process.env.PREVIEW === "1";
const previewPlugins = isPreview
  ? [(await import("vite-plugin-singlefile")).viteSingleFile()]
  : [];
const previewBuild = isPreview
  ? { modulePreload: false as const, cssCodeSplit: false, assetsInlineLimit: 100_000_000 }
  : {};

export default defineConfig({
  plugins: [react(), ...previewPlugins],
  build: previewBuild,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: Number(process.env.FRONTEND_PORT) || 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
