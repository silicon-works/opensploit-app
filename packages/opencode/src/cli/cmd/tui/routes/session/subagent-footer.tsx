import { createMemo, createSignal, Show } from "solid-js"
import { useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { useLocal } from "@tui/context/local"
import { useKV } from "@tui/context/kv"
import { SplitBorder } from "@tui/component/border"
import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useKeybind } from "../../context/keybind"
import { Locale } from "@/util/locale"
import { useTerminalDimensions } from "@opentui/solid"
import { createColors, createFrames } from "../../ui/spinner"

export function SubagentFooter() {
  const route = useRouteData("session")
  const sync = useSync()
  const local = useLocal()
  const kv = useKV()
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])
  const session = createMemo(() => sync.session.get(route.sessionID))

  const status = createMemo(() => sync.data.session_status?.[route.sessionID] ?? { type: "idle" })
  const isWorking = createMemo(() => status().type !== "idle")

  const subagentInfo = createMemo(() => {
    const s = session()
    if (!s) return { label: "Subagent", agentName: "subagent", index: 0, total: 0 }
    // Match agent names like "pentest/recon", "pentest/enum", etc.
    const agentMatch = s.title.match(/@([^\s)]+)\s+subagent/)
    const agentName = agentMatch?.[1] ?? "subagent"
    const shortName = agentName.includes("/") ? agentName.split("/").pop()! : agentName
    const label = Locale.titlecase(shortName)

    if (!s.parentID) return { label, agentName, index: 0, total: 0 }

    const siblings = sync.data.session
      .filter((x) => x.parentID === s.parentID)
      .toSorted((a, b) => a.time.created - b.time.created)
    const index = siblings.findIndex((x) => x.id === s.id)

    return { label, agentName, index: index + 1, total: siblings.length }
  })

  const color = createMemo(() => local.agent.color(subagentInfo().agentName))

  const spinnerDef = createMemo(() => ({
    frames: createFrames({
      color: color(),
      style: "blocks",
      inactiveFactor: 0.6,
      minAlpha: 0.3,
    }),
    color: createColors({
      color: color(),
      style: "blocks",
      inactiveFactor: 0.6,
      minAlpha: 0.3,
    }),
  }))

  const usage = createMemo(() => {
    const msg = messages()
    const last = msg.findLast((item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0)
    if (!last) return

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    if (tokens <= 0) return

    const model = sync.data.provider.find((item) => item.id === last.providerID)?.models[last.modelID]
    const pct = model?.limit.context ? `${Math.round((tokens / model.limit.context) * 100)}%` : undefined
    const cost = msg.reduce((sum, item) => sum + (item.role === "assistant" ? item.cost : 0), 0)

    const money = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    })

    return {
      context: pct ? `${Locale.number(tokens)} (${pct})` : Locale.number(tokens),
      cost: cost > 0 ? money.format(cost) : undefined,
    }
  })

  const { theme } = useTheme()
  const keybind = useKeybind()
  const command = useCommandDialog()
  const [hover, setHover] = createSignal<"parent" | "prev" | "next" | null>(null)
  const dimensions = useTerminalDimensions()

  return (
    <box flexShrink={0}>
      <box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={1}
        {...SplitBorder}
        border={["left"]}
        borderColor={theme.border}
        flexShrink={0}
        backgroundColor={theme.backgroundPanel}
      >
        <box flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="row" gap={1}>
            <Show when={isWorking()}>
              <Show when={kv.get("animations_enabled", true)} fallback={<text fg={theme.textMuted}>[⋯]</text>}>
                <spinner color={spinnerDef().color} frames={spinnerDef().frames} interval={40} />
              </Show>
            </Show>
            <text fg={theme.text}>
              <b>{subagentInfo().label}</b>
            </text>
            <Show when={isWorking()}>
              <text fg={theme.textMuted}>working...</text>
            </Show>
            <Show when={!isWorking()}>
              <Show when={subagentInfo().total > 0}>
                <text style={{ fg: theme.textMuted }}>
                  ({subagentInfo().index} of {subagentInfo().total})
                </text>
              </Show>
              <Show when={usage()}>
                {(item) => (
                  <text fg={theme.textMuted} wrapMode="none">
                    {[item().context, item().cost].filter(Boolean).join(" · ")}
                  </text>
                )}
              </Show>
            </Show>
          </box>
          <box flexDirection="row" gap={2}>
            <Show when={isWorking()}>
              <text fg={theme.text}>
                esc <span style={{ fg: theme.textMuted }}>interrupt</span>
              </text>
            </Show>
            <Show when={!isWorking()}>
              <box
                onMouseOver={() => setHover("parent")}
                onMouseOut={() => setHover(null)}
                onMouseUp={() => command.trigger("session.parent")}
                backgroundColor={hover() === "parent" ? theme.backgroundElement : theme.backgroundPanel}
              >
                <text fg={theme.text}>
                  Parent <span style={{ fg: theme.textMuted }}>{keybind.print("session_parent")}</span>
                </text>
              </box>
              <box
                onMouseOver={() => setHover("prev")}
                onMouseOut={() => setHover(null)}
                onMouseUp={() => command.trigger("session.child.previous")}
                backgroundColor={hover() === "prev" ? theme.backgroundElement : theme.backgroundPanel}
              >
                <text fg={theme.text}>
                  Prev <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle_reverse")}</span>
                </text>
              </box>
              <box
                onMouseOver={() => setHover("next")}
                onMouseOut={() => setHover(null)}
                onMouseUp={() => command.trigger("session.child.next")}
                backgroundColor={hover() === "next" ? theme.backgroundElement : theme.backgroundPanel}
              >
                <text fg={theme.text}>
                  Next <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle")}</span>
                </text>
              </box>
            </Show>
          </box>
        </box>
      </box>
    </box>
  )
}
