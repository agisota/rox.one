# T301 - Ticket status contract repair

## 1. Task summary

Restore the docs ticket contract after `main` picked up two completed tickets
without required `Status:` lines.

## 2. Repo context discovered

- `scripts/validate-agent-contract.ts` requires every `docs/tickets/T###-*.md`
  file to contain a `Status:` line.
- `bun run validate:docs` failed before this fix on
  `T078-rox-composer-quick-action-wrappers.md missing Status line`.
- A direct scan found `T078` and `T202` missing status lines; `TEMPLATE.md` is
  not in the validator's `T###` file pattern.

## 3. Files inspected

- `scripts/validate-agent-contract.ts`
- `docs/tickets/T078-rox-composer-quick-action-wrappers.md`
- `docs/worklog/T078-rox-composer-quick-action-wrappers.md`
- `docs/tickets/T202-zed-md-default-provider.md`
- `docs/worklog/T202-zed-md-default-provider.md`

## 4. Tests added first

No new test file was needed. The existing docs contract validator is the
regression check for this metadata rule.

## 5. Expected failing test output

Initial validation before editing:

- `bun run validate:docs`: exit 1.
- Failure: `[agent-contract] T078-rox-composer-quick-action-wrappers.md missing Status line`.

## 6. Implementation changes

- Added `Status: DONE` to
  `docs/tickets/T078-rox-composer-quick-action-wrappers.md`.
- Added `Status: DONE` to
  `docs/tickets/T202-zed-md-default-provider.md`.

## 7. Validation commands run

- `bun run validate:docs` before editing: expected red.
- `bun run validate:docs`
- `git diff --check`
- `for f in docs/tickets/T*.md; do if ! rg -q '^Status:' "$f" && [[ "$f" =~ docs/tickets/T[0-9]{3}-.+\.md$ ]]; then printf '%s\n' "$f"; fi; done`

## 8. Passing test output summary

- `bun run validate:docs`: exit 0; agent-contract, architecture docs, and
  sync-v2 design checks passed.
- `git diff --check`: exit 0.
- Direct missing-status scan for `T###` tickets: exit 0 with no output.

## 9. Build output summary

Not applicable; this is metadata-only documentation repair.

## 10. Remaining risks

- This repair does not validate the implementation claims inside T078 or T202;
  it only restores the docs contract metadata that was blocking validation.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before metadata edits | Pass | T301 ticket and worklog created first |
| Failing validation identified missing Status contract | Pass | `bun run validate:docs` failed on missing T078 Status line |
| T078 has `Status: DONE` | Pass | Status line added |
| T202 has `Status: DONE` | Pass | Status line added |
| `bun run validate:docs` passes | Pass | exit 0 after metadata repair |
| `git diff --check` passes | Pass | exit 0 |
| Worklog complete | Pass | Validation evidence recorded |
| Commit created | Pass | T301 metadata repair committed on `chore/rebrand-R5-package-closeout` |
