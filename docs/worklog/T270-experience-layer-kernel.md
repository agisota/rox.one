# T270 - Experience Layer kernel

## 1. Task summary

Stand up the dependency-free Experience Layer kernel under
`packages/shared/src/experience-layer/`: branded id, exhaustive state and
event unions, a pure reducer, and a minimal `bindExperience` adapter over a
non-rxjs `Observable<T>`.

This is the M.9 prerequisite for T271 (renderer hook) and T272 (server emit
wiring). The kernel is shipped behind no flag because no caller in `main`
imports it yet — blast radius is zero.

## 2. Repo context discovered

- `packages/shared` is the canonical "shared business logic" package; its
  test runner is `bun test` co-located via `__tests__/`.
- The repo already follows a brand + parser pattern for ids (see
  `packages/shared/src/agent/backend/provider-id.ts`), so the kernel reuses
  the same `Result<T, E>` shape and module-local brand symbol idiom.
- `validate:rebrand` is broken on `origin/main` (pre-existing failures in
  `scripts/__tests__/rebrand-doc-cleanup.test.ts` and
  `scripts/check-bundle-budget.cjs`). Documented in the report; not in
  scope for T270.

## 3. Files inspected

- `packages/shared/src/agent/backend/provider-id.ts` (brand idiom)
- `packages/shared/src/agent/backend/__tests__/read-patterns.test.ts`
  (bun:test conventions)
- `packages/shared/package.json` (exports + scripts)
- `package.json` (validate scripts)
- `docs/tickets/T260-rebrand-canonical-decision-adr.md` (ticket format)
- `docs/worklog/T260-rebrand-canonical-decision-adr.md` (worklog format)

## 4. Files added

- `packages/shared/src/experience-layer/experience-id.ts`
- `packages/shared/src/experience-layer/experience-state.ts`
- `packages/shared/src/experience-layer/experience-event.ts`
- `packages/shared/src/experience-layer/experience-reducer.ts`
- `packages/shared/src/experience-layer/experience-bind.ts`
- `packages/shared/src/experience-layer/index.ts`
- `packages/shared/src/experience-layer/__tests__/experience-id.test.ts`
- `packages/shared/src/experience-layer/__tests__/experience-reducer.test.ts`
- `packages/shared/src/experience-layer/__tests__/experience-bind.test.ts`
- `docs/tickets/T270-experience-layer-kernel.md`
- `docs/worklog/T270-experience-layer-kernel.md`

## 5. Design choices

- **Brand symbol is module-local.** Same idiom as `ProviderId`. Callers can
  only obtain an `ExperienceId` through `parseExperienceId` or
  `unsafeExperienceId` (which throws on bad shape).
- **UUID v7 shape, not generation.** The kernel validates structurally
  (8-4-4-4-12 hex, version nibble `7`, variant nibble in `8|9|a|b`) but
  never mints ids. Minting is a host concern wired by T271.
- **Five state variants, not four.** `Mutating<T>` carries the
  pre-mutation snapshot plus `baseVersion` and `mutationId` so the
  renderer can show optimistic UI without losing the rollback target.
- **`MutationFailed` is two outcomes, not one.** `recoverable: true`
  restores `Ready` at `baseVersion`; `recoverable: false` transitions to
  `Error`. The reducer surfaces both with one event type.
- **`Reset` and `Fail` are universal.** Accepted from every state so
  callers always have an escape hatch without writing per-state branches.
- **Reducer never throws.** Illegal pairs are typed `TransitionError`
  values (`IllegalTransition`, `MismatchedId`, `MismatchedMutation`).
- **`bindExperience` is the only impure module.** `now` and
  `newMutationId` are injectable, so tests are deterministic.
- **No rxjs dependency.** `Observable<T> = { subscribe(o): () => void }`
  is the smallest contract that works with both a hand-rolled in-memory
  subject and any host adapter that wants to wrap rxjs / EventTarget /
  WebSocket framings.

## 6. Test plan

- `experience-id.test.ts` — 16 specs / 32 expects covering the parser,
  whitespace + case normalisation, every reject path, the brand escape
  hatch, and the `isExperienceId` guard.
- `experience-reducer.test.ts` — 42 specs covering the full state x event
  truth table, including the id-mismatch + mutation-id-mismatch guards
  and the assertion that the reducer never throws.
- `experience-bind.test.ts` — 15 specs covering subscribe + start,
  success + failure mutation lifecycles, source-error → Error, dispose
  idempotency, and illegal-transition reporting through
  `onTransitionError`.
- Total: 73 passing specs / 142 expect() calls (well above the ≥40 floor).

## 7. Validation

- `bun test packages/shared/src/experience-layer/__tests__/` → 73 pass /
  142 expects.
- `bun run validate:agent-contract` → passes.
- `bun run validate:roadmap` → passes.
- `bun run validate:rebrand` → fails on pre-existing repo state
  unrelated to T270. The failures are in
  `scripts/__tests__/rebrand-doc-cleanup.test.ts`,
  `scripts/__tests__/rebrand-asset-paths.test.ts`,
  `scripts/check-bundle-budget.cjs`, and a handful of
  `packages/shared/src/...` files I did not touch. None of the kernel
  files trip the validator. Re-running `validate:rebrand` against
  `origin/main` reproduces the same exit code 1 with the same findings,
  so this is not regression introduced by T270.

## 8. Follow-ups

- T271 — `useExperience(...)` React hook adapter.
- T272 — server emit wiring (push `loaded` events over the wire).
- T080 — mapping per spine (registry → kernel handle per surface).
- Cleanup ticket: fix `validate:rebrand` findings on `main` so the
  pre-push hook stops blocking unrelated branches.
