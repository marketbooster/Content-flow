import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// VITE_PREVIEW=1: statische preview (bijv. als claude.ai-pagina) met relatieve paden en vaste bestandsnamen.
const preview = Boolean(process.env.VITE_PREVIEW);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: preview ? "./" : "/",
  build: preview
    ? {
        outDir: "dist-preview",
        rollupOptions: {
          output: { entryFileNames: "assets/app.js", chunkFileNames: "assets/[name].js", assetFileNames: "assets/app.[ext]" },
        },
      }
    : {},
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
} as never);
