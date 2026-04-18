/**
 * Vite plugin: build-time branding for the console app.
 *
 * Transforms OpenCode → OpenSploit in the console app's source code
 * during Vite's build process. Only transforms .ts, .tsx, .js, .jsx files
 * that contain "opencode" or "OpenCode" strings.
 *
 * The replaceText function is duplicated from packages/web/src/plugins/rehype-brand.ts
 * because cross-package imports don't resolve during the console's vite build.
 */

import type { Plugin } from "vite"

// ---------------------------------------------------------------------------
// Protected patterns — never replaced even when they contain "opencode"
// ---------------------------------------------------------------------------

const PROTECTED = [
  "@opencode-ai/",
  "OPENCODE_",
  "packages/opencode",
  "built on OpenCode",
  "fork of OpenCode",
  "createOpencodeClient",
  "OpencodeClient",
  // Asset filenames that don't have opensploit equivalents yet
  "opencode-comparison",
  "opencode-desktop",
  "opencode-min",
  "opencode-poster",
]

// ---------------------------------------------------------------------------
// Replacement patterns — ordered most-specific-first
// ---------------------------------------------------------------------------

const REPLACEMENTS: Array<[string | RegExp, string]> = [
  ["opencode.ai", "opensploit.ai"],
  ["anomalyco/tap/opencode", "silicon-works/tap/opensploit"],
  ["ghcr.io/anomalyco/opencode", "ghcr.io/silicon-works/opensploit"],
  ["anomalyco/opencode", "silicon-works/opensploit"],
  ["anomalyco", "silicon-works"],
  ["opencode-ai", "opensploit"],
  ["opencode-bin", "opensploit-bin"],
  [/\bOpencode\b/g, "OpenSploit"],
  ["OpenCode", "OpenSploit"],
  ["opencode", "opensploit"],
  ["Anomaly Innovations", "Silicon Works Ltd"],
  [/\bAnomaly\b/g, "Silicon Works"],
  ["anoma.ly", "opensploit.ai"],
  // Hide brand assets button in header context menu
  [/(<button[^>]*onClick=\{[^}]*route\("\/brand"\)[^}]*\}>[\s\S]*?<\/button>)/, ""],
]

function replaceText(input: string): string {
  if (!input) return input

  const placeholders: string[] = []
  let text = input

  for (const pattern of PROTECTED) {
    let idx: number
    while ((idx = text.indexOf(pattern)) !== -1) {
      const placeholder = `\0${placeholders.length}\0`
      placeholders.push(pattern)
      text = text.slice(0, idx) + placeholder + text.slice(idx + pattern.length)
    }
  }

  for (const [from, to] of REPLACEMENTS) {
    if (from instanceof RegExp) {
      text = text.replace(from, to)
    } else {
      while (text.includes(from)) {
        text = text.replace(from, to)
      }
    }
  }

  for (let i = 0; i < placeholders.length; i++) {
    text = text.replace(`\0${i}\0`, placeholders[i])
  }

  return text
}

// ---------------------------------------------------------------------------
// Vite plugin
// ---------------------------------------------------------------------------

const TRANSFORM_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"]

export function viteBrand(): Plugin {
  return {
    name: "opensploit-vite-brand",
    enforce: "pre",
    transform(code, id) {
      if (!TRANSFORM_EXTENSIONS.some((ext) => id.endsWith(ext))) return
      if (id.includes("node_modules")) return
      if (!code.includes("opencode") && !code.includes("OpenCode") && !code.includes("Anomaly")) return

      const transformed = replaceText(code)
      if (transformed === code) return

      return { code: transformed, map: null }
    },
  }
}

export default viteBrand
