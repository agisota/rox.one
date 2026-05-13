# T269 - Rebrand README and contributing docs

## 1. Task summary

Rewrite active root documentation in `README.md` and `CONTRIBUTING.md` so
product-facing setup, contribution, architecture, and CLI guidance uses
canonical ROX.ONE naming while preserving upstream attribution.

## 2. Repo context discovered

- Phase R.4 explicitly scopes `README.md` and `CONTRIBUTING.md` as rewritable.
- R.6 still owns environment-variable renames, so T269 does not change
  `CRAFT_*` examples.
- R.7 still owns Docker image and CI/build artifact renames, so T269 does not
  change Docker image names.
- Upstream attribution must remain available in README allowlisted
  acknowledgement/legal context.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `README.md`
- `CONTRIBUTING.md`
- `scripts/validate-rebrand.cjs`
- `scripts/__tests__/rebrand-asset-paths.test.ts`

## 4. Tests added first

Added `scripts/__tests__/rebrand-doc-cleanup.test.ts` before editing
`README.md` or `CONTRIBUTING.md`. The T269 test asserts:

- README build-from-source instructions use the ROX.ONE repository and
  `rox-one-terminal` checkout directory.
- README CLI examples use a canonical `rox-cli` alias.
- README architecture starts at `rox-one-terminal/`.
- README keeps upstream attribution in an `Acknowledgements` section.
- CONTRIBUTING setup and package examples use canonical ROX.ONE naming.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- Result: exit 1.
- Expected failure: README did not contain
  `git clone https://github.com/agisota/rox-one-terminal.git`; the received
  README still used the upstream checkout instructions.

## 6. Implementation changes

- Updated README build-from-source instructions to clone
  `https://github.com/agisota/rox-one-terminal.git` and enter
  `rox-one-terminal`.
- Rewrote README CLI alias and examples to use `rox-cli`.
- Rewrote README architecture root to `rox-one-terminal/`.
- Rewrote README Docker example image/volume names to ROX.ONE naming without
  changing the still-owned-later `CRAFT_*` environment variable examples.
- Rewrote README debug log paths and packaged binary examples to ROX.ONE
  naming.
- Added a README `Acknowledgements` section that preserves upstream
  attribution for `https://github.com/lukilabs/craft-agents-oss`.
- Updated CONTRIBUTING clone/setup instructions, project tree, and package
  examples to ROX.ONE naming.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `rg -n "craft-cli|craft-agent/|craft-agents-oss|@craft-agent" README.md CONTRIBUTING.md`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`: 1 pass, 0 fail,
  18 assertions.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- Targeted README/CONTRIBUTING legacy grep found only the preserved upstream
  attribution URL in README `Acknowledgements`.

## 9. Build output summary

Not run for this doc-only ticket.

## 10. Remaining risks

- Later phases still own package-scope, environment-variable, Docker, and build
  artifact renames, so whole-repo rebrand validation is expected to stay red
  until those phases land.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves README/CONTRIBUTING gap | Pass | Red exit 1 on old README checkout instructions |
| README setup and CLI examples use ROX.ONE naming | Pass | R.4 doc cleanup test passes |
| README preserves upstream attribution | Pass | Upstream URL remains in README `Acknowledgements` |
| CONTRIBUTING setup and package examples use ROX.ONE naming | Pass | R.4 doc cleanup test passes |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This worklog is included in the T269 task commit in git history |
