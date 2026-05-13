# T270 - Rebrand security and code-of-conduct docs

Status: DONE

## Context

Phase R.4 requires active project policy docs to use canonical ROX.ONE contact
and package naming.

## Goal

Rewrite `CODE_OF_CONDUCT.md` and `SECURITY.md` so reporting contacts and scoped
package references use canonical ROX.ONE values.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; the policy-doc surface is two small markdown files.

## TDD Requirements

Extend the R.4 documentation regression test before editing the policy docs and
confirm it fails on the existing legacy contact/scope content.

## Implementation Requirements

- Update `CODE_OF_CONDUCT.md` enforcement contact to `conduct@rox.one`.
- Keep `SECURITY.md` vulnerability-report contact at `security@rox.one`.
- Update SECURITY scope package references to `@rox-one/*`.
- Do not alter historical ADR/ticket/worklog artifacts.

## Validation Commands

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Red test proves the policy-doc cleanup gap.
- [x] Code of Conduct uses `conduct@rox.one`.
- [x] Security policy uses `security@rox.one` and `@rox-one/*`.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T270-rebrand-security-and-coc.md`.
