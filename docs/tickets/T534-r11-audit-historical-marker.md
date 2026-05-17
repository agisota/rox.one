# T534 - R.11 audit historical marker

Status: DONE

## Context

After the R.11 destructive rewrite landed at commit `c0cc869d` (2026-05-16),
two R.11 completion audit files existed with conflicting statuses:

- `docs/release/r11-completion-audit-2026-05-14.md` — `Status: ACHIEVED`
  (refreshed at `99502fa7` as part of T527 after the rewrite).
- `docs/release/r11-completion-audit-2026-05-15.md` — `Status: NOT ACHIEVED`
  (authored before the rewrite; describes the report-only blocker state that
  existed at the time).

The 2026-05-15 audit was accurate when written but became misleading after the
rewrite completed, because a reader scanning `docs/release/` would see two
audit files with contradictory statuses.

## Goal

Mark the 2026-05-15 audit as historical so it cannot be mistaken for a current
authority on R.11 completion state.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None. This is a bounded documentation update.

## TDD Requirements

None. This is a doc-only change; no new tests added.

## Implementation Requirements

- Add a historical-context blockquote above the `Status:` line in
  `docs/release/r11-completion-audit-2026-05-15.md`.
- Replace `Status: NOT ACHIEVED` with a `HISTORICAL` marker that names the
  superseding audit and the closeout commit.
- Verify `docs/release/rebrand-mapping-2026-05-13.md` R.11 row already records
  `c0cc869d`; no change needed there.
- Do not modify `docs/release/r11-completion-audit-2026-05-14.md`.
- Do not modify T298 ticket or worklog.
- Do not delete the 2026-05-15 audit file.

## Validation Commands

- `bun run validate:docs`
- `bun run validate:rebrand`
- `node scripts/validate-roadmap-coherence.cjs`
- `git diff --check`

## Acceptance Criteria

- [x] `docs/release/r11-completion-audit-2026-05-15.md` contains the
  historical-context blockquote above the `Status:` line.
- [x] The `Status:` line reads `HISTORICAL — superseded by 2026-05-14 audit
  after rewrite landed at c0cc869d`.
- [x] `docs/release/rebrand-mapping-2026-05-13.md` R.11 row records
  `c0cc869d` (pre-existing; no change required).
- [x] `docs/release/r11-completion-audit-2026-05-14.md` is unmodified.
- [x] `validate:docs`, `validate:rebrand`, `validate-roadmap-coherence`, and
  `git diff --check` pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T534-r11-audit-historical-marker.md`.
