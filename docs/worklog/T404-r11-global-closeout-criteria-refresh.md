# T404 - R.11 global closeout criteria refresh

Status: DONE
Phase: R.11 completion audit
Ticket: docs/tickets/T404-r11-global-closeout-criteria-refresh.md

## 1. Task summary

Make two global rebrand stopping conditions explicit in the R.11 closeout
surfaces: the mapping report's R.11 closeout SHA and the final
`git log -p --all` zero-history gate. This is a documentation-only blocker
refresh; the destructive rewrite remains blocked.

## 2. Repo context discovered

The active goal is still:

```text
follow the instructions in
  docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

The goal's global stopping condition requires
`docs/release/rebrand-mapping-2026-05-13.md` to be updated with closeout commit
SHAs and requires `git log -p --all` to show zero forbidden-token matches
outside the legal-preserve allowlist. Before this ticket, T298 listed the
history scan as a validation command but did not list either requirement in its
acceptance criteria.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `scripts/rebrand-r11-preflight.ts`

## 4. Tests added first

No code test was added. This is a documentation/evidence refresh. The RED check
was a grep-style documentation assertion against T298.

## 5. Expected failing test output

RED check before editing:

```text
RED: T298 lacks mapping-report and zero-history acceptance coverage
```

Command:

```bash
if rg -n "mapping report.*R\\.11|R\\.11.*mapping report|history.*zero|git log -p --all.*zero" docs/tickets/T298-rebrand-git-history-rewrite.md docs/worklog/T298-rebrand-git-history-rewrite.md; then exit 1; else echo "RED: T298 lacks mapping-report and zero-history acceptance coverage"; fi
```

## 6. Implementation changes

- Added T298 acceptance items for:
  - mapping report R.11 closeout commit SHA,
  - final `git log -p --all` zero-history scan.
- Added blocked acceptance-matrix rows to the T298 worklog for both global
  stopping conditions.
- Added an explicit R.11 pending row to
  `docs/release/rebrand-mapping-2026-05-13.md`.
- Wrote the mapping row as `BLOCKED - pending destructive rewrite closeout SHA`
  so it cannot be mistaken for completed R.11 evidence.
- Kept T298 `Status: BLOCKED`.
- Did not mutate refs, create backup artifacts, create mirrors, delete
  branches, run `git filter-repo`, force-push, or call `update_goal`.

## 7. Validation commands run

- `brv query "rox-one-terminal rebrand R11 goal blockers"`
- `if rg -n "mapping report.*R\\.11|R\\.11.*mapping report|history.*zero|git log -p --all.*zero" docs/tickets/T298-rebrand-git-history-rewrite.md docs/worklog/T298-rebrand-git-history-rewrite.md; then exit 1; else echo "RED: T298 lacks mapping-report and zero-history acceptance coverage"; fi`
- `rg -n "R\\.11 closeout commit SHA|git log -p --all|BLOCKED - pending destructive rewrite closeout SHA|Mapping report records R\\.11 closeout SHA" docs/tickets/T298-rebrand-git-history-rewrite.md docs/worklog/T298-rebrand-git-history-rewrite.md docs/release/rebrand-mapping-2026-05-13.md`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

ByteRover remains unavailable:

```text
/bin/bash: line 1: brv: command not found
```

Documentation evidence check after editing finds the refreshed markers:

```text
R.11 closeout commit SHA
git log -p --all
BLOCKED - pending destructive rewrite closeout SHA
Mapping report records R.11 closeout SHA
```

Documentation validation:

```text
[agent-contract] ok: 11 skills, 369 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
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

No build was run. This is a documentation-only blocker-evidence refresh and
does not change product runtime behavior.

## 10. Remaining risks

R.11 remains blocked. This ticket makes global stop criteria harder to miss,
but it does not clear them. The mapping report still needs the real R.11
closeout commit SHA after rewrite, and the history scan cannot pass until the
authorized destructive rewrite succeeds.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED documentation check proves T298 lacked mapping-report and zero-history acceptance coverage | Green | Section 5 records the RED grep output |
| T298 ticket includes mapping-report and history-scan acceptance items | Green | Section 6 records both new T298 acceptance criteria |
| T298 worklog marks both requirements blocked | Green | Section 6 records both blocked matrix rows |
| Mapping report has an explicit R.11 pending slot that is not presented as a closeout SHA | Green | Mapping row says `BLOCKED - pending destructive rewrite closeout SHA` |
| T298 remains `Status: BLOCKED` | Green | T298 ticket and worklog status remain blocked |
| Destructive R.11 actions are not executed | Green | No ref mutation, backup, mirror, branch deletion, filter-repo, force-push, or update_goal action was run |
| Relevant validation passes | Green | Section 8 records docs, rebrand, and whitespace validation |
| Commit created | Green | Lore commit created for this criteria refresh |
