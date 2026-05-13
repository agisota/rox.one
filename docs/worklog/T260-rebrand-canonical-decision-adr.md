# T260 - Rebrand canonical decision ADR

## 1. Task summary

Record the user-locked ROX.ONE rebrand decisions in ADR 0011 before any rename
implementation begins.

## 2. Repo context discovered

- `T223-c4-followups-closeout` is `Status: DONE` and merged to `main`.
- The active rebrand goal is slotted as Phase 1.7 after the C4 Phase 1
  closeout and before RBAC Phase 2.
- The rebrand goal locks the written brand token as `ROX.ONE`, package scope as
  `@rox-one/*`, and env-var policy as `ROX_*` with a one-minor `CRAFT_*`
  compatibility fallback.
- `LICENSE`, `NOTICE`, `TRADEMARK.md`, Docker source attribution labels, and
  selected historical docs form the legal-preserve boundary.

## 3. Files inspected

- `AGENTS.md`
- `plan.md`
- `LICENSE`
- `NOTICE`
- `TRADEMARK.md`
- `README.md`
- `packages/shared/src/branding.ts`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `.swarm/master-roadmap-log.md`

## 4. Tests added first

Ran the ADR file-existence assertion before creating ADR 0011:

- `test -f docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`

## 5. Expected failing test output

Red run:

- Command:
  `test -f docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`
- Result: exit 1.
- Expected failure: ADR 0011 did not exist yet.

## 6. Implementation changes

- Added
  `docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`.
- Recorded the canonical written wordmark `ROX.ONE`, spoken-only `ROX ONE`,
  suite descriptor `Agent Workbench Suite`, package scope `@rox-one/*`, and
  env-var prefix `ROX_*`.
- Recorded the one-minor `CRAFT_*` compatibility policy for the future R.6
  `readEnv()` shim.
- Recorded the legal-preserve boundary for Apache 2.0 attribution and
  historical evidence.
- Linked ADR 0011 to the R.0 mapping report path.

## 7. Validation commands run

- `test -f docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- ADR file-existence assertion: exit 0.
- Docs validation: exit 0.
- Whitespace check: exit 0.

## 9. Build output summary

No build was run for T260 because the slice only adds ADR/ticket/worklog
documentation.

## 10. Remaining risks

- Later phases still have to implement the actual rename sweep and the
  compatibility shims recorded by this ADR.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| ADR 0011 exists | Green | File-existence assertion exits 0 |
| ADR 0011 records `ROX.ONE` written wordmark | Green | ADR Decision section |
| ADR 0011 records `@rox-one/*` package scope | Green | ADR Decision section |
| ADR 0011 records `ROX_*` env-var policy and fallback | Green | ADR Decision section |
| ADR 0011 records legal-preserve allowlist | Green | ADR Legal Preserve Boundary section |
| ADR 0011 links to mapping report | Green | ADR front matter includes mapping report path |
| Docs validation passes | Green | `bun run validate:docs` exits 0 |
| Whitespace check passes | Green | `git diff --check` exits 0 |
| Worklog complete | Green | All 11 sections complete |
| Commit created | Green | T260 committed with Lore protocol |
