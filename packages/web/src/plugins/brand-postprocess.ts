/**
 * Astro integration: post-build branding pass.
 *
 * After Astro builds static HTML, this integration scans all .html files
 * and applies the same OpenCode → OpenSploit replacements. Catches anything
 * the rehype plugin missed (raw HTML strings, meta tags, inline scripts).
 */

import { replaceText } from "./rehype-brand"
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs"
import { join, extname } from "path"
import type { AstroIntegration } from "astro"

function processDirectory(dir: string, count = { files: 0, changed: 0 }) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      processDirectory(fullPath, count)
    } else if (extname(fullPath) === ".html") {
      count.files++
      const original = readFileSync(fullPath, "utf-8")
      const transformed = replaceText(original)
      if (transformed !== original) {
        writeFileSync(fullPath, transformed)
        count.changed++
      }
    }
  }

  return count
}

export function brandPostprocess(): AstroIntegration {
  return {
    name: "opensploit-brand-postprocess",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const outDir = dir.pathname
        const { files, changed } = processDirectory(outDir)
        console.log(`[brand] Post-processed ${changed}/${files} HTML files`)
      },
    },
  }
}

export default brandPostprocess
