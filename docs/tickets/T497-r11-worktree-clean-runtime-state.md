# T497 - R.11 worktree clean runtime state

Status: DONE

## Context

After PR #229 merged, the only local dirty file was
`.omc/state/last-tool-error.json`. This tracked OMC runtime-state diff blocked
the R.11 `worktree-clean` row, but it was unrelated to product source,
release documentation, or R.11 backup/rewrite artifacts.

## Goal

Restore the tracked OMC runtime-state file to `HEAD` and record the resulting
R.11 preflight state so future R.11 work starts from a clean local worktree.

## Required UI

None.

## Required Data/API

No runtime data or public API changes.

## Required Automations

None.

## Required Subagents

Use read-only git/verifier subagents for the remaining-blocker audit when it
improves confidence. Durable evidence must come from local commands.

## TDD Requirements

- Confirm RED before cleanup: this ticket, worklog, snapshot, and completion
  audit section are absent.
- Confirm `worktree-clean` fails before cleanup.
- Confirm `worktree-clean` passes after restoring only
  `.omc/state/last-tool-error.json`.

## Implementation Requirements

- Restore only `.omc/state/last-tool-error.json`.
- Do not mutate tags, branches, backup refs, mirrors, history, force-pushed
  refs, or `/goal` state.
- Keep T298 blocked until the remaining R.11 ref, backup, legal-preserve,
  history-scan, and post-rewrite gates are green.

## Validation Commands

- `test ! -f docs/tickets/T497-r11-worktree-clean-runtime-state.md`
- `test ! -f docs/worklog/T497-r11-worktree-clean-runtime-state.md`
- `test ! -f docs/release/r11-worktree-clean-runtime-state-2026-05-16.md`
- `rg -q "Worktree Clean Runtime State" docs/release/r11-completion-audit-2026-05-15.md`
  (expected RED before implementation)
- `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight`
  before cleanup
- `git restore -- .omc/state/last-tool-error.json`
- `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight`
  after cleanup
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `git diff --check`

## Acceptance Criteria

- [x] RED checks prove the ticket, worklog, snapshot, and audit section were
  absent.
- [x] Pre-cleanup preflight records `worktree-clean` red.
- [x] Only `.omc/state/last-tool-error.json` is restored.
- [x] Post-cleanup preflight records `worktree-clean` green.
- [x] Remaining pre-backup blockers are limited to `rebrand-tag-on-main` plus
  `current-branch` while this report branch is checked out.
- [x] Validators pass.
- [x] No destructive R.11 action is performed.

## Worklog

See `docs/worklog/T497-r11-worktree-clean-runtime-state.md`.
