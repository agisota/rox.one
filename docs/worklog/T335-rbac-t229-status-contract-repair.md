# T335 - RBAC T229 status contract repair

## 1. Task summary

Repair the merged T229 ticket metadata so repository docs validation
passes again. The T229 E2E test, worklog, and PR merge are already on
main; the missing field is only `Status: DONE` in
`docs/tickets/T229-rbac-integration-tests.md`.

## 2. Repo context discovered

- `bun run validate:docs` runs `scripts/validate-agent-contract.ts`.
- That validator requires every ticket to include a `Status:` line.
- PR #77 merged T229's E2E test and worklog, but the ticket body lacked
  `Status: DONE`.
- T229's worklog already records the passing RBAC lifecycle validation
  and commit evidence; no runtime code or test code needs repair.

## 3. Files inspected

- `docs/tickets/T229-rbac-integration-tests.md`
- `docs/worklog/T229-rbac-integration-tests.md`
- `scripts/validate-agent-contract.ts`
- `docs/tickets/T228-rbac-admin-ui.md`
- `docs/worklog/T228-rbac-admin-ui.md`

## 4. Tests added first

No new test file. The existing docs validator was run before the repair
and failed on the missing T229 status line.

## 5. Expected failing test output

```text
$ bun run validate:docs
[agent-contract] T229-rbac-integration-tests.md missing Status line
error: script "validate:agent-contract" exited with code 1
```

## 6. Implementation changes

- Added `Status: DONE` below the title in
  `docs/tickets/T229-rbac-integration-tests.md`.
- Added this T335 ticket and worklog to record the metadata repair as a
  separate logical change.

## 7. Validation commands run

- `bun run validate:docs`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

```text
$ bun run validate:docs
[agent-contract] ok: 11 skills, 246 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /tmp/rox-t228/docs/architecture/sync-v2-design.md

$ bun run validate:roadmap
validate:roadmap OK - 46 phases, 111 tickets across detail files

$ git diff --check
clean
```

## 9. Build output summary

No build required. This is documentation metadata only.

## 10. Remaining risks

None known. The repair only adds the required status field; it does not
change T229's RBAC E2E test or runtime behavior.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| T229 ticket has `Status: DONE` | Green | `docs/tickets/T229-rbac-integration-tests.md` |
| Worklog uses 11 sections | Green | This file |
| `validate:docs` exits 0 | Green | Section 8 |
| `validate:roadmap` exits 0 | Green | Section 8 |
| Commit created | Green | Atomic commit after validation |
