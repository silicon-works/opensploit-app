import { createMiddleware } from "@solidjs/start/middleware"
import { LOCALE_HEADER, cookie, fromPathname, strip } from "~/lib/language"
import { normalizeReferralCode, referralCookie } from "~/lib/referral-invite"

// Paid-product surfaces (Zen / Go / Black / Stripe) are deferred until
// Connect launches with a fine-tuned model. Routes stay in the codebase
// so upstream merges remain low-conflict; we hide them at the edge by
// rewriting their URL to a non-existent path so the framework's natural
// 404 fallback handles them.
//
// Why rewrite (not `return new Response(...)`): SolidStart's middleware
// `return Response` only reliably short-circuits when no route file
// matches the original path. For routes that DO exist (e.g. routes/zen/
// index.tsx), the route handler still loads and runs after middleware
// returns, hitting Resource.X.prop chains that throw under the stub
// resource resolver (paid-product Resources are intentionally unset) —
// the throw escapes Cloudflare's Worker boundary as a 1101 instead of
// our 404. Rewriting the URL keeps the route resolver from ever finding
// the original handler. Note `/enterprise` is NOT here — it's a sales
// contact form, not a paid product, so it stays accessible.
const HIDDEN_PATHS = ["/zen", "/go", "/black", "/stripe"]

export default createMiddleware({
  onRequest(event) {
    const url = new URL(event.request.url)
    const locale = fromPathname(url.pathname)
    if (locale) {
      url.pathname = strip(url.pathname)
      const request = new Request(url, event.request)
      request.headers.set(LOCALE_HEADER, locale)
      event.request = request
      event.response.headers.append("set-cookie", cookie(locale))
    }

    // Paid-product hide. Rewrite to a path with no matching route → framework 404.
    // Done after locale strip so /zen and /en/zen both match.
    if (HIDDEN_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) {
      url.pathname = "/__opensploit_hidden__"
      event.request = new Request(url, event.request)
    }

    const referralCode = normalizeReferralCode(url.searchParams.get("ref"))
    if (referralCode) event.response.headers.append("set-cookie", referralCookie(referralCode))
  },
})
