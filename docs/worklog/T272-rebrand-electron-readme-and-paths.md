# T272 - Rebrand Electron README and ADR index

## 1. Task summary

Rewrite `apps/electron/README.md` stale product/path prose and update the
audit-harness ADR register to point at the Phase R.0 rebrand ADR.

## 2. Repo context discovered

- Phase R.4 explicitly scopes `apps/electron/README.md` and
  `docs/decision-records/audit-harness/README.md` as rewritable.
- `apps/electron/README.md` still uses the spoken-form brand and stale
  `RoxAgent` prose.
- ADR 0011 already exists as
  `docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`.
- ADR 0005 contains a legacy technical import path but no literal legacy
  product prose requiring a rewrite under R.4.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `apps/electron/README.md`
- `docs/decision-records/audit-harness/README.md`
- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
- `docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`
- `scripts/__tests__/rebrand-doc-cleanup.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-doc-cleanup.test.ts` before editing
`apps/electron/README.md` or the ADR register. The R.4 documentation
regression test asserts:

- Electron README uses `ROX.ONE`, not the spoken wordmark.
- Stale `RoxAgent`, workspace, document, and vault prose is gone.
- Electron README documents `~/.rox/logs/electron/main.log`.
- ADR index links ADR 0011.
- ADR 0005 has no literal legacy product prose.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- Result: exit 1.
- Expected failure: T269, T270, and T271 tests passed; the new T272 test
  failed because `apps/electron/README.md` did not contain
  `# ROX.ONE Electron App` and still used the spoken-form heading.

## 6. Implementation changes

- Updated `apps/electron/README.md` heading and opening prose to canonical
  `ROX.ONE`.
- Rewrote stale `RoxAgent` doc references to `ClaudeAgent`, matching the
  renamed implementation while leaving runtime backward-compat aliases to later
  code phases.
- Rewrote stale workspace/document/vault prose to ROX.ONE naming.
- Added the canonical Electron log path
  `~/.rox/logs/electron/main.log` to the debugging section.
- Updated the audit-harness ADR register so ADR 0005 is linked as accepted and
  ADR 0007 / ADR 0011 are forward-referenced as accepted decisions.
- Reviewed ADR 0005 and left its technical `@rox-agent/...` import path
  untouched because it is not literal legacy product prose and package-scope
  migration is owned by R.5.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `rg -n "Rox|ROX ONE|rox-agent|~/.rox|Dev_Rox" apps/electron/README.md docs/decision-records/audit-harness/README.md docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
- `rg -n "Rox Agents|Rox Agent|ROX ONE|RoxAgent|Rox workspaces|Rox documents|Dev_Rox_Agents" apps/electron/README.md docs/decision-records/audit-harness/README.md docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`: 4 pass, 0 fail,
  47 assertions.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- Broad Electron/ADR grep finds only ADR 0005's intentionally preserved
  technical import path.
- Targeted literal legacy product-prose grep: exit 1 with no matches.

## 9. Build output summary

Not run for this doc-only ticket.

## 10. Remaining risks

- ADR 0005 intentionally keeps the historical technical import path until the
  package-scope migration phase owns that runtime rename.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves Electron README / ADR index gap | Pass | Red exit 1 on old Electron README heading before implementation |
| Electron README uses canonical product and agent naming | Pass | R.4 doc cleanup test passes |
| Electron README documents canonical log path | Pass | R.4 doc cleanup test passes |
| ADR index links ADR 0011 | Pass | R.4 doc cleanup test passes |
| ADR 0005 product prose reviewed | Pass | Targeted literal product-prose grep has no matches |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This worklog is included in the T272 task commit in git history |
