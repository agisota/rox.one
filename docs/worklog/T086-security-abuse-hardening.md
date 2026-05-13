# T086 - Security and Abuse Hardening Worklog

## 1. Task summary

Close the remaining Experience runtime finalization spoofing path: a mission
must not reach completed/final VDI state from arbitrary artifact or gate
reference strings.

## 2. Repo context discovered

- T071 already covers scheduler budget spoofing, branch expansion validation,
  public share redaction, account billing redaction, and existing
  tenant/RBAC/package/entitlement tests.
- T074-T084 added the runtime event store and product-wide Experience flow.
- `ExperienceRuntimeStore.finalizeMission()` currently checks that final
  artifact and gate evidence strings are present, but does not prove that the
  artifact exists, the gate result exists, the gate passed, or no blocking
  failed gate remains.
- This is narrower than the full security matrix but directly covers the RC
  target rule: no final mission pass without evidence.

## 3. Files inspected

- `docs/tickets/T071-security-abuse-hardening.md`
- `docs/worklog/T071-security-abuse-hardening.md`
- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts`
- `packages/server-core/src/sessions/share-provider.test.ts`
- `packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts`

## 4. Tests added first

- Added `denies mission finalization spoofing with missing or failed evidence`
  in `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`.
- The test covers:
  - forged artifact/gate reference strings cannot complete a mission;
  - a stored final artifact plus blocking failed gate cannot complete a mission;
  - a stored final artifact plus passing gate can complete the mission and
    increase VDI.

## 5. Expected failing test output

Initial red command:

```bash
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts
```

Expected failure:

```text
ExperienceRuntimeStore > denies mission finalization spoofing with missing or failed evidence
Expected: "running"
Received: "completed"
```

## 6. Implementation changes

- Hardened `finalizeMission()` in
  `packages/shared/src/workbench/experience-runtime-store.ts`.
- Mission finalization now requires:
  - `finalArtifactId` points to an artifact already stored in runtime truth;
  - final artifact belongs to the finalized mission when it has a mission id;
  - at least one referenced gate result already exists and has `status:
    "pass"`;
  - passing gate belongs to the finalized mission when it has a mission id;
  - no blocking failed gate remains for the same mission.
- Invalid finalization events now produce an error notification and leave the
  mission running.

## 7. Validation commands run

```bash
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts packages/shared/src/workbench/__tests__/experience-layer-security.test.ts packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/webui/__tests__/account-cabinet.test.ts apps/electron/src/main/__tests__/account-session-store.test.ts
bun run typecheck:all
bun run validate:docs
bun run lint
git diff --check
```

## 8. Passing test output summary

- Runtime store targeted: `7 pass`, `0 fail`, `38 expect() calls`.
- Broad T086 security set: `44 pass`, `0 fail`, `151 expect() calls`.
- Typecheck: `bun run typecheck:all` passed.
- Docs validation: passed; agent contract reported `87 tickets`.
- Lint: passed with existing three React hook dependency warnings in
  `App.tsx` and `FreeFormInput.tsx`.
- `git diff --check`: passed.

## 9. Build output summary

No Electron build was required for this shared runtime security reducer change.
T084 already ran `bun run electron:build` successfully on the current branch;
T087 will run the final RC build gate.

## 10. Remaining risks

- This pass closes a focused finalization spoofing path. Broader production
  hardening still depends on T087 final release validation and remote CI.
- Production DB adapters must preserve the same invariant: final state changes
  must reference stored artifact and passing gate rows, not caller-supplied
  strings alone.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Forged final artifact/gate refs cannot complete mission | Pass | Runtime store regression |
| Failed blocking gate prevents final pass | Pass | Runtime store regression |
| Existing Experience/security tests pass | Pass | Broad T086 security set |
| Worklog complete | Pass | This file |
| Commit exists | Pass | Scoped Lore commit for T086 |

## 12. M.13 follow-up — RPC integration test for T071 primitives

After T071 shipped `TokenBucket`, `SlidingWindowCounter`, and `BudgetGuard` to
`packages/shared/src/security/` (PR #133), T086 needed a focused integration
test that proves these primitives behave correctly end-to-end against a real
handler call site without yet rewiring any handler source. T086b will land
the actual RPC handler wiring; this pass establishes the safety net first.

### Files touched

- New: `packages/server-core/src/handlers/rpc/__tests__/abuse-hardening-integration.test.ts`
- No handler source modified.
- Ticket `## Completion` appended.

### Test coverage

10 tests, 53 `expect()` calls, suite runtime ~43 ms. Clock is injected so no
real-time waits are needed and the suite is deterministic in CI.

Per-primitive checks:

- TokenBucket capacity=100, refill=100/s: 1000 immediate `tryAcquire(1)` admit
  exactly 100 and reject 900; after draining, 500 ms simulated time refills 50
  tokens and refills clamp at capacity; `tryAcquire(n)` does not mutate when
  the request exceeds available tokens.
- SlidingWindowCounter `windowMs=1000`: 50 records inside a fixed-clock window
  return `count() == 50`; advancing past the window prunes all 50 events and
  the next `record()` returns 1. Partial-window pruning verified separately.
- BudgetGuard `budgetPerKey=10`: 5+5+1 returns ok/ok/exceeded with the right
  `BudgetExceededError` payload; reset restores; per-key isolation holds;
  negative and `NaN` amounts return `reason: 'invalid-amount'` without
  mutating usage.

Composed scenarios (mock `RolesHandlerLike`):

- TokenBucket guard in front of mock handler: 12 calls, capacity 5, refill 0.
  Exactly 5 reach the handler and 7 are short-circuited as throttled. The
  `callCount()` spy confirms throttled calls never reach storage.
- Combined TokenBucket + BudgetGuard: bucket capacity 10, per-user budget 3.
  Abuser caps at 3 reaching the handler with 3 over-budget rejects; a
  different user is unaffected.

### Validation

```bash
bun test packages/server-core/src/handlers/rpc/__tests__/abuse-hardening-integration.test.ts
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

### Rollback

Revert the single commit on `feat/M13-T086-rpc-integration-v2`. The added test
is the only artifact; no production source is touched and the T071 frozen
primitives are not modified.
