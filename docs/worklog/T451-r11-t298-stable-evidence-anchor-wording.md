# T451 - R.11 T298 stable evidence anchor wording

Status: DONE
Phase: R.11 report-only closeout hygiene
Ticket: docs/tickets/T451-r11-t298-stable-evidence-anchor-wording.md

## 1. Task summary

Refresh T298's evidence-pointer wording so it stays accurate as later
report-only audit tickets land.

## 2. Repo context discovered

T298 already points readers at the durable completion audit, but the local
anchor list still calls T439/T441/T442 "latest" even though T449/T450 have
landed after it.

## 3. Files inspected

- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/tickets/T449-r11-completion-audit-target-guard-refresh.md`
- `docs/tickets/T450-r11-t298-backup-target-guard-refresh.md`

## 4. Tests added first

Updated `scripts/__tests__/rebrand-r11-preflight.test.ts` so the T298
documentation regression now requires stable report-only evidence anchor
wording, rejects the exact stale "latest" label, and requires T449/T450 to be
named.

## 5. Expected failing test output

Before updating T298, the targeted test failed because the stable anchor phrase
was absent:

```text
Expected to contain: "Representative report-only evidence anchors include:"

(fail) R.11 closeout worklog documentation > points current evidence at durable report-only audit anchors
```

## 6. Implementation changes

- Reworded the T298 evidence section from "latest report-only evidence chain"
  to "Representative report-only evidence anchors".
- Added T449 and T450 anchor bullets so the target-guard audit and T298
  closeout refreshes are visible from the future destructive closeout surface.
- Added wording that the list is not a live chronology and later
  audit-hygiene tickets carry their own fresh validation evidence.
- Preserved T298 `Status: BLOCKED`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 33 pass,
  0 fail, 154 expect calls.
- `bun run validate:docs`: green; agent contract reports 416 tickets and
  7 required docs.
- `bun run validate:rebrand`: green; no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only documentation/test change.

## 10. Remaining risks

R.11 remains blocked by active goal state, fork count, tag mismatch/off-main
target, missing backup artifacts, missing offline mirror, and remote branch
review. This ticket does not authorize tag mutation, backup creation,
`git filter-repo`, force-push, or branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails on the stale "latest" evidence-chain wording | PASS | Targeted test failed on missing stable anchor phrase before the T298 edit |
| T298 worklog uses stable evidence-anchor wording | PASS | T298 now says `Representative report-only evidence anchors include:` |
| T298 worklog names T449 and T450 | PASS | T298 now has anchor bullets for T449 and T450 |
| T298 remains `Status: BLOCKED` | PASS | Targeted test checks the T298 header contains `Status: BLOCKED` and not `Status: DONE` |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup commands were run |
