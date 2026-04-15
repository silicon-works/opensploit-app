/**
 * Vite plugin: build-time branding for the console app.
 *
 * Transforms OpenCode → OpenSploit in the console app's source code
 * during Vite's build process. Only transforms .ts, .tsx, .js, .jsx files
 * that contain "opencode" or "OpenCode" strings.
 *
 * Imports replaceText from the web package's rehype-brand.ts for consistency.
 */

import type { Plugin } from "vite"
import { replaceText } from "../../../web/src/plugins/rehype-brand"

const TRANSFORM_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"]

export function viteBrand(): Plugin {
  return {
    name: "opensploit-vite-brand",
    enforce: "pre",
    transform(code, id) {
      // Only transform source files
      if (!TRANSFORM_EXTENSIONS.some((ext) => id.endsWith(ext))) return
      // Skip node_modules
      if (id.includes("node_modules")) return
      // Skip if no branding targets present
      if (!code.includes("opencode") && !code.includes("OpenCode") && !code.includes("Anomaly")) return

      const transformed = replaceText(code)
      if (transformed === code) return

      return { code: transformed, map: null }
    },
  }
}

export default viteBrand
