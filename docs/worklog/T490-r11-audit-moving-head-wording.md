# T490 - R.11 audit moving-head wording

Status: DONE
Phase: R.11 report-only audit wording
Ticket: docs/tickets/T490-r11-audit-moving-head-wording.md

## 1. Task summary

Clarify the 2026-05-15 R.11 audit so captured `/tmp` evidence is not mistaken
for a moving "latest main" proof after later report-only commits.

## 2. Repo context discovered

After PR #224 merged, `main` advanced from the audit packet's captured
`527e594f8bace7ea2a47e655a266ae030d368179` to merge commit `996ff8e4`.
The R.11 blockers did not change: the active `/goal` still exists,
`rebrand-v1` still peels to a commit missing from `origin/main` ancestry,
backup artifacts are missing, remote branch review is still required, and the
history/legal-preserve gates remain red until the destructive rewrite path
actually runs.

## 3. Files inspected

- `docs/release/r11-completion-audit-2026-05-15.md`
- `docs/worklog/T489-r11-20260515-completion-audit.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`

## 4. Tests added first

No code test was added. The RED checks were:

```bash
test ! -f docs/tickets/T490-r11-audit-moving-head-wording.md
rg -q "captured evidence packet" docs/release/r11-completion-audit-2026-05-15.md
```

The ticket absence check passed, and the `rg` check exited 1 before
implementation because the clarifying wording was absent.

## 5. Expected failing test output

The expected failing signal was the empty `rg -q` exit code 1. This proved the
audit wording still needed clarification.

## 6. Implementation changes

- Added `docs/tickets/T490-r11-audit-moving-head-wording.md`.
- Added this 11-section worklog.
- Updated `docs/release/r11-completion-audit-2026-05-15.md` to describe the
  `/tmp` bundle as a captured evidence packet and avoid claiming it is the
  latest moving `main` state.
- Updated `docs/worklog/T298-rebrand-git-history-rewrite.md` with a T490
  anchor.
- Did not mutate refs, backup artifacts, mirrors, history, or goal state.

## 7. Validation commands run

- `test ! -f docs/tickets/T490-r11-audit-moving-head-wording.md`
- `rg -q "captured evidence packet" docs/release/r11-completion-audit-2026-05-15.md`
  (RED before implementation)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Report-only validators passed:

```text
[agent-contract] ok: 11 skills, 457 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
rebrand validation passed: no forbidden tokens outside the allowlist
git diff --check OK
```

The wording check now finds `captured evidence packet` in
`docs/release/r11-completion-audit-2026-05-15.md`.

## 9. Build output summary

No build is required for this report-only documentation wording change.

## 10. Remaining risks

R.11 remains blocked. This ticket only improves audit wording and does not
authorize `/goal` clearing, tag mutation, backup creation, branch deletion,
`git filter-repo`, force-push, or `update_goal`.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED checks prove ticket and wording were absent | PASS | T490 ticket absent; `rg -q "captured evidence packet"` exited 1 |
| Audit distinguishes captured evidence from latest moving head | PASS | Audit wording updated |
| T298 worklog points at T490 | PASS | T298 representative anchors include T490 |
| Validators pass | PASS | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| No destructive R.11 action is performed | PASS | Docs-only report change |
