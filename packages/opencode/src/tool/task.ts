import { Tool } from "./tool"
import DESCRIPTION from "./task.txt"
import z from "zod"
import { Session } from "../session"
import { SessionID, MessageID } from "../session/schema"
import { MessageV2 } from "../session/message-v2"
import { Agent } from "../agent/agent"
import type { SessionPrompt } from "../session/prompt"
import { Config } from "../config/config"
import { Effect } from "effect"
import { Log } from "@/util/log"

export interface TaskPromptOps {
  cancel(sessionID: SessionID): void
  resolvePromptParts(template: string): Effect.Effect<SessionPrompt.PromptInput["parts"]>
  prompt(input: SessionPrompt.PromptInput): Effect.Effect<MessageV2.WithParts>
}

const id = "task"

// Pentest sub-agents are identified by the `pentest/` prefix on the
// subagent_type string. Their permission ruleset is built differently from
// custom user-defined sub-agents — see the spawn permission block below.
function isPentestSubagent(agentName: string): boolean {
  return agentName.startsWith("pentest/")
}

const parameters = z.object({
  description: z.string().describe("A short (3-5 words) description of the task"),
  prompt: z.string().describe("The task for the agent to perform"),
  subagent_type: z.string().describe("The type of specialized agent to use for this task"),
  task_id: z
    .string()
    .describe(
      "This should only be set if you mean to resume a previous task (you can pass a prior task_id and the task will continue the same subagent session as before instead of creating a fresh one)",
    )
    .optional(),
  command: z.string().describe("The command that triggered this task").optional(),
})

export const TaskTool = Tool.define(
  id,
  Effect.gen(function* () {
    const agent = yield* Agent.Service
    const config = yield* Config.Service
    const sessions = yield* Session.Service

    const run = Effect.fn("TaskTool.execute")(function* (params: z.infer<typeof parameters>, ctx: Tool.Context) {
      const cfg = yield* config.get()

      const isPentest = isPentestSubagent(params.subagent_type)
      const isToolRunner = params.subagent_type === "pentest/tool-runner"

      // Permission check resolves against the merged ruleset (agent +
      // session). Allow rules added at spawn time (see below) cover the
      // valid spawn paths so this resolves silently without prompting.
      if (!ctx.extra?.bypassAgentCheck) {
        yield* ctx.ask({
          permission: id,
          patterns: [params.subagent_type],
          always: ["*"],
          metadata: {
            description: params.description,
            subagent_type: params.subagent_type,
          },
        })
      }

      const next = yield* agent.get(params.subagent_type)
      if (!next) {
        return yield* Effect.fail(new Error(`Unknown agent type: ${params.subagent_type} is not a valid agent type`))
      }

      // For non-pentest agents: did the agent declare these tools in its
      // own permission ruleset? If yes, we don't inject a session-level
      // deny for them.
      const canTask = next.permission.some((rule) => rule.permission === id)
      const canTodo = next.permission.some((rule) => rule.permission === "todowrite")

      // Caller's depth determines what the spawned pentest sub-agent can spawn:
      // master (no parent) → spawned child can recurse on pentest/*;
      // sub-agent (has parent) → spawned child can only spawn pentest/tool-runner.
      const callerSession = yield* sessions
        .get(ctx.sessionID)
        .pipe(Effect.catchCause(() => Effect.succeed(undefined)))
      const callerHasParent = !!callerSession?.parentID
      const canChildSpawn = isPentest && !callerHasParent

      const taskID = params.task_id
      const session = taskID
        ? yield* sessions.get(SessionID.make(taskID)).pipe(Effect.catchCause(() => Effect.succeed(undefined)))
        : undefined
      const nextSession =
        session ??
        (yield* sessions.create({
          parentID: ctx.sessionID,
          title: params.description + ` (@${next.name} subagent)`,
          objective: params.prompt,
          permission: [
            // todowrite: pentest agents always get it; non-pentest follows their
            // own declared permission (canTodo).
            ...((isPentest || canTodo)
              ? []
              : [
                  {
                    permission: "todowrite" as const,
                    pattern: "*" as const,
                    action: "deny" as const,
                  },
                ]),
            // task spawn permission for the new sub-agent:
            //  - pentest/tool-runner: always a leaf executor, never spawns anything
            //  - other pentest at depth 0 (master spawning): allowed to spawn pentest/*
            //  - other pentest at depth 1+ (sub-agent spawning): allowed to spawn ONLY
            //    pentest/tool-runner; further pentest/* spawns are denied
            //  - non-pentest: governed by the agent's own declared task permission
            ...(isPentest
              ? (isToolRunner
                  ? [
                      {
                        permission: id,
                        pattern: "*" as const,
                        action: "deny" as const,
                      },
                    ]
                  : (canChildSpawn
                      ? [
                          {
                            permission: id,
                            pattern: "*" as const,
                            action: "deny" as const,
                          },
                          {
                            permission: id,
                            pattern: "pentest/*" as const,
                            action: "allow" as const,
                          },
                        ]
                      : [
                          {
                            permission: id,
                            pattern: "*" as const,
                            action: "deny" as const,
                          },
                          {
                            permission: id,
                            pattern: "pentest/tool-runner" as const,
                            action: "allow" as const,
                          },
                        ]))
              : (canTask
                  ? []
                  : [
                      {
                        permission: id,
                        pattern: "*" as const,
                        action: "deny" as const,
                      },
                    ])),
            ...(cfg.experimental?.primary_tools?.map((item) => ({
              pattern: "*",
              action: "allow" as const,
              permission: item,
            })) ?? []),
          ],
        }))

      const msg = yield* Effect.sync(() => MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID }))
      if (msg.info.role !== "assistant") return yield* Effect.fail(new Error("Not an assistant message"))

      const model = next.model ?? {
        modelID: msg.info.modelID,
        providerID: msg.info.providerID,
      }

      yield* ctx.metadata({
        title: params.description,
        metadata: {
          sessionId: nextSession.id,
          model,
        },
      })

      const ops = ctx.extra?.promptOps as TaskPromptOps
      if (!ops) return yield* Effect.fail(new Error("TaskTool requires promptOps in ctx.extra"))

      const messageID = MessageID.ascending()

      function cancel() {
        ops.cancel(nextSession.id)
      }

      return yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          ctx.abort.addEventListener("abort", cancel)
        }),
        () =>
          Effect.gen(function* () {
            const parts = yield* ops.resolvePromptParts(params.prompt)
            const result = yield* ops.prompt({
              messageID,
              sessionID: nextSession.id,
              model: {
                modelID: model.modelID,
                providerID: model.providerID,
              },
              agent: next.name,
              tools: {
                // todowrite tool: pentest agents always have it; non-pentest
                // agents only when they declared todowrite in their permission.
                ...((isPentest || canTodo) ? {} : { todowrite: false }),
                // task tool:
                //  - tool-runner never sees it (leaf executor)
                //  - other pentest agents always see it; the permission rules
                //    above decide which subagent_types are actually allowed
                //  - non-pentest agents only when they declared task themselves
                ...(isToolRunner
                  ? { task: false }
                  : (isPentest
                      ? {}
                      : (canTask ? {} : { task: false }))),
                ...Object.fromEntries((cfg.experimental?.primary_tools ?? []).map((item) => [item, false])),
              },
              parts,
            })

            return {
              title: params.description,
              metadata: {
                sessionId: nextSession.id,
                model,
              },
              output: [
                `task_id: ${nextSession.id} (for resuming to continue this task if needed)`,
                "",
                "<task_result>",
                result.parts.findLast((item) => item.type === "text")?.text ?? "",
                "</task_result>",
              ].join("\n"),
            }
          }),
        () =>
          Effect.sync(() => {
            ctx.abort.removeEventListener("abort", cancel)
          }),
      )
    })

    return {
      description: DESCRIPTION,
      parameters,
      execute: (params: z.infer<typeof parameters>, ctx: Tool.Context) => run(params, ctx).pipe(Effect.orDie),
    }
  }),
)
