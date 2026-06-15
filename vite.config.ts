import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "src/renderer")

// Tauri drives this config via the beforeDevCommand / beforeBuildCommand hooks.
// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  root,
  // Tauri expects a relative base so assets resolve from the bundled app.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": root,
    },
  },
  // Tauri injects TAURI_ENV_* vars; expose them alongside VITE_*.
  envPrefix: ["VITE_", "TAURI_ENV_"],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(root, "index.html"),
        splash: path.resolve(root, "splash/index.html"),
      },
    },
  },
})
