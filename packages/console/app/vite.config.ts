import { defineConfig, PluginOption } from "vite"
import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import { viteBrand } from "./src/plugins/vite-brand"

export default defineConfig({
  plugins: [
    viteBrand(),
    solidStart({
      middleware: "./src/middleware.ts",
    }) as PluginOption,
    nitro({
      compatibilityDate: "2024-09-19",
      preset: "cloudflare_module",
      cloudflare: {
        nodeCompat: true,
      },
      routeRules: {
        // Registry files served via 302 redirect to mcp-tools GitHub Releases
        "/registry.yaml": {
          redirect: "https://github.com/silicon-works/mcp-tools/releases/download/registry-latest/registry.yaml",
        },
        "/registry.sha256": {
          redirect: "https://github.com/silicon-works/mcp-tools/releases/download/registry-latest/registry.sha256",
        },
        "/registry.lance.tar.gz": {
          redirect: "https://github.com/silicon-works/mcp-tools/releases/download/registry-latest/registry.lance.tar.gz",
        },
        // Hide pages we don't need yet
        "/brand": { redirect: "/" },
        "/brand/**": { redirect: "/" },
      },
    }),
  ],
  server: {
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      external: ["cloudflare:workers"],
    },
    minify: false,
  },
})
