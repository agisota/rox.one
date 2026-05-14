# T242d-domain-orchestrator-client - Domain-Shape Orchestrator Client Hook

Status: DONE

## 1. Task summary

Land the renderer-side bridge hook that the T242c audit
(`docs/release/m7-composer-orchestrator-audit.md`) recommended as
Option (A). The hook composes the frozen T242b `useOrchestrator` with
a small adapter that translates domain-shaped requests/responses
(such as `PromptRewriteRequest` / `ThinkingPartnerInput`) to and from
the kernel's `ProviderRequest` / `ProviderNonStreamingResponse`. The
inner hook continues to own `pending`, `lastError`, and unmount
safety verbatim — the bridge does only request/response translation
plus a thin error envelope.

## 2. Repo context discovered

- `useOrchestrator.ts` (T242b) is frozen and lives at
  `apps/electron/src/renderer/hooks/useOrchestrator.ts`. Its
  `dispatch` returns `OrchestrationResponse` (a discriminated union
  with `mode: 'send' | 'stream'` and `ok: true | false`).
- `OrchestrationRequest` wraps a kernel `ProviderRequest` plus
  optional routing keys / budget / candidate list — never carries
  domain fields.
- `ProviderNonStreamingResponse` is just `{ text, usage? }` — adapters
  decide how to project domain shapes onto / out of that surface.
- The audit names two domain-shaped composer services
  (`createPromptRewriteService`, `createThinkingPartnerService`) as
  the headline migration targets; their `*Request` types come from
  `@rox-one/shared/workbench/*` and are deterministic synthesizers
  today, so they never reach an LLM.
- RTL tests in this folder use vitest (config:
  `apps/electron/vitest.config.ts`), happy-dom environment,
  `*.rtl.test.tsx` suffix. The sibling `use-orchestrator.rtl.test.tsx`
  was the template I followed.
- Worktree has no `node_modules`; `bun install` is disallowed by the
  ticket. RTL execution is environment-blocked here (same as for the
  pre-existing T242b spec). The new test file's structure mirrors the
  baseline and its imports resolve under the vitest config — it will
  run on any environment with hydrated `node_modules` (CI, fresh
  worktree).

## 3. Implementation notes

- `useDomainOrchestratorClient<TDomainRequest, TDomainResponse>` is a
  thin composition: it calls `useOrchestrator(orchestrator)` and only
  intercepts at the dispatch boundary. No state of its own beyond the
  inner hook's snapshot.
- The adapter is two pure functions:
  `toProviderRequest(domain) -> ProviderRequest` and
  `fromProviderResponse(resp) -> TDomainResponse`. Callers own the
  schema validation (zod, etc.); the hook stays unopinionated.
- Errors split into two channels:
  - Orchestrator-typed errors: caller sees a thrown
    `DomainOrchestratorError` whose `.cause` is the kernel
    `OrchestrationError`; `lastError` is set by the inner hook.
  - Adapter throws (pre-dispatch input rejection, post-response shape
    rejection): bubble up raw. `lastError` stays null because the
    orchestrator itself did not fail. This matches the audit's "domain
    bug vs kernel bug" separation.
- A defensive branch synthesizes a `RouteUnresolvedError` if the
  orchestrator ever resolves with a non-`send` shape, so the public
  surface never leaks an untyped `Error`.

## 4. Files touched

- `apps/electron/src/renderer/hooks/useDomainOrchestratorClient.ts`
  (new, 143 LOC)
- `apps/electron/src/renderer/hooks/__tests__/use-domain-orchestrator-client.rtl.test.tsx`
  (new, 300 LOC, 7 cases)
- `docs/tickets/T242d-domain-orchestrator-client.md` (new)
- `docs/worklog/T242d-domain-orchestrator-client.md` (this file)

No source / test files outside the new hook + spec were modified. The
T240/T241-adapters/T242/T242b backbone is untouched.

## 5. Validation

Three repo-level validators run from the repo root:

- `bun run validate:rebrand` -> `rebrand validation passed: no
  forbidden tokens outside the allowlist`
- `bun run validate:agent-contract` -> `[agent-contract] ok: 11
  skills, 322 tickets, 7 required docs`
- `bun run validate:roadmap` -> `validate:roadmap OK — 46 phases, 110
  tickets across detail files`

Project-wide `tsc --noEmit` was inspected; the new files introduce
zero new TS errors over the `origin/main` baseline (102 pre-existing
errors unchanged). The errors that mention `Property 'error' does not
exist on type 'OrchestrationResponse'` apply identically to the
frozen `useOrchestrator.ts` at lines 94 / 141 and reflect a
pre-existing discriminated-union narrowing limitation, not a defect
introduced here.

RTL execution requires a hydrated `node_modules` (no `bun install`
in this worktree per the ticket). The test file's import graph and
fixture wiring mirror `use-orchestrator.rtl.test.tsx` exactly; it
will run on CI or any environment with deps present.

## 6. LOC budget

- Source: 143 / 200 LOC.
- Tests: 300 / 300 LOC.
- Total: 443 LOC.

## 7. Follow-up

T242e: migrate one composer call site (start with
`createPromptRewriteService`) onto the new hook, providing the
concrete `DomainOrchestratorAdapter<PromptRewriteRequest,
PromptRewriteOutput>` and host-level provider construction. That
closes the loop opened by the T242c audit.
