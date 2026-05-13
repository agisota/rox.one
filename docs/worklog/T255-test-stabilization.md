# T255 worklog — test stabilization sweep + edge-case coverage

Status: DONE

## 1. Goal

Add ≥5 deterministic edge-case unit tests on RBAC and observability surfaces,
inventory all skipped/exclusive tests, and document the test-suite baseline
without modifying any source code under `packages/` or `apps/`.

## 2. Baseline (origin/main, SHA 7850fd8)

`bun test` (no excluded files):

```
2260 pass
 270 fail
   1 skip
2531 tests across 499 files
```

`bun run test:units`:

```
2257 pass
   1 skip
 273 fail
 247 errors
2531 tests across 499 files
```

Validators (all green):

- `bun run validate:rebrand` — rebrand validation passed
- `bun run validate:agent-contract` — 11 skills, 255 tickets, 7 required docs
- `bun run validate:roadmap` — 46 phases, 111 tickets across detail files

## 3. Surfaces inspected

| Surface | Decision |
| ------- | -------- |
| `packages/shared/src/auth/policy-engine.ts` | In-scope; added 18 edge-case tests. |
| `packages/shared/src/observability/audit-event.ts` | In-scope; added 25 edge-case tests. |
| `packages/shared/src/storage/branded-workspace-scope.ts` | **Does not exist on `main`** — no file matches the path. Deferred to T256 with note. |
| `apps/electron/src/main/account-session-store.ts` | Out of scope for T255 — FS fallback needs an integration harness that touches more than test-only files. Deferred to T256. |
| `packages/server-core/src/missions/transitions.ts` | Pre-existing coverage; left untouched per ticket instructions. |

Two surfaces selected, ≥3 tests each: requirement satisfied (18 + 25 ≥ 5).

## 4. Skipped / exclusive test inventory

Regex used: `(it|test|describe)\.skip\(|...\.only\(|\bxit\(|\bxtest\(|\bfdescribe\(|\bfit\(`

Findings (test-relevant):

- `packages/shared/src/agent/backend/__tests__/factory.test.ts:255` —
  `it.skip('initializeBackendHostRuntime throws for dist-style host root in dev', ...)`.
  Intentional skip; un-skip behind T256.

No `.only`, `xit`, `xtest`, `fdescribe`, or `fit` test directives found.
(`model.fit(...)` in `turn-card.tsx` is a string literal inside a Python
training-script template, not a Mocha-style exclusive.)

## 5. Changes

### 5.1 New test file — policy engine edge cases

`packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts` (NEW)

18 tests covering:

- empty `grants` array variants (mutable, frozen, repeated calls)
- `no-grant` vs `no-matching-scope` reason distinction
- unknown / empty / whitespace / case-mutated `roleId` values
- `scopeId === null` and `scopeId === ''` on workspace scope
- case-sensitive scope id matching (forgery-resistance proxy)
- first-grant-wins reason encoding
- `permittedWorkspaces` frozen-array invariant
- mixed grants with a global read collapse to the global sentinel
- purity across repeated invocations

### 5.2 New test file — audit-event edge cases

`packages/shared/src/observability/__tests__/audit-event.edge-cases.test.ts` (NEW)

25 tests covering:

- actor lattice (`system` allowed without id; `user`/`service` require non-empty id)
- subject lattice (`user`/`workspace`/`mission`/`role`; empty/non-string id rejected)
- scope lattice (`global`/`workspace`/`mission`; unknown `org` rejected)
- kind whitelist strictness (case-sensitive, whitespace-intolerant)
- exhaustive accept-pass for every `AUDIT_EVENT_KINDS` entry
- `ts` and `correlationId` empty/non-string rejection
- JSON-revival drift (stringified actor, array-wrapped scope, deep clone)

### 5.3 Test stability report

`docs/release/test-stability-report.md` (NEW, 109 LOC).

### 5.4 Ticket + worklog

`docs/tickets/T255-test-stabilization.md` (NEW)
`docs/worklog/T255-test-stabilization.md` (NEW, this file)

## 6. After-state

`bun test packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts`:

```
18 pass, 0 fail, 42 expect() calls
```

`bun test packages/shared/src/observability/__tests__/audit-event.edge-cases.test.ts`:

```
25 pass, 0 fail, 55 expect() calls
```

`bun test packages/shared/src/observability/__tests__/`:

```
84 pass, 0 fail, 206 expect() calls (six test files)
```

Validators (all still green):

- `bun run validate:rebrand` — pass
- `bun run validate:agent-contract` — pass (256 tickets now)
- `bun run validate:roadmap` — pass

## 7. Deviations from ticket scope

- **`branded-workspace-scope`** surface: ticket listed `packages/shared/src/storage/branded-workspace-scope.ts`, but no file matches that path on `main`. Substituted with `observability/audit-event.ts` which is in-scope per the ticket list ("Pick TWO of those four surfaces"). Two surfaces covered: policy-engine + audit-event.
- **`account-session-store.ts`** surface: FS-error fallback paths require either mocking the Electron `app.getPath` boundary or pre-staging the corruption fixture; both approaches would require source coupling. Deferred to T256 with a note in the report.

## 8. Definition of Done

- [x] ≥5 new unit tests across two source surfaces (delivered 43)
- [x] Skipped tests inventoried
- [x] No source under `packages/` or `apps/` modified
- [x] No existing tests removed or modified
- [x] `validate:rebrand`, `validate:agent-contract`, `validate:roadmap` pass
- [x] Stability report ≤150 LOC at `docs/release/test-stability-report.md`
- [x] Two atomic commits
- [x] PR opened
