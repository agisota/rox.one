# T418 - R.11 completion audit history count

Status: DONE
Phase: R.11 completion audit hygiene
Ticket: docs/tickets/T418-r11-completion-audit-history-count.md

## 1. Task summary

Preserve the current history-scan finding count in the durable R.11 completion
audit.

## 2. Repo context discovered

The active rebrand-sweep goal remains blocked. Fresh report-only history-scan
evidence reports:

```text
red - git log -p --all history scan found 9 forbidden-token patch line(s) outside the legal-preserve allowlist
... output truncated after 8 finding(s)
```

The completion audit records that the history scan is red, but does not
currently record the `9` finding count.

## 3. Files inspected

- `docs/release/r11-completion-audit-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `docs/tickets/T405-r11-history-scan-runner.md`
- `docs/worklog/T405-r11-history-scan-runner.md`

## 4. Tests added first

Added `records the current history-scan finding count` to
`scripts/__tests__/rebrand-r11-completion-audit.test.ts`. The test requires the
audit's current blocker section to contain both `history-scan` and
`9 forbidden-token patch lines`.

## 5. Expected failing test output

The first RED run failed for the expected reason: the audit had the
`history-scan` blocker label but not the concrete finding count.

```text
Expected to contain: "9 forbidden-token patch lines"
Received: "... (`history-scan`) exits red with bounded historical findings."

(fail) R.11 completion audit > records the current history-scan finding count

 6 pass
 1 fail
```

## 6. Implementation changes

- Updated `docs/release/r11-completion-audit-2026-05-14.md` so the current
  history-scan blocker records `9 forbidden-token patch lines` outside the
  legal-preserve allowlist.
- Kept the audit status `NOT ACHIEVED`.
- Did not create backup refs, backup branches, offline mirrors, rewritten
  history, force-pushes, or tag mutations.

## 7. Validation commands run

- `REBRAND_R11_HISTORY_MAX_FINDINGS=8 bun run rebrand:r11-history-scan`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (GREEN)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Completion audit regression:

```text
scripts/__tests__/rebrand-r11-completion-audit.test.ts:
(pass) R.11 completion audit > maps every global stopping condition to concrete evidence
(pass) R.11 completion audit > does not freeze current-blocker evidence to a stale commit SHA
(pass) R.11 completion audit > records current-main validation without claiming post-rewrite completion
(pass) R.11 completion audit > records exact current report-only blocker IDs
(pass) R.11 completion audit > records the current remote branch review blocker count
(pass) R.11 completion audit > records the current rebrand-v1 tag targets
(pass) R.11 completion audit > records the current history-scan finding count

 7 pass
 0 fail
 44 expect() calls
```

Documentation and rebrand validation:

```text
[agent-contract] ok: 11 skills, 383 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
rebrand validation passed: no forbidden tokens outside the allowlist
git diff --check exited 0
```

## 9. Build output summary

No build expected. This ticket changes only documentation and a documentation
regression test.

## 10. Remaining risks

R.11 remains blocked by active goal state, tag drift, off-main tag target,
missing backup artifacts, unreviewed remote branch set, missing legal-preserve
backup tag, and historical forbidden-token patch lines.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED completion-audit test proves the history count is missing | Green | First targeted test failed on missing history count |
| Completion audit records the current history-scan finding count | Green | Completion-audit regression passes |
| Completion audit still says `NOT ACHIEVED` | Green | Existing completion-audit assertions pass |
| Targeted and documentation validation commands pass | Green | Section 8 records targeted test, docs validation, rebrand validation, and whitespace check |
