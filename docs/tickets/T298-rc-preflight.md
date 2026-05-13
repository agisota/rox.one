# T298-rc-preflight - RC validation pre-flight checklist + 72h soak protocol (M.20)

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

M.20 is the RC-validation phase — the gate between feature-complete and the
`v1.0.0` tag. The spine roadmap (`docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`)
says M.20 = "RC validation, tag `v1.0.0-rc.1`, 72h soak", and master-roadmap
Phase 20 (`docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`)
demands a canonical pre-flight checklist plus a soak protocol.

Numbering note: the bare `T298` slot is reserved in the rebrand-sweep goal
doc for `T298-rebrand-git-history-rewrite` (R.11 closeout, not yet created)
and `T298a-rebrand-allowlist-expansion.md` already exists for R.9.5. To
avoid a filename collision with the future R.11 closeout, this ticket uses
the suffix `T298-rc-preflight` per the task brief's collision-fallback rule.

## Goal

Produce two new canonical release-engineering docs and the matching ticket
plus worklog. No source or test files change.

## Required UI

None — doc-only change set.

## Required Data/API

None.

## Required Automations

None new. The pre-flight checklist references existing `package.json`
`validate:*` scripts verbatim and binds them to ownership tags.

## Required Subagents

None — single doc-author pass.

## TDD Requirements

Not applicable — doc-only. The pre-flight checklist itself encodes the
validator gates the release tag must satisfy; no new test code is added.

## Implementation Requirements

Two new files under `docs/release/`:

1. `docs/release/v1-rc-preflight-checklist.md` (≤200 LOC) — six sections
   covering validator gates, automated test suites, build + supply-chain,
   manual surface walks, ticket-status hygiene, tag-time evidence.
2. `docs/release/v1-rc-72h-soak-protocol.md` (≤150 LOC) — observation cadence,
   signals to watch, soak-failure conditions, rollback procedure, pass
   criteria, linkage.

Plus this ticket and a matching worklog under `docs/worklog/T298-rc-preflight.md`.

## Validation Commands

`bun run validate:rebrand` (exits 0 on the branch SHA), `bun run validate:agent-contract`, `bun run validate:roadmap`. The latter two carry pre-existing failures on `origin/main` (T223 missing Status line, M.1.3b phase heading missing); this ticket introduces no new violations.

## Acceptance criteria

- `docs/release/v1-rc-preflight-checklist.md` exists, ≤200 LOC, every
  `validate:*` quoted verbatim from `package.json`.
- `docs/release/v1-rc-72h-soak-protocol.md` exists, ≤150 LOC, with explicit
  soak-failure conditions and a rollback procedure.
- This ticket file exists with `Status: DONE`.
- `docs/worklog/T298-rc-preflight.md` exists and matches the ticket id.
- PR opened against `main`.
