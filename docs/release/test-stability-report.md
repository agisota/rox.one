# Test Stability Report — M.15 T255

Date: 2026-05-13
Ticket: [T255-test-stabilization](../tickets/T255-test-stabilization.md)
Branch: `feat/M15-test-stabilization`

## 1. Summary

T255 is a stabilization sweep. It does not modify any source under `packages/`
or `apps/`; it adds two new edge-case test files and documents the shape of
flakiness already present on `origin/main` so that T256 can decide how to
attack each failing surface.

## 2. Test count (before / after)

| Metric | Before | After  | Delta |
| ------ | ------ | ------ | ----- |
| Total `bun test` runs                | 2531 | 2574 | +43 |
| Pass                                  | 2260 | 2303 | +43 |
| Fail                                  | 270  | 270  | 0   |
| Skip                                  | 1    | 1    | 0   |
| Errors (load-time, e.g. missing deps) | many | many | 0   |

The 43 new tests are split across two new files:

- `packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts` — 18 tests
- `packages/shared/src/observability/__tests__/audit-event.edge-cases.test.ts` — 25 tests

## 3. Skipped / exclusive tests inventory

Found via `grep -nE "(it|test|describe)\.skip\(|...\.only\(|\bxit\(|..."`:

| File | Line | Status | Rationale |
| ---- | ---- | ------ | --------- |
| `packages/shared/src/agent/backend/__tests__/factory.test.ts` | 255 | `it.skip` | `initializeBackendHostRuntime throws for dist-style host root in dev` — intentionally skipped; requires dist layout setup the host doesn't yet expose to tests. Deferred to T256 (or to backend-host refactor). |

No `.only`, `xit`, `xtest`, `fdescribe`, or `fit` calls were found in the
test corpus. The single hit on `model.fit(X, y)` is a string inside
`apps/electron/src/renderer/playground/registry/turn-card.tsx` (a Python
training-script literal), not a test directive.

## 4. New coverage areas added

### 4.1 `packages/shared/src/auth/policy-engine.ts`

The base suite (`policy-engine.test.ts`, 27 tests) already covers the
canonical allow/deny matrix. T255 adds the boundary lattice:

- empty `grants` deny is identical to a frozen-empty deny
- `no-grant` vs `no-matching-scope` reason distinction is locked in
- empty / whitespace / unknown `roleId` values all deny without throwing
- `scopeId === null` and `scopeId === ''` on workspace scope deny
- scope id matching is **case-sensitive** (forgery-resistance proxy)
- first-grant-wins reason encoding is asserted (`workspace-viewer`
  beats `workspace-owner` when listed first)
- `permittedWorkspaces` returns a **frozen** array (mutation-resistant)
- mixed grants with a global read collapse to the global sentinel
- unknown role grants never enumerate workspaces

### 4.2 `packages/shared/src/observability/audit-event.ts`

The base suite (`audit-event.test.ts`, 11 tests) round-trips the canonical
event shapes through `isAuditEvent`. T255 adds the runtime-guard lattice:

- actor types: `system` (no id), `user`/`service` (id required, non-empty)
- subject types: all four canonical types accepted; empty / non-string id
  rejected
- scope kinds: `global` / `workspace` / `mission` exhaustively asserted;
  the unsupported `org` shape is rejected
- kind whitelist is **strict** — case-sensitive, whitespace-intolerant
- `ts` and `correlationId` reject empty strings and non-string values
- JSON-revival drift: stringified actor, array-wrapped scope, deep clones

## 5. Known gaps deferred to T256

These were identified during the sweep but explicitly out of scope for T255
(which is test-only and source-immutable):

1. **Auth barrel exports** (`packages/shared/src/auth/__tests__/exports-and-session-context.test.ts`) — 3 fails caused by a missing `@anthropic-ai/claude-agent-sdk` module resolution in the workspace. Source-level dependency wiring required.
2. **`SourceCredentialManager` sessionContext threading** (3 fails) — same SDK resolution issue.
3. **`registerFilesHandlers` runtime integrations** (3 fails) — IPC / workspace-scope wiring needs an integration harness; cannot be patched test-only.
4. **`piDriver.testConnection` Anthropic-compatible endpoint** — single fail; behind the same SDK resolution.
5. **Headless server smoke** (4 fails, timeouts at 15–30s) — flaky; needs a deterministic shutdown signal or a longer timeout. Defer to T256 for analysis.
6. **`Phase R.8 — user-data migration`** — single fail; expected after rebrand shim policy change.
7. **`auth-event-writer` ensureDefaultPermissions migration** — flaky-on-cold-cache; needs investigation.
8. **`branded-workspace-scope`** — the ticket scope mentioned this surface, but no source file matching `branded-workspace-scope` exists on `main` yet. Defer until the surface lands.
9. **`apps/electron/src/main/account-session-store.ts` FS-error fallback** — non-trivial to mock without touching the test harness; defer until session-store FS fallback ticket.
10. **`factory.test.ts:255` skipped test** — un-skip after backend-host dist-layout test harness is in place.

## 6. Validation results (T255 gate)

| Gate | Result |
| ---- | ------ |
| `bun test packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts` | 18 pass, 0 fail |
| `bun test packages/shared/src/observability/__tests__/audit-event.edge-cases.test.ts` | 25 pass, 0 fail |
| `bun test packages/shared/src/observability/__tests__/` | 84 pass, 0 fail |
| `bun run validate:rebrand` | pass |
| `bun run validate:agent-contract` | pass |
| `bun run validate:roadmap` | pass |

`bun run test:units` overall pass/fail counts are unchanged outside of the
+43 deltas above; no previously-passing test now fails.

## 7. Conclusion

T255 lands +43 deterministic edge-case tests on the two highest-risk
boundary surfaces (RBAC policy decision, audit-event runtime guard). The
suite is stable, source-immutable, and leaves a documented backlog for
T256 to drive the 270 pre-existing fails to green.
