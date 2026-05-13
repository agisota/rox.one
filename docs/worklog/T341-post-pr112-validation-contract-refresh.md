# T341 - Post-PR112 validation contract refresh

Status: DONE
Phase: post-rebase validation repair
Ticket: docs/tickets/T341-post-pr112-validation-contract-refresh.md

## 1. Task summary

Repair two documentation validation contract drifts exposed after rebasing onto
current `origin/main`; final evidence was refreshed after PR #126.

## 2. Repo context discovered

The branch was cleanly rebased onto `origin/main` before rerunning the cheap
gates. `bun run validate:docs` failed because
`docs/tickets/T223-tenant-credential-key-derivation.md` used a markdown status
section instead of the `Status:` line required by
`scripts/validate-agent-contract.ts`.

`bun run validate:roadmap` failed because the spine ledger includes `M.1.3b`
for the landed Pi IPC scope propagation split, while the master roadmap only
had a numeric `Phase 1.3` heading.

## 3. Files inspected

- `scripts/validate-agent-contract.ts`
- `scripts/validate-roadmap-coherence.cjs`
- `docs/tickets/T223-tenant-credential-key-derivation.md`
- `docs/tickets/T215-c4-server-core-rpc-handlers-scope-migration.md`
- `docs/tickets/T216-pi-ipc-scope-propagation.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`

## 4. Tests added first

No new test file was needed. The existing validators are executable contract
tests for this documentation shape.

## 5. Expected failing test output

`bun run validate:docs` failed with:

- `[agent-contract] T223-tenant-credential-key-derivation.md missing Status line`

`bun run validate:roadmap` failed with:

- `phase M.1.3b appears in the ledger but has no matching # Phase heading in its owner file (lane M)`

## 6. Implementation changes

- Added `Status: TODO` to the stale T223 tenant-credential planning ticket so
  the agent-contract validator can parse it without treating the ticket as
  complete.
- Updated the master roadmap Phase 1.3 section to name the landed server-core
  RPC handler migration and added a Phase 1.3b section for the landed Pi IPC
  scope propagation split.
- Left runtime source untouched.

## 7. Validation commands run

- `bun run validate:docs` (red)
- `bun run validate:roadmap` (red)
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- `bun run validate:docs`: agent-contract, architecture docs, and sync-v2
  design passed; agent contract reported 11 skills, 303 tickets, and 7
  required docs.
- `bun run validate:roadmap`: 46 phases and 110 tickets validated.
- `bun run validate:rebrand`: no forbidden tokens outside the allowlist.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 3 existing React hook warnings and 0 errors.
- `bun test`: 6190 pass, 13 skip, 0 fail, 1 snapshot, 25152 expect calls.
- `git diff --check`: clean.

## 9. Build output summary

`bun run build` exited 0 after the full validation pass. Electron main,
preload, renderer, resources, and asset stages completed successfully.

## 10. Remaining risks

No known remaining documentation validation failures.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| T223 has a machine-readable status line | Green | `bun run validate:docs` exit 0 |
| M.1.3b has a matching master-roadmap heading | Green | `bun run validate:roadmap` exit 0 |
| Documentation validators pass | Green | `validate:docs`, `validate:roadmap`, and `validate:rebrand` exit 0 |
| Runtime source unchanged | Green | T341 changes are documentation-only |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
