import { afterEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Config } from "../../src/config/config"
import * as CrossSpawnSpawner from "../../src/effect/cross-spawn-spawner"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import type { SessionPrompt } from "../../src/session/prompt"
import { MessageID, PartID } from "../../src/session/schema"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { TaskTool, type TaskPromptOps } from "../../src/tool/task"
import { Truncate } from "../../src/tool/truncate"
import { ToolRegistry } from "../../src/tool/registry"
import { provideTmpdirInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

afterEach(async () => {
  await Instance.disposeAll()
})

const ref = {
  providerID: ProviderID.make("test"),
  modelID: ModelID.make("test-model"),
}

const it = testEffect(
  Layer.mergeAll(
    Agent.defaultLayer,
    Config.defaultLayer,
    CrossSpawnSpawner.defaultLayer,
    Session.defaultLayer,
    Truncate.defaultLayer,
    ToolRegistry.defaultLayer,
  ),
)

const seed = Effect.fn("TaskToolTest.seed")(function* (title = "Pinned") {
  const session = yield* Session.Service
  const chat = yield* session.create({ title })
  const user = yield* session.updateMessage({
    id: MessageID.ascending(),
    role: "user",
    sessionID: chat.id,
    agent: "build",
    model: ref,
    time: { created: Date.now() },
  })
  const assistant: MessageV2.Assistant = {
    id: MessageID.ascending(),
    role: "assistant",
    parentID: user.id,
    sessionID: chat.id,
    mode: "build",
    agent: "build",
    cost: 0,
    path: { cwd: "/tmp", root: "/tmp" },
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: ref.modelID,
    providerID: ref.providerID,
    time: { created: Date.now() },
  }
  yield* session.updateMessage(assistant)
  return { chat, assistant }
})

function stubOps(opts?: { onPrompt?: (input: SessionPrompt.PromptInput) => void; text?: string }): TaskPromptOps {
  return {
    cancel() {},
    resolvePromptParts: (template) => Effect.succeed([{ type: "text" as const, text: template }]),
    prompt: (input) =>
      Effect.sync(() => {
        opts?.onPrompt?.(input)
        return reply(input, opts?.text ?? "done")
      }),
  }
}

function reply(input: SessionPrompt.PromptInput, text: string): MessageV2.WithParts {
  const id = MessageID.ascending()
  return {
    info: {
      id,
      role: "assistant",
      parentID: input.messageID ?? MessageID.ascending(),
      sessionID: input.sessionID,
      mode: input.agent ?? "general",
      agent: input.agent ?? "general",
      cost: 0,
      path: { cwd: "/tmp", root: "/tmp" },
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      modelID: input.model?.modelID ?? ref.modelID,
      providerID: input.model?.providerID ?? ref.providerID,
      time: { created: Date.now() },
      finish: "stop",
    },
    parts: [
      {
        id: PartID.ascending(),
        messageID: id,
        sessionID: input.sessionID,
        type: "text",
        text,
      },
    ],
  }
}

describe("tool.task", () => {
  it.live("description sorts subagents by name and is stable across calls", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const agent = yield* Agent.Service
          const build = yield* agent.get("build")
          const registry = yield* ToolRegistry.Service
          const get = Effect.fnUntraced(function* () {
            const tools = yield* registry.tools({ ...ref, agent: build })
            return tools.find((tool) => tool.id === TaskTool.id)?.description ?? ""
          })
          const first = yield* get()
          const second = yield* get()

          expect(first).toBe(second)

          const alpha = first.indexOf("- alpha: Alpha agent")
          const explore = first.indexOf("- explore:")
          const general = first.indexOf("- general:")
          const zebra = first.indexOf("- zebra: Zebra agent")

          expect(alpha).toBeGreaterThan(-1)
          expect(explore).toBeGreaterThan(alpha)
          expect(general).toBeGreaterThan(explore)
          expect(zebra).toBeGreaterThan(general)
        }),
      {
        config: {
          agent: {
            zebra: {
              description: "Zebra agent",
              mode: "subagent",
            },
            alpha: {
              description: "Alpha agent",
              mode: "subagent",
            },
          },
        },
      },
    ),
  )

  it.live("description hides denied subagents for the caller", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const agent = yield* Agent.Service
          const build = yield* agent.get("build")
          const registry = yield* ToolRegistry.Service
          const description =
            (yield* registry.tools({ ...ref, agent: build })).find((tool) => tool.id === TaskTool.id)?.description ?? ""

          expect(description).toContain("- alpha: Alpha agent")
          expect(description).not.toContain("- zebra: Zebra agent")
        }),
      {
        config: {
          permission: {
            task: {
              "*": "allow",
              zebra: "deny",
            },
          },
          agent: {
            zebra: {
              description: "Zebra agent",
              mode: "subagent",
            },
            alpha: {
              description: "Alpha agent",
              mode: "subagent",
            },
          },
        },
      },
    ),
  )

  it.live("execute resumes an existing task session from task_id", () =>
    provideTmpdirInstance(() =>
      Effect.gen(function* () {
        const sessions = yield* Session.Service
        const { chat, assistant } = yield* seed()
        const child = yield* sessions.create({ parentID: chat.id, title: "Existing child" })
        const tool = yield* TaskTool
        const def = yield* tool.init()
        let seen: SessionPrompt.PromptInput | undefined
        const promptOps = stubOps({ text: "resumed", onPrompt: (input) => (seen = input) })

        const result = yield* def.execute(
          {
            description: "inspect bug",
            prompt: "look into the cache key path",
            subagent_type: "general",
            task_id: child.id,
          },
          {
            sessionID: chat.id,
            messageID: assistant.id,
            agent: "build",
            abort: new AbortController().signal,
            extra: { promptOps },
            messages: [],
            metadata: () => Effect.void,
            ask: () => Effect.void,
          },
        )

        const kids = yield* sessions.children(chat.id)
        expect(kids).toHaveLength(1)
        expect(kids[0]?.id).toBe(child.id)
        expect(result.metadata.sessionId).toBe(child.id)
        expect(result.output).toContain(`task_id: ${child.id}`)
        expect(seen?.sessionID).toBe(child.id)
      }),
    ),
  )

  it.live("execute asks by default and skips checks when bypassed", () =>
    provideTmpdirInstance(() =>
      Effect.gen(function* () {
        const { chat, assistant } = yield* seed()
        const tool = yield* TaskTool
        const def = yield* tool.init()
        const calls: unknown[] = []
        const promptOps = stubOps()

        const exec = (extra?: Record<string, any>) =>
          def.execute(
            {
              description: "inspect bug",
              prompt: "look into the cache key path",
              subagent_type: "general",
            },
            {
              sessionID: chat.id,
              messageID: assistant.id,
              agent: "build",
              abort: new AbortController().signal,
              extra: { promptOps, ...extra },
              messages: [],
              metadata: () => Effect.void,
              ask: (input) =>
                Effect.sync(() => {
                  calls.push(input)
                }),
            },
          )

        yield* exec()
        yield* exec({ bypassAgentCheck: true })

        expect(calls).toHaveLength(1)
        expect(calls[0]).toEqual({
          permission: "task",
          patterns: ["general"],
          always: ["*"],
          metadata: {
            description: "inspect bug",
            subagent_type: "general",
          },
        })
      }),
    ),
  )

  it.live("execute creates a child when task_id does not exist", () =>
    provideTmpdirInstance(() =>
      Effect.gen(function* () {
        const sessions = yield* Session.Service
        const { chat, assistant } = yield* seed()
        const tool = yield* TaskTool
        const def = yield* tool.init()
        let seen: SessionPrompt.PromptInput | undefined
        const promptOps = stubOps({ text: "created", onPrompt: (input) => (seen = input) })

        const result = yield* def.execute(
          {
            description: "inspect bug",
            prompt: "look into the cache key path",
            subagent_type: "general",
            task_id: "ses_missing",
          },
          {
            sessionID: chat.id,
            messageID: assistant.id,
            agent: "build",
            abort: new AbortController().signal,
            extra: { promptOps },
            messages: [],
            metadata: () => Effect.void,
            ask: () => Effect.void,
          },
        )

        const kids = yield* sessions.children(chat.id)
        expect(kids).toHaveLength(1)
        expect(kids[0]?.id).toBe(result.metadata.sessionId)
        expect(result.metadata.sessionId).not.toBe("ses_missing")
        expect(result.output).toContain(`task_id: ${result.metadata.sessionId}`)
        expect(seen?.sessionID).toBe(result.metadata.sessionId)
      }),
    ),
  )

  it.live("execute shapes child permissions for task, todowrite, and primary tools", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const sessions = yield* Session.Service
          const { chat, assistant } = yield* seed()
          const tool = yield* TaskTool
          const def = yield* tool.init()
          let seen: SessionPrompt.PromptInput | undefined
          const promptOps = stubOps({ onPrompt: (input) => (seen = input) })

          const result = yield* def.execute(
            {
              description: "inspect bug",
              prompt: "look into the cache key path",
              subagent_type: "reviewer",
            },
            {
              sessionID: chat.id,
              messageID: assistant.id,
              agent: "build",
              abort: new AbortController().signal,
              extra: { promptOps },
              messages: [],
              metadata: () => Effect.void,
              ask: () => Effect.void,
            },
          )

          const child = yield* sessions.get(result.metadata.sessionId)
          expect(child.parentID).toBe(chat.id)
          expect(child.permission).toEqual([
            {
              permission: "todowrite",
              pattern: "*",
              action: "deny",
            },
            {
              permission: "bash",
              pattern: "*",
              action: "allow",
            },
            {
              permission: "read",
              pattern: "*",
              action: "allow",
            },
          ])
          expect(seen?.tools).toEqual({
            todowrite: false,
            bash: false,
            read: false,
          })
        }),
      {
        config: {
          agent: {
            reviewer: {
              mode: "subagent",
              permission: {
                task: "allow",
              },
            },
          },
          experimental: {
            primary_tools: ["bash", "read"],
          },
        },
      },
    ),
  )

  // -----------------------------------------------------------------------
  // Pentest depth limit + tool-runner exemption
  // -----------------------------------------------------------------------
  // Behavior under test:
  //  - Master spawning pentest/* → spawn gets `task: pentest/* allow` (standard chain).
  //  - Depth-1 (sub-agent) spawning pentest/* → spawn gets `task: pentest/tool-runner allow` ONLY.
  //  - Spawning pentest/tool-runner at ANY depth → spawn is always a leaf (no allow rule, task tool disabled).
  //  - Pentest sub-agents always have todowrite (no session-level deny injected).
  it.live("execute: master spawning pentest/recon → spawn gets pentest/* allow rule", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const sessions = yield* Session.Service
          const { chat, assistant } = yield* seed()
          const tool = yield* TaskTool
          const def = yield* tool.init()
          let seen: SessionPrompt.PromptInput | undefined
          const promptOps = stubOps({ onPrompt: (input) => (seen = input) })

          const result = yield* def.execute(
            {
              description: "scan target",
              prompt: "discover services on 10.10.10.1",
              subagent_type: "pentest/recon",
            },
            {
              sessionID: chat.id,
              messageID: assistant.id,
              agent: "build",
              abort: new AbortController().signal,
              extra: { promptOps },
              messages: [],
              metadata: () => Effect.void,
              ask: () => Effect.void,
            },
          )

          const child = yield* sessions.get(result.metadata.sessionId)
          expect(child.parentID).toBe(chat.id)
          // No todowrite deny — pentest agents always keep todowrite.
          expect(child.permission?.some((r) => r.permission === "todowrite" && r.action === "deny")).toBe(false)
          // task: blanket deny + pentest/* allow (standard chain at depth-1).
          expect(child.permission).toEqual(
            expect.arrayContaining([
              { permission: "task", pattern: "*", action: "deny" },
              { permission: "task", pattern: "pentest/*", action: "allow" },
            ]),
          )
          // task should NOT be tool-runner-only at this depth.
          expect(child.permission?.some((r) => r.pattern === "pentest/tool-runner")).toBe(false)
          // tools field: task IS available (no `task: false`); todowrite IS available.
          expect(seen?.tools?.task).toBeUndefined()
          expect(seen?.tools?.todowrite).toBeUndefined()
        }),
      {
        config: {
          agent: {
            "pentest/recon": {
              mode: "subagent",
              permission: { todowrite: "allow", task: { "*": "deny", "pentest/*": "allow" } },
            },
          },
        },
      },
    ),
  )

  it.live("execute: depth-1 sub-agent spawning pentest/research → spawn gets tool-runner-only allow", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const sessions = yield* Session.Service
          // Create a master, then a depth-1 sub-agent (parent=master) that spawns research.
          const { chat: master } = yield* seed("Master")
          const sub = yield* sessions.create({ parentID: master.id, title: "depth-1 sub" })
          const subAssistant: MessageV2.Assistant = {
            id: MessageID.ascending(),
            role: "assistant",
            parentID: (yield* sessions.updateMessage({
              id: MessageID.ascending(),
              role: "user",
              sessionID: sub.id,
              agent: "pentest/recon",
              model: ref,
              time: { created: Date.now() },
            })).id,
            sessionID: sub.id,
            mode: "build",
            agent: "pentest/recon",
            cost: 0,
            path: { cwd: "/tmp", root: "/tmp" },
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: ref.modelID,
            providerID: ref.providerID,
            time: { created: Date.now() },
          }
          yield* sessions.updateMessage(subAssistant)

          const tool = yield* TaskTool
          const def = yield* tool.init()
          let seen: SessionPrompt.PromptInput | undefined
          const promptOps = stubOps({ onPrompt: (input) => (seen = input) })

          const result = yield* def.execute(
            {
              description: "research CVE",
              prompt: "find Cisco Expressway CVEs",
              subagent_type: "pentest/research",
            },
            {
              sessionID: sub.id,
              messageID: subAssistant.id,
              agent: "pentest/recon",
              abort: new AbortController().signal,
              extra: { promptOps },
              messages: [],
              metadata: () => Effect.void,
              ask: () => Effect.void,
            },
          )

          const grandchild = yield* sessions.get(result.metadata.sessionId)
          expect(grandchild.parentID).toBe(sub.id)
          // No todowrite deny.
          expect(grandchild.permission?.some((r) => r.permission === "todowrite" && r.action === "deny")).toBe(false)
          // task: blanket deny + tool-runner allow ONLY (NOT pentest/* allow).
          expect(grandchild.permission).toEqual(
            expect.arrayContaining([
              { permission: "task", pattern: "*", action: "deny" },
              { permission: "task", pattern: "pentest/tool-runner", action: "allow" },
            ]),
          )
          expect(grandchild.permission?.some((r) => r.pattern === "pentest/*")).toBe(false)
          // task tool still present in LLM tools field (so it can call task("pentest/tool-runner"))
          expect(seen?.tools?.task).toBeUndefined()
        }),
      {
        config: {
          agent: {
            "pentest/recon": {
              mode: "subagent",
              permission: { todowrite: "allow", task: { "*": "deny", "pentest/*": "allow" } },
            },
            "pentest/research": {
              mode: "subagent",
              permission: { todowrite: "allow", task: { "*": "deny", "pentest/*": "allow" } },
            },
          },
        },
      },
    ),
  )

  it.live("execute: spawning pentest/tool-runner → always a leaf (no allow rule, task tool disabled)", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const sessions = yield* Session.Service
          const { chat, assistant } = yield* seed()
          const tool = yield* TaskTool
          const def = yield* tool.init()
          let seen: SessionPrompt.PromptInput | undefined
          const promptOps = stubOps({ onPrompt: (input) => (seen = input) })

          const result = yield* def.execute(
            {
              description: "run nmap once",
              prompt: "execute nmap -sT -p 80 10.10.10.1",
              subagent_type: "pentest/tool-runner",
            },
            {
              sessionID: chat.id,
              messageID: assistant.id,
              agent: "build",
              abort: new AbortController().signal,
              extra: { promptOps },
              messages: [],
              metadata: () => Effect.void,
              ask: () => Effect.void,
            },
          )

          const child = yield* sessions.get(result.metadata.sessionId)
          // Tool-runner gets ONLY task: * deny (no allow rule of any kind).
          expect(child.permission?.filter((r) => r.permission === "task")).toEqual([
            { permission: "task", pattern: "*", action: "deny" },
          ])
          // task tool is removed from LLM tool list (tools.task === false).
          expect(seen?.tools?.task).toBe(false)
        }),
      {
        config: {
          agent: {
            "pentest/tool-runner": {
              mode: "subagent",
              permission: { todowrite: "allow", task: { "*": "deny" } },
            },
          },
        },
      },
    ),
  )
})
