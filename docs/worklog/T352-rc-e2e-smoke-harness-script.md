# T352 - RC E2E Smoke Harness Script

## 1. Task Summary

Add the missing `e2e:smoke` command required by the Phase 20 RC scenario tickets
so S01 through S10 can run through one reproducible harness.

## 2. Repo Context Discovered

`T339` requires `bun run e2e:smoke -- --scenario s01-registration`. On current
`main` at `66252d82`, that command fails at script lookup time because the root
`package.json` has no `e2e:smoke` script.

Existing related scripts include `e2e:core`, `electron:smoke`, and
`electron:ui-smoke:packaged:mac`.

## 3. Files Inspected

- `docs/tickets/T339-rc-s01-multi-tenant-registration.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `package.json`
- `scripts/electron-ui-smoke-packaged-mac.ts`

## 4. Tests Added First

Not implemented in this handoff ticket. The expected red condition is recorded
from the S01 validation run.

## 5. Expected Failing Test Output

```text
error: Script not found "e2e:smoke"
```

## 6. Implementation Changes

No harness implementation was added in this handoff. This ticket captures the
blocker that must be implemented before S01 can proceed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
```

## 8. Passing Test Output Summary

- `bun run validate:agent-contract`: ok, 11 skills, 305 tickets, 7 required
  docs.
- `bun run validate:docs`: ok, architecture docs and sync-v2 design validated.

## 9. Build Output Summary

No build was run. This is a blocker ticket authored from a failed validation
entry point and contains no runtime changes.

## 10. Remaining Risks

- The eventual harness must avoid hanging on unsupported host environments.
- The S01 scenario still needs actual Electron smoke evidence and screenshots
  after this blocker is resolved.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| `e2e:smoke` missing state is reproduced | Pass | `bun run e2e:smoke -- --scenario s01-registration` failed with script not found |
| Dedicated blocker ticket exists | Pass | `docs/tickets/T352-rc-e2e-smoke-harness-script.md` |
| Runtime code unchanged | Pass | Ticket/worklog/evidence-only handoff |
