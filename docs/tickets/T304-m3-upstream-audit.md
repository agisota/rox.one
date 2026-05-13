# T304 - M.3 prep — upstream v0.9.3 merge readiness audit

Status: DONE

**Ticket-number choice rationale:** the operator asked for the first FREE
T-number in the range T299-T320 (spine integration range), reserving
T303+ for additional spine work. On-disk landscape 2026-05-14: T299–T303
are all already allocated as ticket files; T304 is the first FREE slot.
The spine's provisional reservation of T304 for Lane P.5 (community
onboarding pack) is post-v1.0 work with no on-disk ticket yet, so this
pre-v1.0 merge-prep audit pre-empts that slot. P.5 will pick a free slot
from `T306-T320` when authored.

## Context

We are landing Phase M.3 — the upstream merge of `v0.9.3` from
`craft-ai-agents/craft-agents-oss`. M.3 is the second-largest spine
block (~4 days) because every `CRAFT_*` / `@craft-agent/*` /
`CraftAgent*` token upstream re-introduces must be re-rebranded against
ADR 0011. The merge cannot start until the surface is mapped and a
runbook with failure-recovery exists. This ticket delivers both.

## Goal

Two decision-grade documents that let codex (or human operator) execute
Phase M.3 mechanically: (1) a pre-merge surface audit categorising
conflicts by lane with re-apply patterns; (2) a step-by-step runbook
with pre-conditions, backup, validation matrix, and failure recovery.

## Required UI / Data / API / Automations / Subagents

None. Docs-only ticket. The runbook references existing automations
(`validate:rebrand`, `validate:roadmap`, `validate:agent-contract`,
`validate:audit`, trust-boundary validators, `lint:i18n:parity`).

## TDD Requirements

Documentation; no runtime tests. The three validators
(`validate:rebrand`, `validate:agent-contract`, `validate:roadmap`)
are the implicit tests asserting the docs don't break the lint graph.

## Implementation Requirements

Four files on branch `feat/M3-prep-upstream-audit`:

1. `docs/release/m3-upstream-merge-audit.md` (≤300 LOC).
2. `docs/release/m3-merge-runbook.md` (≤200 LOC).
3. `docs/tickets/T304-m3-upstream-audit.md` (this file; ≤80 LOC).
4. `docs/worklog/T304-m3-upstream-audit.md` (≤80 LOC).

Two commits: (1) audit + runbook, pushed; (2) ticket + worklog, pushed.
Do NOT modify `.swarm/master-roadmap-log.md`. Do NOT touch source/tests.

## Validation Commands

```bash
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

## Acceptance Criteria

- [x] Audit ≤300 LOC, runbook ≤200 LOC, ticket/worklog ≤80 LOC each.
- [x] Ticket-number rationale documented in header.
- [x] All three validators exit 0.
- [x] Two commits authored, branch pushed, PR opened.
- [x] No source/test files modified; no `.swarm/master-roadmap-log.md` edit.

## Worklog

`docs/worklog/T304-m3-upstream-audit.md`
