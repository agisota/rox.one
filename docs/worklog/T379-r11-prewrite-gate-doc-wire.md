# T379 - R.11 pre-rewrite gate doc wire

Status: DONE
Phase: R.11 preflight documentation
Ticket: docs/tickets/T379-r11-prewrite-gate-doc-wire.md

## 1. Task summary

Wire the explicit `--stage pre-rewrite` preflight helper into the R.11 goal file
so the documented destructive sequence matches the staged helper added in T378.

## 2. Repo context discovered

T378 added two report-only helper stages:

- Default `bun run rebrand:r11-preflight`: pre-backup gate.
- `bun run rebrand:r11-preflight --stage pre-rewrite`: post-backup,
  pre-filter-repo gate that requires backup tag and offline mirror.

The goal file still described only manual backup-artifact confirmation before
`git filter-repo`, so an operator following the goal would not see the new
executable pre-rewrite gate.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `scripts/rebrand-r11-preflight.ts`
- `docs/tickets/T378-r11-preflight-stage-split.md`
- `docs/worklog/T378-r11-preflight-stage-split.md`

## 4. Tests added first

Extended the R.11 goal documentation regression in
`scripts/__tests__/rebrand-r11-preflight.test.ts` to require:

```text
bun run rebrand:r11-preflight --stage pre-rewrite
```

## 5. Expected failing test output

Before the goal update:

```text
Expected to contain: "bun run rebrand:r11-preflight --stage pre-rewrite"
```

The failure proved the goal file had not yet documented the new pre-rewrite
stage.

## 6. Implementation changes

- Added the explicit `bun run rebrand:r11-preflight --stage pre-rewrite`
  command after the backup tag/offline mirror confirmation and before the
  filter-repo plan.
- Added a hard stop if the pre-rewrite helper exits non-zero.
- Did not run backup creation, filter-repo, or any force-push step.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts` (GREEN)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted test:

```text
6 pass
0 fail
17 expect() calls
```

Documentation validation:

```text
[agent-contract] ok: 11 skills, 344 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Whitespace validation:

```text
git diff --check
```

exited 0 with no output.

## 9. Build output summary

No build was run. This is a documentation and regression-test alignment change
for the report-only preflight workflow.

## 10. Remaining risks

R.11 remains blocked by the active Codex goal. This ticket improves the
operator sequence once that hard stop is truthfully cleared, but does not run
backup or rewrite steps.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Documentation regression fails before the goal update | Green | RED output captured in section 5 |
| Goal file names the exact pre-rewrite helper command | Green | Goal file contains `bun run rebrand:r11-preflight --stage pre-rewrite` |
| Goal file stops operators on non-zero pre-rewrite helper result | Green | Goal file says to stop and not run `git filter-repo` |
| Targeted tests pass | Green | `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 6 pass |
| Documentation/rebrand validation remains green | Green | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Commit created | Green | Local Lore commit created for this ticket |
