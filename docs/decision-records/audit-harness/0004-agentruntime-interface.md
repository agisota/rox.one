# Decision 0004: AgentRuntime as Type Refinement, Surgical Shared Utilities

- Status: accepted (commits 1–4 of 4 landed)
- Date: 2026-05-09

## Canonical

The agent runtime contract is not re-architected — it is *named in core's vocabulary* and the most-duplicated mechanics inside the existing backends are factored into shared utilities. The change set is four atomic commits:

```text
405ec74  chore(core)    AgentRuntime type anchor in @rox-agent/core/runtime
b02162b  feat(shared)   PendingRequestMap<T, M> generic + 10 unit tests
bb11af1  refactor(pi)   migrate Pi's 8 RPC pending maps to PendingRequestMap
b8aa45b  refactor(base) centralize source-activation auto-restart sequencing in BaseAgent
```

```text
packages/core/src/runtime/
  agent-runtime.ts        65 LOC   AgentRuntime interface (strict subset of AgentBackend)
  index.ts                 8 LOC   barrel + doc-comment

packages/shared/src/agent/core/
  pending-request-map.ts ~150 LOC  PendingRequestMap<T, M> + register/resolve/reject/resolveAll/rejectAll/getMeta/has

packages/shared/src/agent/base-agent.ts          +43 LOC  maybeYieldSourceActivationRestart() helper
packages/shared/src/agent/pi-agent.ts          -69 LOC net (8 maps migrated, 14 LOC of restart sequencing removed)
packages/shared/src/agent/claude-agent.ts       -3 LOC net (restart sequencing replaced with delegation)
```

```text
Type relationship (refinement, not competition):

  @rox-agent/core/runtime
    AgentRuntime — provider-agnostic core (chat, isProcessing,
                   runMiniCompletion, getSessionId, destroy, dispose)

  @rox-agent/shared/agent/backend
    AgentBackend — full surface, structurally extends AgentRuntime
                   adds source/MCP/permission/thinking-level surface

  Every AgentBackend instance assigns to AgentRuntime without a cast.
  Members in AgentRuntime have identical names + signatures on AgentBackend.
```

## Why

- **Foundations already existed.** `AgentBackend` was already the de-facto runtime contract and `BaseAgent` already factored out skill resolution, mini-completion, recovery context, source management, permission mode, and lifecycle hooks. The remaining 2.6k LOC per concrete agent is genuinely provider-specific — Claude SDK lifecycle vs Pi subprocess JSON-RPC. A "≥50% reduction" target for `claude-agent.ts` and `pi-agent.ts` is unrealistic without erasing real provider differences. We chose surgical extractions where the shape is *literally identical* across backends.
- **AgentRuntime is named in core, not redefined.** `packages/core` is the dependency-light type layer; `packages/shared` depends on it, not vice versa. To honor that one-way graph the new `AgentRuntime` interface in core is a strict structural subset of `AgentBackend` — every member has an identically-named, identically-typed sibling on the shared interface, so any concrete backend (`ClaudeAgent`, `PiAgent`) assigns to either type without a cast. The split lets server-core lifecycle code and telemetry depend on a contract anchor that doesn't drag in `packages/shared`.
- **`PendingRequestMap<T, M>` collapses an 8× duplication.** Pi's RPC bookkeeping was 8 hand-rolled `Map<string, { resolve, reject, ...meta }>` fields with the same set/get/delete dance plus 8 iterate-and-clear loops on subprocess exit and 4 more on `forceAbort`. The utility (`register`, `resolve`, `reject`, `resolveAll`, `rejectAll`, `getMeta`, `has`) is provider-agnostic by design. Settle paths drop the entry before invoking callbacks so re-entrant settle attempts no-op. `rejectAll`/`resolveAll` use snapshot-then-clear semantics so callbacks observing `map.size` during teardown see 0. Pi's net diff is `-179 / +110` LOC.
- **`maybeYieldSourceActivationRestart` is a delegating generator.** Both backends had a near-identical post-tool_result handshake (consume pending restart → yield `source_activated` → forceAbort → return). The only real difference was the debug hook (`onDebug?.()` vs `debug()`). The new BaseAgent helper is a `Generator<AgentEvent, boolean>`: callers `yield*` it and `return` when it returns `true`. Claude's call site preserves a subtle invariant — when there is *no* pending restart, the underlying `tool_result` must flow through `guardLargeResult`, the inactive-source guard, and the Read-error hint, so the early-yield is gated on `_pendingSourceActivationRestart` being set.
- **Public surface is byte-stable.** No exports change. `AgentBackend`, `BaseAgent`, `ClaudeAgent`, `PiAgent`, and the factory are unchanged at the type level. The only new exports are `AgentRuntime` (core) and `PendingRequestMap` (shared).

## Out of scope

- **Full provider-symmetric refactor.** Claude's stream lifecycle (SDK callbacks, async event adaptation, branch-fork handling, recovery context injection) and Pi's subprocess lifecycle (spawn, JSONL framing, stdin/stdout protocol, subprocess error dedup) are genuinely different. Forcing them into a shared abstraction would either require a leaky common base or a thick translation layer — both cost more than the duplication. The "≥50% LOC reduction" target from the original brief was abandoned for this reason; subsequent slices should pick narrower targets (see below).
- **Pre-tool-use wrapper.** Both backends call `runPreToolUseChecks` and then run an identical permission-prompt pattern. There is real duplication around the prompt-and-await loop, but the surface area (`PreToolUseCheckResult` flags, the various early-return cases for `safe`/`ask`/`allow-all`) is large enough that an extraction needs its own design pass with care for the test surface.
- **Stderr-buffer dedup.** Pi has a `subprocessErrorRepeatCount` + `lastSubprocessError` suppression mechanism that's a clean candidate for extraction (`StderrErrorDedup` or similar). It wasn't urgent enough to land in this slice and is mechanically isolated, so it's a low-risk follow-up.
- **Moving `AgentBackend` to core.** A future slice could move the full interface (and its supporting types) into core to eliminate the refinement asymmetry. That requires moving `LoadedSource`, `Workspace`, `SessionConfig`, `PermissionMode`, `ThinkingLevel`, etc. to core too — a non-trivial reshuffle that's out of scope here.
- **~~Pi's dead `pendingToolExecutions` map.~~** Removed in a follow-up commit: the main-process-side map was never `register`'d — only the symmetric subprocess map in `pi-agent-server/src/index.ts` is live — so the field plus its two `rejectAll` call sites (subprocess-exit path and `forceAbort`) were no-ops on an empty map. Removing them is behaviorally inert.

## Result

| Metric | Pre-Slice 4 | Post-Slice 4 |
|---|---|---|
| `packages/core/src/runtime/` | absent | 73 LOC (AgentRuntime + barrel) |
| `packages/shared/src/agent/core/pending-request-map.ts` | absent | ~150 LOC + 10 unit tests |
| `pi-agent.ts` | 2579 LOC | 2510 LOC (−69 net for map migration) |
| `pi-agent.ts` post-(d) | 2510 LOC | 2502 LOC (−8 for restart sequencing) |
| `claude-agent.ts` | 2690 LOC | 2687 LOC (−3 for restart sequencing) |
| shared tests | 2883 pass / 12 skip / 2 fail | 2893 pass / 12 skip / 2 fail (+10 from PRM suite, same 2 pre-existing fails) |
| `tsc --noEmit` (core, shared) | EXIT=0 | EXIT=0 |

Four atomic commits land cleanly. The PR is honest: foundations exist, surgical deduplication is bounded, and the named-but-deferred items above are explicit follow-up work.
