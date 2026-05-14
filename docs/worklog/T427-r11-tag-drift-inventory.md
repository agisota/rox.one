# T427 - R.11 tag drift inventory

Status: DONE
Phase: R.11 completion audit hygiene
Ticket: docs/tickets/T427-r11-tag-drift-inventory.md

## 1. Task summary

Create a read-only tag drift inventory for the R.11 `rebrand-v1` blockers.

## 2. Repo context discovered

R.11 remains blocked by hard prerequisites. The default preflight reports
`rebrand-tag-local-sync` and `rebrand-tag-on-main` failures. Fresh read-only tag
evidence shows:

- Local `rebrand-v1` is an annotated tag object
  `8e30f545169e52daa2763659d6c562a699a2575b` peeling to
  `906896e145156d92cf98457c4dc1893c53323bac`.
- Origin `rebrand-v1` is tag object
  `e32deed37b33fe3296edde6228adb1f76255027d` peeling to
  `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`.
- `git merge-base --is-ancestor b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99
  origin/main` exits 1.
- `origin/chore/rebrand-R10-final-sweep-and-gate` currently contains the origin
  peeled tag commit.

## 3. Files inspected

- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/release/r11-tag-drift-inventory-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `scripts/rebrand-r11-preflight.ts`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`

## 4. Tests added first

Update the existing completion-audit assertion so it requires a durable tag
drift report path plus local/origin object, peeled commit, and ancestry
evidence.

## 5. Expected failing test output

The RED run failed for the expected reason: the tag drift inventory file did
not exist.

```text
error: ENOENT: no such file or directory, open
'/home/dev/craft/rox-one-terminal/docs/release/r11-tag-drift-inventory-2026-05-14.md'

(fail) R.11 completion audit > records the current rebrand-v1 tag targets

 10 pass
 1 fail
```

## 6. Implementation changes

- Added `docs/release/r11-tag-drift-inventory-2026-05-14.md`.
- Recorded the local and origin tag objects plus peeled commits.
- Recorded the origin peeled commit ancestry failure and containing remote
  branch.
- Added a pointer from the R.11 completion audit to the tag drift report.
- Did not mutate, sync, delete, repoint, or force-push any tag.

## 7. Validation commands run

- `git rev-parse --verify rebrand-v1^{commit}`
- `git for-each-ref refs/tags/rebrand-v1`
- `git ls-remote --tags origin 'refs/tags/rebrand-v1' 'refs/tags/rebrand-v1^{}'`
- `git merge-base --is-ancestor b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99 origin/main`
- `git branch -r --contains b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (GREEN)
- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`: 11 pass,
  0 fail, 101 expect calls.
- `bun run rebrand:r11-preflight`: expected red while this ticket is in flight;
  the tag blockers remain visible, and `worktree-clean` is also red until the
  ticket is committed.
- `bun run validate:docs`: agent-contract, architecture-docs, and sync-v2
  design validation passed.
- `bun run validate:rebrand`: rebrand validation passed with no forbidden
  tokens outside the allowlist.
- `git diff --check`: no whitespace errors.

## 9. Build output summary

No build expected for this documentation/test hardening ticket.

## 10. Remaining risks

R.11 remains blocked by active goal state, tag drift, off-main tag target,
missing backup artifacts, unreviewed remote branch set, missing legal-preserve
backup tag, and historical forbidden-token patch lines.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED completion-audit assertion proves the tag drift inventory is absent | Green | RED run failed on missing `docs/release/r11-tag-drift-inventory-2026-05-14.md` |
| Tag drift report records local and origin tag objects plus peeled commits | Green | `docs/release/r11-tag-drift-inventory-2026-05-14.md` summary |
| Tag drift report records origin ancestry failure and containing remote branch evidence | Green | Report records `merge-base --is-ancestor` exit 1 and `origin/chore/rebrand-R10-final-sweep-and-gate` |
| Targeted, preflight, and documentation validation commands produce the expected results | Green | 11 pass targeted test; expected red preflight; docs/rebrand validators green; `git diff --check` green |
