# T242b-renderer-orchestrator-hook - Renderer Orchestrator React Hook

Status: DONE

## 1. Task summary

Land the renderer-side React hook for the M.7 provider-orchestration
backbone. The hook (`useOrchestrator`) wraps a constructed
`Orchestrator` instance (the T242 host-composition output) and exposes
a thin React-friendly surface:

- `dispatch(request) → Promise<OrchestrationResponse>` for the
  non-streaming `Orchestrator.send` path.
- `stream(request) → AsyncIterableIterator<OrchestrationChunk>` for the
  streaming `Orchestrator.stream` path.
- `pending: boolean` — counter-backed flag that stays true for the
  lifetime of every in-flight `dispatch` *and* `stream` call (correct
  under concurrent calls).
- `lastError: OrchestrationError | null` — cleared at the start of each
  call, populated whenever the orchestrator returns a non-`ok` result.

The hook is deliberately thin — it defers ALL routing, dispatch,
retries, and streaming logic to the orchestrator and owns only the
React-side state for the two surface fields plus unmount cleanup.

## 2. Repo context discovered

- T240 (PR #89) landed the backbone on `main`. The relevant modules:
  - `provider-id.ts` — branded `ProviderId`, `Result<T, E>`,
    `unsafeProviderId` (used by the test fixtures).
  - `provider-registry.ts` — `ProviderHandler` (`id`, `healthy`,
    `send`, `stream`), `ProviderRequest`, `ProviderStreamEvent`
    (`{kind:'chunk', delta, index} | {kind:'end', reason, usage?}`),
    `ProviderNonStreamingResponse`.
  - `routing-policy.ts` — `createRoundRobinPolicy` (used by the test
    fixtures), `createStickyPolicy`, `createFailoverPolicy`.
  - `orchestrator.ts` — `Orchestrator` class with
    `OrchestrationRequest`, `OrchestrationResponse` (a discriminated
    union over `mode: 'send' | 'stream'` and `ok`), and
    `OrchestrationError`
    (`ProviderUnavailableError | BudgetExceededError | RateLimitedError | RouteUnresolvedError`).
- T241-adapters (PR #128) added pure fake adapters
  (`FakeAnthropicAdapter`, `FakeOpenAiAdapter`). The new hook tests do
  not reuse them — they wire an in-memory `ProviderHandler` literal
  directly for tighter control over per-test failure / streaming
  scenarios.
- T242 (host composition) landed `createHostOrchestrator` plus
  `parseHostConfig` in `@rox-one/server-core/src/orchestrator/`. The
  hook never imports server-core; it accepts the assembled
  `Orchestrator` directly, which keeps the hook agnostic to whether
  the orchestrator was built in-process or surfaced over IPC.
- `apps/electron/src/renderer/hooks/useExperience.ts` (M.9 T271) is
  the closest stylistic precedent — a thin React adapter over a pure
  T270 kernel with explicit unmount cleanup, a refed pending counter,
  and `.rtl.test.tsx` coverage. The new hook follows the same shape.
- The repo splits `bun:test` (default unit runner) from `vitest` (RTL
  + `happy-dom`, gated by the `.rtl.test.tsx` suffix per
  `bunfig.toml` `pathIgnorePatterns` and `vitest.config.ts` `include`).
  `renderHook` from `@testing-library/react` requires `happy-dom`, so
  the spec lives in a `.rtl.test.tsx` file even though the task brief
  proposed a `.test.tsx` name. The trade-off: zero risk of double-runs
  under bun:test (which would crash at import time on
  `@testing-library/react`).

## 3. Files inspected

- `packages/shared/src/agent/backend/provider-id.ts`
- `packages/shared/src/agent/backend/provider-registry.ts`
- `packages/shared/src/agent/backend/routing-policy.ts`
- `packages/shared/src/agent/backend/orchestrator.ts`
- `packages/server-core/src/orchestrator/host.ts`
- `packages/server-core/src/orchestrator/index.ts`
- `apps/electron/src/renderer/hooks/useExperience.ts`
- `apps/electron/src/renderer/hooks/__tests__/use-experience.rtl.test.tsx`
- `apps/electron/vitest.config.ts`
- `bunfig.toml`
- `docs/tickets/T240-provider-orchestration-backbone.md`
- `docs/tickets/T241-adapters-provider-implementations.md`
- `docs/tickets/T242-orchestrator-host-composition.md`
- `docs/worklog/T242-orchestrator-host-composition.md`

## 4. Files created

- `apps/electron/src/renderer/hooks/useOrchestrator.ts`
  (≈195 LOC including the docstring; within the ≤200 LOC source budget)
- `apps/electron/src/renderer/hooks/__tests__/use-orchestrator.rtl.test.tsx`
  (≈295 LOC, 8 `it` cases; within the ≤300 LOC test budget)
- `docs/tickets/T242b-renderer-orchestrator-hook.md`
- `docs/worklog/T242b-renderer-orchestrator-hook.md` (this file)

## 5. Files modified

None outside the new ticket + worklog. The T240 backbone, the
T241-adapters fakes, and the T242 host composition source trees are
all untouched. The hook imports the T240 types via deep relative paths
(`../../../../../packages/shared/src/agent/backend/*.ts`) because the
shared package's `./agent/backend/*` subpaths are not currently
re-exported through the `@rox-one/shared` `./agent` barrel, and
adding them would require modifying `packages/shared/package.json` —
out of scope for this ticket.

## 6. Test surface

`use-orchestrator.rtl.test.tsx` covers 8 cases:

1. **Dispatch happy path** — `Orchestrator.send` returns an `ok`
   result; the hook returns the full response, `pending` settles
   to `false`, `lastError` stays `null`.
2. **Dispatch error path** — the handler throws "provider unreachable";
   the orchestrator classifies as `ProviderUnavailableError`; the hook
   surfaces it on `lastError` and resolves the dispatch promise with
   `ok: false`.
3. **Pending toggle** — a held-open `send` keeps `pending` true; once
   released, the hook flips back to `false` after the act bracket.
4. **Streaming happy path** — `for await` consumes all three canned
   `ProviderStreamEvent`s (`chunk`, `chunk`, `end`), `pending` settles,
   `lastError` stays `null`.
5. **Stream open-time error** — the handler's stream throws on first
   pull; the iterator completes without yielding, `lastError` is set
   to `ProviderUnavailableError`.
6. **Stream iterator early `return()`** — consumer calls `it.return()`
   after the first chunk; the hook clears `pending` and avoids
   double-finishing the bracket.
7. **Unmount cleanup** — `unmount()` mid-flight; the promise resolves
   without React "setState on unmounted component" warnings (the
   internal `mountedRef` guards every setter).
8. **Concurrent dispatches** — two `dispatch` calls overlap; `pending`
   stays true while either is in flight and only flips to `false`
   after both settle (validates the in-flight counter rather than a
   single boolean toggle).

Run:

```bash
cd apps/electron && ~/.bun/bin/bunx vitest run \
  --config vitest.config.ts \
  src/renderer/hooks/__tests__/use-orchestrator.rtl.test.tsx
# Test Files  1 passed (1)
#      Tests  8 passed (8)
```

## 7. Validation

- `bunx vitest run …/use-orchestrator.rtl.test.tsx` → 8 / 8 passing.
- `cd apps/electron && bun run typecheck` → no errors on the new files
  (pre-existing TS errors in unrelated `*.rtl.test.tsx` and
  `auto-update.signature.test.ts` files survive but were not introduced
  here).
- `bun run validate:rebrand` → rebrand validation passed.
- `bun run validate:agent-contract` → ok: 11 skills, 309 tickets,
  7 required docs.
- `bun run validate:roadmap` → OK — 46 phases, 110 tickets across
  detail files.

## 8. Pure-renderer invariants

- The hook never imports `fs`, `fetch`, `process.env`, or any main /
  server-core module. The orchestrator is the only injected
  dependency.
- The hook is adapter-agnostic — the test suite wires a plain
  in-memory `ProviderHandler` literal rather than the T241-adapters
  fakes, demonstrating that only the kernel contract matters.
- All `setState` calls are gated by a `mountedRef`; unmount-mid-flight
  is a non-event for React.
- `pending` is backed by a counter so concurrent calls do not race the
  flag.

## 9. Rollback plan

Delete `apps/electron/src/renderer/hooks/useOrchestrator.ts` and
`apps/electron/src/renderer/hooks/__tests__/use-orchestrator.rtl.test.tsx`.
No other source file is modified. The T240 + T241-adapters + T242
source trees remain untouched.

## 10. Follow-up — T242c

The follow-up (T242c) plugs `useOrchestrator` into the chat composer +
workbench experience surfaces so user-driven turns dispatch through
the M.7 orchestrator rather than the legacy per-experience hand-rolled
paths. Out of scope here.
