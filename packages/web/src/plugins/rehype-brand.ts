/**
 * Build-time branding transform for the OpenSploit website.
 *
 * Replaces "OpenCode" → "OpenSploit" (and related strings) in rendered HTML.
 * Used as a rehype plugin in Astro and imported by the other transform files
 * (brand-postprocess.ts, vite-brand.ts) as the single source of truth.
 *
 * Approach:
 * 1. Save protected patterns as null-byte placeholders (prevents mangling)
 * 2. Apply replacements most-specific-first (prevents partial matches)
 * 3. Restore protected patterns from placeholders
 */

import { visit } from "unist-util-visit"
import type { Root } from "hast"

// ---------------------------------------------------------------------------
// Protected patterns — never replaced even when they contain "opencode"
// ---------------------------------------------------------------------------

const PROTECTED = [
  "@opencode-ai/",      // npm scope
  "OPENCODE_",          // env var prefix
  "packages/opencode",  // internal path
  "built on OpenCode",  // attribution
  "fork of OpenCode",   // attribution
  "createOpencodeClient", // SDK function
  "OpencodeClient",     // SDK type
  "opencode-comparison",// asset filenames without opensploit equivalents
  "opencode-desktop",   // asset filenames
  "opencode-min",       // asset filenames
  "opencode-poster",    // asset filenames
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
]

// ---------------------------------------------------------------------------
// Core replacement function — exported for use by other transform files
// ---------------------------------------------------------------------------

export function replaceText(input: string): string {
  if (!input) return input

  // 1. Save protected matches as placeholders
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

  // 2. Apply replacements (most-specific-first ordering prevents partial matches)
  for (const [from, to] of REPLACEMENTS) {
    if (from instanceof RegExp) {
      text = text.replace(from, to)
    } else {
      // Global string replacement
      while (text.includes(from)) {
        text = text.replace(from, to)
      }
    }
  }

  // 3. Restore protected patterns
  for (let i = 0; i < placeholders.length; i++) {
    text = text.replace(`\0${i}\0`, placeholders[i])
  }

  return text
}

// ---------------------------------------------------------------------------
// Rehype plugin — transforms Astro-rendered HTML AST
// ---------------------------------------------------------------------------

export function rehypeBrand() {
  return (tree: Root) => {
    visit(tree, "text", (node: any) => {
      if (typeof node.value === "string") {
        node.value = replaceText(node.value)
      }
    })

    // Also transform attribute values (href, title, alt, content, etc.)
    visit(tree, "element", (node: any) => {
      if (!node.properties) return
      for (const [key, value] of Object.entries(node.properties)) {
        if (typeof value === "string") {
          const replaced = replaceText(value)
          if (replaced !== value) {
            node.properties[key] = replaced
          }
        }
      }
    })
  }
}

export default rehypeBrand
