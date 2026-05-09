# Pre-Tool-Use Driver — Design Note (implementation deferred)

- Status: **design only, follow-up implementation deferred**
- Scope: a centralized driver for the pre-tool-use wrapper that today exists in two near-identical-skeleton, materially-different-tail forms in `claude-agent.ts` and `pi-agent.ts`.
- Date: 2026-05-09

## Why this is a design note, not a refactor

Both backends currently:

1. Build a `runPreToolUseChecks` input (12 fields, identically shaped).
2. Switch on `checkResult.type` over 7 cases: `allow`, `modify`, `block`, `source_activation_needed`, `call_llm_intercept`, `spawn_session_intercept`, `prompt`.
3. In the `block` branch, emit a `__PERMISSION_BLOCK__` diagnostic record (identical content).
4. In the `prompt` branch, register a pending-permission `Promise<boolean>`, fire `onPermissionRequest` with a 12-field payload (identical fields), `await`, and translate the boolean back to an action.

That looks symmetric on the surface. It is not symmetric in the tail of every branch:

| Branch | Claude (SDK callback) | Pi (JSON-RPC) | Genuinely shared? |
|---|---|---|---|
| `allow` | returns `{ continue: true, hookSpecificOutput?: { additionalContext } }` (steer-message weaving) | sends `{ type: 'pre_tool_use_response', action: 'allow' }` | No — Claude weaves `pendingSteerMessage` into `additionalContext` here; Pi has no concept. |
| `modify` | returns `{ continue: true, hookSpecificOutput: { updatedInput, additionalContext? } }` | sends `{ ..., action: 'modify', input }` | Partial — same trigger, divergent payload shape, plus Claude's steer-merge tail. |
| `block` | returns `blockWithReason(reason)` after `__PERMISSION_BLOCK__` log | sends `{ ..., action: 'block', reason }` after `__PERMISSION_BLOCK__` log | The diagnostic is shared; the response is not. |
| `source_activation_needed` | returns one of **four** SDK-shaped blocks with `STOP. ...next turn` instructions; **does not re-run the pipeline** — relies on the model retrying next turn | calls `onSourceActivationRequest`, enqueues a `source_activated` event into `eventQueue`, then **re-runs `runPreToolUseChecks`** post-activation in-line, then sends an SDK-style action | No — the *control flow* differs: Claude asks the model to retry; Pi retries inline. The reason templates also differ ("activated successfully... ask them to send their request again" vs "Source X is not active. Activate it by @mentioning it..."). |
| `call_llm_intercept` / `spawn_session_intercept` | `{ continue: true }` (Claude runs these in-process) | `{ ..., action: 'allow' }` (Pi handles via `tool_execute_request`) | Trivially symmetric — both are no-op allows. |
| `prompt` | `pendingPermissions` is a `Map<string, { resolve, toolName, command, baseCommand }>`; settle by `Map.set`/`Map.get`; on no-handler **deletes** the entry; merges `modifiedInput` into `hookSpecificOutput.updatedInput` on approve | `pendingPermissions` is a `PendingRequestMap<boolean, { toolName }>`; settle via `register`/`resolve`; on no-handler returns `allow`+`modifiedInput` (different policy: Pi *allows* with no handler, Claude *blocks* with "No permission handler available") | No — both the storage shape and the no-handler policy differ. |

In addition, **before** the shared `runPreToolUseChecks` call, Claude runs an image-size guard for `Read` (50+ lines, calls `onImageResize`, can short-circuit with `updatedInput` or `blockWithReason`) and `prerequisiteManager.trackReadTool`. Pi has neither here — its prerequisite check happens in the `tool_execute_request` path on the subprocess side. Moving the image guard into the driver would force Pi to depend on it (Pi doesn't need it); leaving it out would force Claude to call the driver from a wrapper that still owns 50+ lines of pre-driver logic.

## What a driver could look like (sketch — not implemented)

```ts
// packages/shared/src/agent/core/pre-tool-use-driver.ts (HYPOTHETICAL)
export interface PreToolUsePermissionStrategy {
  readonly noHandlerPolicy: 'allow' | 'block-with-reason';
  registerPending(requestId: string, resolver: (allowed: boolean) => void): void;
  cancelPending(requestId: string): void;
}

export interface PreToolUseSourceActivationStrategy {
  readonly mode: 'block-and-instruct' | 'reactivate-and-rerun';
  onActivated?(sourceSlug: string): void; // Pi enqueues source_activated; Claude no-op
}

export interface PreToolUseDriverConfig {
  readonly permission: PreToolUsePermissionStrategy;
  readonly sourceActivation: PreToolUseSourceActivationStrategy;
  readonly onPermissionRequest?: (req: PermissionRequest) => void;
  readonly onSourceActivationRequest?: (slug: string) => Promise<boolean>;
  readonly diagnostics: { onPermissionBlock(record: PermissionBlockRecord): void };
  // ...
}

// Returns a DECISION the caller renders into its own response shape.
export type PreToolUseDecision =
  | { kind: 'allow' }
  | { kind: 'modify'; input: Record<string, unknown> }
  | { kind: 'block'; reason: string }
  | { kind: 'allow-with-steer'; steerMessage?: string }   // Claude-only
  | { kind: 'modify-with-steer'; input: Record<string, unknown>; steerMessage?: string }; // Claude-only

export class PreToolUseDriver {
  async run(input: PreToolUseInput): Promise<PreToolUseDecision> { /* ... */ }
}
```

The strategy split (`noHandlerPolicy`, `mode: 'block-and-instruct' | 'reactivate-and-rerun'`) is exactly the leakage. Each backend essentially configures one of two named-but-rigid behaviors; the driver is therefore not centralizing common code so much as it is **a tagged-union dispatcher over two named workflows** that already each fit on one screen.

## Cost / benefit at this slice

- **Benefit ceiling**: ~80–100 LOC of `runPreToolUseChecks` input construction + diagnostic-block plumbing could be deduplicated, plus the `onPermissionRequest` payload construction (~15 LOC × 2). Total: ~110–130 LOC of genuine duplication, plus a clean place to test the prompt-and-await loop.
- **Cost floor**:
  - A new strategy/policy abstraction (`PreToolUsePermissionStrategy`, `PreToolUseSourceActivationStrategy`) that exists only to encode the two known divergence axes (no-handler policy, source-activation mode).
  - Two adapter shells in each agent that translate `PreToolUseDecision` back into either an SDK callback shape or a `pre_tool_use_response` JSON-RPC envelope — i.e. each backend keeps its 7-case switch, just over a different enum.
  - An invariant to maintain that Claude's image-size guard runs *before* the driver, not inside it (a comment, plus a non-trivial test that the order survives future edits).
  - Test coverage rebuild: the existing `core/__tests__/pre-tool-use-checks.isolated.ts` covers the *checker* (`runPreToolUseChecks`), not the *wrapper*. A driver introduces a new public surface that needs its own test suite, and the existing per-backend behavior is currently tested only through end-to-end paths.
- **Risk**: source-activation behavior is currently load-bearing on the model's own retry loop in Claude (the "STOP. ...send their request again" prompt is *the* retry mechanism). A regression here is invisible in unit tests and only shows up as "Claude doesn't pick up newly-activated sources on the next turn." Pi's inline-rerun is a fundamentally different control-flow choice that we should not casually unify.

## Recommendation

**Defer to a follow-up slice.** The right time to extract a driver is after one of these triggers:

1. A third backend lands (Codex, Copilot, etc.) and shares the same skeleton — three call sites generally beat two for finding the common subset honestly.
2. The source-activation behavior unifies on its own (e.g. Claude moves to `reactivate-and-rerun` like Pi, or both move to a model-driven retry that doesn't need a special block reason).
3. The image-size guard relocates to a generic Read-tool middleware that doesn't live inside Claude's pre-tool-use callback.

Until one of those is true, the duplication is mechanically isolated and visible in two places. A driver introduced now is a strategy/policy abstraction whose only job is to say "Claude does this; Pi does that" — exactly the leakage the centralization was meant to remove.

## Out of scope here, deliberately

- Image-size guard relocation. Worth doing eventually (Pi may grow a Read path that needs it), but it is its own concern and should not block or hide inside a pre-tool-use driver extraction.
- Steer-message timing semantics. Currently Claude-only and tied to its callback shape; if Pi grows mid-turn steering it should be re-examined alongside `LlmConnection.midStreamBehavior`.
- Pending-permissions storage unification. Claude's `Map<string, ...>` could move to `PendingRequestMap` like Pi, but that is a self-contained one-commit change and shouldn't be smuggled inside a driver extraction.
