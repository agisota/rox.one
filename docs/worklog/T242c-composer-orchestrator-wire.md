# T242c-composer-orchestrator-wire - Composer Orchestrator Wiring

Status: DONE (audit-only)

## 1. Task summary

Smallest-possible integration of the T242b `useOrchestrator` renderer
hook into the composer agent dispatch path. The mandate: locate **one**
call site in `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
that constructs a provider/agent inline, decide whether routing it
through `useOrchestrator` is safe, and either wire it (≤80 LOC source
+ ≤200 LOC tests) or document the blocker and ship audit-only.

## 2. Repo context discovered

- `FreeFormInput.tsx` is 3334 LOC and serves as the chat composer.
- Submit path (`submitMessage`, lines 1487–1532) forwards through the
  `onSubmit` prop — no provider construction; not a wiring candidate.
- Two inline `create*Service({ provider: createDeterministic*Provider() })`
  call sites exist at lines 1912–1919:
  - `createPromptRewriteService({ provider: createDeterministicPromptRewriteProvider() })`
  - `createThinkingPartnerService({ provider: createDeterministicThinkingPartnerProvider() })`
- Both services live in `@rox-one/shared/workbench/*` and are
  domain-shaped — `PromptRewriteRequest` / `ThinkingPartnerRequest`,
  not the kernel `ProviderRequest` (`{ model, messages, ... }`) that
  `useOrchestrator.dispatch` accepts.
- The T242b hook is frozen by ticket constraints; the T240 backbone
  and T242 host composition are also frozen.
- Composer tests (`__tests__/`) use `vitest` (`*.rtl.test.tsx`) and
  `bun:test` (`*.test.ts`). The hook test
  (`use-orchestrator.rtl.test.tsx`) uses `vitest`.

## 3. Decision: audit-only, wiring blocked

The two inline call sites cannot be safely migrated through
`useOrchestrator(orchestrator)` at T242c:

1. **Shape mismatch.** Composer providers operate on domain-shaped
   requests; the orchestrator multiplexes LLM-shaped provider handlers.
   Bridging requires an adapter that doesn't exist on `main`.
2. **No LLM round-trip.** The current providers are deterministic
   synthesizers — they never reach an LLM. Routing them through the
   orchestrator adds ceremony without product value.
3. **Frozen-source constraint.** T242c forbids edits to the backbone,
   host composition, and the hook itself. An adapter would have to
   live outside those trees and still bridge two unrelated request
   shapes.
4. **Budget overrun risk.** Even one wire requires a new
   `PromptRewriteProvider → ProviderHandler` adapter file + a
   request-shape transformer — well past the "≤80 LOC source changes"
   budget for a surgical wire.

Outcome: ship the audit doc + ticket + this worklog. No source
changes. Recommend T242d to land a domain-shaped client hook (or
non-deterministic providers) that unblock a real wire.

## 4. Files touched

- `docs/release/m7-composer-orchestrator-audit.md` (new, audit)
- `docs/tickets/T242c-composer-orchestrator-wire.md` (new, ticket)
- `docs/worklog/T242c-composer-orchestrator-wire.md` (this file)

No source / test files modified.

## 5. Validation

Three repo-level validators run:

- `bun run validate:rebrand`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`

Results recorded in commit-time evidence.

## 6. Follow-up

T242d should land **one** of:

- A higher-level `useOrchestratorAgentClient` (or similar) renderer
  hook exposing domain-shaped methods (`rewritePrompt`, `thinkPartner`,
  `chat`) and internally adapting to `OrchestrationRequest`.
- Non-deterministic prompt-rewrite / thinking-partner providers that
  round-trip through an LLM — at which point the existing inline call
  sites become natural `useOrchestrator.dispatch` consumers.

Either unblocks T242c-style wiring without violating the T240/T242/T242b
frozen-source constraint.
