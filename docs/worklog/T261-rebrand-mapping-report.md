# T261 - Rebrand mapping report

## 1. Task summary

Create the Phase R.0 rebrand inventory report used as the baseline for later
rename phases.

## 2. Repo context discovered

- No `docs/release/rebrand-mapping-2026-05-13.md` exists yet.
- `README.md`, `package.json`, scripts, docs, and source still contain
  pre-sweep `rox` product tokens.
- The rebrand goal defines the forbidden-token list and the legal-preserve
  allowlist.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/release/`
- `README.md`
- `package.json`
- `LICENSE`
- `NOTICE`
- `TRADEMARK.md`

## 4. Tests added first

Ran the mapping-report file-existence assertion before creating the report:

- `test -f docs/release/rebrand-mapping-2026-05-13.md`

## 5. Expected failing test output

Red run:

- Command: `test -f docs/release/rebrand-mapping-2026-05-13.md`
- Result: exit 1.
- Expected failure: the mapping report did not exist yet.

## 6. Implementation changes

- Added `docs/release/rebrand-mapping-2026-05-13.md`.
- Recorded tracked-file inventory methodology based on `git ls-files` and
  `rg`.
- Recorded the forbidden-token list from the rebrand goal.
- Bucketed current findings into package/import scope, env vars, config paths,
  product text, code identifiers, assets/docs/binaries, community links, and
  legal preserve.
- Linked the report to ADR 0011 and reserved a Phase R.10 closeout update slot.

## 7. Validation commands run

- `test -f docs/release/rebrand-mapping-2026-05-13.md`
- `rg -n "## Bucket" docs/release/rebrand-mapping-2026-05-13.md`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- Mapping report file-existence assertion: exit 0.
- Bucket-heading assertion: exit 0.
- Docs validation: exit 0.
- Whitespace check: exit 0.

## 9. Build output summary

No build was run for T261 because the slice only adds release documentation,
ticket status, and this worklog.

## 10. Remaining risks

- The report is an inventory baseline, not the final cleanup. Later phases own
  the actual token removals.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Mapping report exists | Green | File-existence assertion exits 0 |
| Report includes forbidden-token list | Green | Report "Forbidden Token List" section |
| Report includes bucketed current inventory | Green | Report contains `## Bucket` sections |
| Report documents legal-preserve paths | Green | Report "Legal Preserve" bucket |
| Report links to ADR 0011 | Green | Report front matter links ADR 0011 |
| Docs validation passes | Green | `bun run validate:docs` exits 0 |
| Whitespace check passes | Green | `git diff --check` exits 0 |
| Worklog complete | Green | All 11 sections complete |
| Commit created | Green | T261 committed with Lore protocol |
