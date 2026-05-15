# T499 - RC2 plan security review repair

Status: DONE
Phase: RC2 spec/plan review repair
Ticket: docs/tickets/T499-rc2-plan-security-review-repair.md

## 1. Task summary

Repair PR #232's RC2 plan after code review identified unsafe GPG key handling
and inconsistent gitleaks hook semantics.

## 2. Repo context discovered

PR #232 is docs-only and adds two files:

- `docs/superpowers/specs/2026-05-15-v1.0.0-rc.2-design.md`
- `docs/superpowers/plans/2026-05-15-v1.0.0-rc.2.md`

Hosted checks were green before this repair, but the review found a
high-severity executable-plan problem: the A1 prompt used `%no-protection`,
exported a private key to a fixed `/tmp/rox-linux-gpg.asc`, and instructed
saving a passphrase in `/tmp/rox-gpg-passphrase.txt`.

## 3. Files inspected

- `docs/superpowers/specs/2026-05-15-v1.0.0-rc.2-design.md`
- `docs/superpowers/plans/2026-05-15-v1.0.0-rc.2.md`
- `docs/release/r11-post-230-current-worklist-2026-05-16.md`
- `docs/tickets/T498-r11-post-230-current-worklist.md`
- `docs/worklog/T498-r11-post-230-current-worklist.md`

## 4. Tests added first

No code test was added for this docs-only repair. The RED checks were:

```bash
test ! -f docs/tickets/T499-rc2-plan-security-review-repair.md
test ! -f docs/worklog/T499-rc2-plan-security-review-repair.md
rg -n "%no-protection|/tmp/rox-linux-gpg.asc|/tmp/rox-gpg-passphrase.txt" docs/superpowers/plans/2026-05-15-v1.0.0-rc.2.md
```

The absence checks exited 0. The `rg` check found all three unsafe markers.

## 5. Expected failing test output

The expected RED findings were:

```text
%no-protection
/tmp/rox-linux-gpg.asc
/tmp/rox-gpg-passphrase.txt
```

These proved the executable plan still carried unsafe key-handling
instructions.

## 6. Implementation changes

- Replaced the A1 GPG prompt with passphrase-protected key generation using an
  operator-supplied masked variable, private `mktemp -d` directories,
  `umask 077`, `--pinentry-mode loopback`, and `trap` cleanup.
- Removed fixed `/tmp` key and passphrase handoff paths from the plan.
- Reframed D1 as a best-effort local gitleaks guard that blocks only when the
  local scanner is installed; hosted secret-scan remains the hard gate.
- Updated D1 smoke-test expectations for installed and missing `gitleaks`
  branches.
- Added an RC2/R.11 ordering note requiring a post-merge R.11 report-only
  refresh.
- Added this ticket and worklog.

## 7. Validation commands run

- `test ! -f docs/tickets/T499-rc2-plan-security-review-repair.md`
- `test ! -f docs/worklog/T499-rc2-plan-security-review-repair.md`
- `rg -n "%no-protection|/tmp/rox-linux-gpg.asc|/tmp/rox-gpg-passphrase.txt" docs/superpowers/plans/2026-05-15-v1.0.0-rc.2.md`
  (RED before implementation)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Post-edit grep and validators passed:

```text
unsafe_gpg_markers_cleared

bun run validate:docs
[agent-contract] ok: 11 skills, 465 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md

bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

git diff --check
exit 0
```

## 9. Build output summary

No build is required for this docs-only plan repair. Runtime/source behavior is
unchanged.

## 10. Remaining risks

PR #232 still preempts the R.11 destructive path while it is open. After #232
lands or closes, R.11 needs a fresh report-only blocker refresh before any
tag, branch, backup, mirror, filter-repo, force-push, or goal-state action.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED checks prove absence and unsafe GPG markers | PASS | T499 files absent; `rg` found `%no-protection`, fixed key export, and fixed passphrase path |
| GPG instructions avoid unsafe markers | PASS | Post-edit grep reported `unsafe_gpg_markers_cleared` |
| Gitleaks language matches fail-open behavior | PASS | Plan now calls the hook best-effort and keeps hosted secret-scan as the hard required gate |
| RC2/R.11 ordering is explicit | PASS | Spec says this PR preempts R.11 until merged/abandoned and requires a post-merge R.11 refresh |
| Validators pass | PASS | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| No runtime/ref/history mutation | PASS | Docs-only edits |
