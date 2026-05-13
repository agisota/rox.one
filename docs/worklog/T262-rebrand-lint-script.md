# T262 - Rebrand lint script

## 1. Task summary

Add the automated rebrand validation gate and prove it fails on the current
pre-sweep forbidden-token inventory.

## 2. Repo context discovered

- Root `package.json` has no `validate:rebrand` script yet.
- The repo still contains legacy product tokens such as `craft-agent`,
  `@craft-agent`, `CRAFT_*`, and several `Craft*` identifiers.
- Legal preserve paths must remain allowlisted so Apache 2.0 attribution and
  historical records are not rewritten accidentally.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `package.json`
- `scripts/`
- `scripts/__tests__/`
- `LICENSE`
- `NOTICE`
- `TRADEMARK.md`
- `Dockerfile.server`
- `README.md`

## 4. Tests added first

Ran `bun run validate:rebrand` before adding the package script.

## 5. Expected failing test output

Red run:

- Command: `bun run validate:rebrand`
- Result: exit 1.
- Expected failure: `error: Script not found "validate:rebrand"`.

## 6. Implementation changes

- Added `scripts/validate-rebrand.cjs`.
- Wired root `package.json` script
  `"validate:rebrand": "bun run scripts/validate-rebrand.cjs"`.
- The validator scans tracked files via `git ls-files`, not generated output or
  untracked runtime state.
- It detects the forbidden-token list from the rebrand goal, applies the
  legal-preserve path allowlist, and uses line-level exceptions for
  `Dockerfile.server` source attribution, README License/Acknowledgements, and
  the future env-compat shim definition.
- It prints total finding counts by token plus the first actionable path/line
  findings, then exits non-zero while findings remain.
- The script avoids embedding exact full forbidden tokens in its own source by
  composing token constants from smaller fragments.

## 7. Validation commands run

- `bun run validate:rebrand` before implementation
- `bun run validate:rebrand` after implementation
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- Pre-implementation `bun run validate:rebrand`: exit 1 with missing package
  script error.
- Post-implementation `bun run validate:rebrand`: exit 1 as expected for R.0,
  reporting 4211 current forbidden-token findings outside the allowlist.
- Workspace typecheck: exit 0.
- Lint: exit 0.
- Docs validation: exit 0.
- Whitespace check: exit 0.

## 9. Build output summary

No build was run for T262 because the slice only adds a validation script,
package script entry, ticket, and worklog. Runtime source behavior is
unchanged.

## 10. Remaining risks

- The gate is expected to fail until later rebrand phases remove current
  findings outside the allowlist.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `scripts/validate-rebrand.cjs` exists | Green | File added |
| `package.json` exposes `validate:rebrand` | Green | Root script added |
| Script reports forbidden tokens outside legal-preserve paths | Green | Post-implementation run prints finding summary and path/line samples |
| Script exits non-zero on current pre-sweep inventory | Green | Post-implementation run exits 1 as required by R.0 |
| Legal-preserve files are allowlisted | Green | Script path and line allowlist covers ADR 0011 boundary |
| Docs validation passes | Green | `bun run validate:docs` exits 0 |
| Whitespace check passes | Green | `git diff --check` exits 0 |
| Worklog complete | Green | All 11 sections complete |
| Commit created | Green | T262 committed with Lore protocol |
