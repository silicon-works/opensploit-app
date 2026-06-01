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
  ["OPENCODE", "OPENSPLOIT"],
  ["OpenCode", "OpenSploit"],
  ["opencode", "opensploit"],
  ["ANOMALY INNOVATIONS, INC.", "SILICON WORKS LTD"],
  ["Anomaly Innovations, Inc.", "Silicon Works Ltd"],
  ["Anomaly Innovations", "Silicon Works Ltd"],
  [/\bAnomaly\b/g, "Silicon Works"],
  ["anoma.ly", "opensploit.ai"],
  // Legal page content — replace coding-assistant language with security-tool language
  ["AI-powered coding agent that helps you write, understand, and modify code", "AI-powered penetration testing platform that helps security professionals conduct authorized security assessments"],
  ["coding agent", "security testing platform"],
  [/\bZen\b/g, "Pro"],
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
    enforce: "post",
    transform(code, id) {
      if (!TRANSFORM_EXTENSIONS.some((ext) => id.endsWith(ext))) return
      if (id.includes("node_modules")) return
      if (!code.includes("opencode") && !code.includes("OpenCode") && !code.includes("OPENCODE") && !code.includes("Anomaly")) return

      const transformed = replaceText(code)
      if (transformed === code) return

      return { code: transformed, map: null }
    },
    // Post-build pass: certain build outputs bypass Vite's transform pipeline
    // entirely. Solid's SSR compiler embeds JSX text into template literal
    // arrays in the server .mjs chunks; Vite's CSS pipeline emits standalone
    // .css asset files without firing user `transform` hooks (verified
    // empirically — adding ".css" to TRANSFORM_EXTENSIONS was a no-op).
    // Both need the same direct file-rewrite treatment.
    async closeBundle() {
      const { readdirSync, readFileSync, writeFileSync, statSync } = await import("fs")
      const { join, extname } = await import("path")

      function rewriteWalk(dir: string, ext: string): number {
        let changed = 0
        try {
          for (const entry of readdirSync(dir)) {
            const full = join(dir, entry)
            const st = statSync(full)
            if (st.isDirectory()) {
              changed += rewriteWalk(full, ext)
            } else if (extname(full) === ext) {
              const original = readFileSync(full, "utf-8")
              if (
                !original.includes("opencode") &&
                !original.includes("OpenCode") &&
                !original.includes("OPENCODE") &&
                !original.includes("Anomaly") &&
                !original.includes("anoma.ly")
              )
                continue
              const result = replaceText(original)
              if (result !== original) {
                writeFileSync(full, result)
                changed++
              }
            }
          }
        } catch {
          // Output dir might not exist during dev
        }
        return changed
      }

      const chunks = rewriteWalk(join(process.cwd(), ".output", "server", "chunks"), ".mjs")
      if (chunks > 0) console.log(`[brand] Post-processed ${chunks} server chunks`)

      // CSS — route stylesheets hard-code [data-page="opencode"] which scopes
      // every CSS variable (colors, spacing, max-width). Without rewriting
      // these to "opensploit", the TSX (already rewritten by `transform`) and
      // CSS go out of sync — the variable scope never matches the DOM and
      // the page renders unstyled.
      const css = rewriteWalk(join(process.cwd(), ".output", "public"), ".css")
      if (css > 0) console.log(`[brand] Post-processed ${css} CSS files`)

      // Client JS — same bypass as CSS. Vite's transform hook fires on .tsx
      // source files, but the resulting client-side route chunks emitted to
      // .output/public/_build/assets/*.js sometimes still contain unrewritten
      // literals (e.g. `data-page="opencode"` in the home route bundle). On
      // SSR the corrected attribute serves; on client-side route navigation
      // (Solid Router) the home component re-renders from the client bundle,
      // writes the wrong attribute, and the CSS variable scope detaches —
      // the page goes unstyled until a hard refresh re-serves SSR.
      const js = rewriteWalk(join(process.cwd(), ".output", "public"), ".js")
      if (js > 0) console.log(`[brand] Post-processed ${js} client JS chunks`)
    },
  }
}

export default viteBrand
