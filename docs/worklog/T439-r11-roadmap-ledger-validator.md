# T439 - R.11 roadmap ledger validator

Status: DONE
Phase: R.11 report-only audit hygiene
Ticket: docs/tickets/T439-r11-roadmap-ledger-validator.md

## 1. Task summary

Extend `bun run validate:roadmap` so it permanently validates the rebrand rows
in `.swarm/master-roadmap-log.md`.

## 2. Repo context discovered

T438 fixed the only known phantom ticket entry in the R.9.5 ledger row. A
manual shell audit after T438 found no remaining missing rebrand ticket/worklog
artifacts and no malformed rebrand commit SHA cells in `.swarm/master-roadmap-log.md`.

The existing roadmap validator checks the spine, master-roadmap detail file,
rebrand detail file, and dependency graph. It does not read `.swarm/master-roadmap-log.md`.

## 3. Files inspected

- `.swarm/master-roadmap-log.md`
- `scripts/validate-roadmap-coherence.cjs`
- `scripts/__tests__/roadmap-coherence-validator.test.ts`
- `docs/tickets/T321-roadmap-coherence-validator-repair.md`
- `docs/worklog/T321-roadmap-coherence-validator-repair.md`

## 4. Tests added first

Added two regression cases to
`scripts/__tests__/roadmap-coherence-validator.test.ts`:

- a malformed temporary copy of `.swarm/master-roadmap-log.md` that inserts
  phantom `T299a` into the R.9.5 row;
- a temporary empty worklog directory fixture proving an existing rebrand
  ledger ticket fails when its matching worklog artifact is missing.

## 5. Expected failing test output

The first regression failed before implementation because
`scripts/validate-roadmap-coherence.cjs` did not inspect the `.swarm` ledger:

```text
Expected: 1
Received: 0
validate:roadmap OK - 46 phases, 110 tickets across detail files
```

## 6. Implementation changes

- Extended `scripts/validate-roadmap-coherence.cjs` to read
  `.swarm/master-roadmap-log.md` by default.
- Added `ROX_ROADMAP_LOG_PATH`, `ROX_ROADMAP_TICKET_DIR`, and
  `ROX_ROADMAP_WORKLOG_DIR` fixture overrides for validator tests.
- Added committed rebrand-row validation for:
  - four pipe-separated cells;
  - non-empty phase/SHA/ticket/timestamp cells;
  - comma-separated SHA-looking commit cells;
  - ticket IDs shaped like `T###` or `T###a`;
  - matching ticket file existence;
  - matching basename worklog file existence;
  - at least one matching candidate pair with `Status: DONE` and all
    11 required worklog sections.
- Kept the current duplicate ticket-number reality safe by accepting the
  matching ticket/worklog basename pair that satisfies the rebrand ledger
  contract.

## 7. Validation commands run

- `bun test scripts/__tests__/roadmap-coherence-validator.test.ts`
- `bun run validate:roadmap`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/roadmap-coherence-validator.test.ts`: 3 pass,
  0 fail, 8 expect calls.
- `bun run validate:roadmap`: `validate:roadmap OK - 46 phases, 110 tickets
  across detail files, 14 rebrand master-roadmap log rows`.
- `bun run validate:docs`: green; agent contract reports 404 tickets and
  7 required docs.
- `bun run validate:rebrand`: green.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only validator/test change.

## 10. Remaining risks

R.11 remains blocked on hard prerequisites. This ticket does not authorize tag
mutation, backup creation, mirror creation, `git filter-repo`, force-push, or
branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED regression fails against malformed `.swarm` rebrand ledger copy | PASS | Targeted test initially failed because validator exited 0 on injected `T299a` |
| `validate:roadmap` rejects missing rebrand ledger artifacts | PASS | Regression covers missing ticket artifact and missing worklog artifact fixtures |
| Current `.swarm/master-roadmap-log.md` passes extended validator | PASS | `validate:roadmap` reports 14 rebrand master-roadmap log rows checked |
| Targeted test and validators pass | PASS | Targeted test, roadmap/docs/rebrand validators, typecheck, lint, and diff-check pass |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup commands were run |
