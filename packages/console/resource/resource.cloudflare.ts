import { env } from "cloudflare:workers"
export { waitUntil } from "cloudflare:workers"

export const Resource = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (`SST_RESOURCE_${prop}` in env) {
        // @ts-expect-error
        const value = env[`SST_RESOURCE_${prop}`]
        return typeof value === "string" ? JSON.parse(value) : value
      }
      if (prop in env) {
        // @ts-expect-error
        const value = env[prop]
        return typeof value === "string" ? JSON.parse(value) : value
      } else if (prop === "App") {
        // @ts-expect-error
        return JSON.parse(env.SST_RESOURCE_App)
      }
      // OpenSploit fork: paid-product Resources (ZEN_*, EMAILOCTOPUS_*,
      // DISCORD_INCIDENT_*, Honeycomb*, etc.) are deferred until Connect
      // launches with a fine-tuned model. They are intentionally not
      // provisioned. Upstream merges keep adding code that references
      // them — some at module-load (e.g. email-signup.tsx) — and the
      // original `throw` made every dynamic route 500 whenever a new
      // unset Resource appeared. Returning a stable stub instead lets
      // the Worker boot; paid surfaces are kept user-unreachable by
      // route-level gating (middleware) and styling, not by Resource
      // resolution. When Connect activates, real bindings linked via
      // sst.config.ts → Cloudflare env take precedence over this stub
      // automatically (the proxy hits the env branches above first).
      console.warn(`[resource] "${prop}" not linked — returning stub`)
      return new Proxy(
        {},
        {
          get(_inner, innerProp) {
            if (innerProp === "value") return ""
            return undefined
          },
        },
      )
    },
  },
) as Record<string, any>
