# T272 - Rebrand Electron README and ADR index

Status: DONE

## Context

Phase R.4 requires the Electron README to use canonical ROX.ONE product
language and the audit-harness ADR register to forward-reference the Phase R.0
rebrand ADR.

## Goal

Rewrite `apps/electron/README.md` stale product/path prose and update
`docs/decision-records/audit-harness/README.md` with the rebrand ADR reference.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; the touched docs are bounded markdown files.

## TDD Requirements

Extend the R.4 documentation regression test before editing these docs and
confirm it fails on the existing stale Electron README / ADR register content.

## Implementation Requirements

- Rewrite `apps/electron/README.md` written product references to `ROX.ONE`.
- Rewrite stale `RoxAgent` doc prose to current `ClaudeAgent` naming where it
  describes the renamed implementation.
- Rewrite stale workspace/document/vault prose to canonical ROX.ONE wording.
- Document the canonical ROX log path in the Electron debugging section.
- Add an ADR register forward-reference to
  `0011-rox-one-rebrand-canonical-tokens.md`.
- Do not rewrite ADR 0005 technical import-path references; only reword literal
  legacy product prose if present.

## Validation Commands

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Red test proves the Electron README / ADR index cleanup gap.
- [x] Electron README uses canonical ROX.ONE and current agent naming.
- [x] Electron README documents canonical ROX log path.
- [x] ADR index links ADR 0011.
- [x] ADR 0005 has no legacy product prose rewrites pending.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T272-rebrand-electron-readme-and-paths.md`.
