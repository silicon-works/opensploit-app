import { createMiddleware } from "@solidjs/start/middleware"
import { LOCALE_HEADER, cookie, fromPathname, strip } from "~/lib/language"
import { normalizeReferralCode, referralCookie } from "~/lib/referral-invite"

// Paid-product surfaces (Zen, Go, Black, Stripe, Enterprise) are deferred
// until Connect launches with a fine-tuned model. The routes stay in the
// codebase so upstream merges remain low-conflict; this gate 404s them at
// the edge. Reactivate by removing PAID_PATHS + the early-return below.
const PAID_PATHS = ["/zen", "/go", "/black", "/stripe", "/enterprise"]

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

    // Paid-product 404 gate. Runs after locale strip so /zen and /en/zen
    // both match; before referral cookie so dead routes don't set state.
    if (PAID_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) {
      return new Response("Not Found", { status: 404 })
    }

    const referralCode = normalizeReferralCode(url.searchParams.get("ref"))
    if (referralCode) event.response.headers.append("set-cookie", referralCookie(referralCode))
  },
})
