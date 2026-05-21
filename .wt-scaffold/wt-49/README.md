# WT-49 Worktree

- **Branch:** `feat/activity-event-policy`
- **Spec:** `docs/superpowers/specs/2026-05-21-wt-49-*-design.md`
- **Yaml:** `wt-meta/wt-49.yaml`
- **Mission control:** `docs/mission-control/wt-49/`
- **Linear epic:** PZD-118
- **Feature flag:** `rox.feature.activity-event-v1` (OFF by default)

## Phase progression (22-role swarm)

1. **Discovery** — brainstormer, requirements-keeper, scope-analyzer, critic, cjm-writer
2. **Design** — erd-writer, sequence-chart-writer, ui-inventory-writer, prompt-writer, ux-guru, data-refresh-rule-keeper
3. **Impl** — test-writer (TDD-first), implementer, super-coder, reviewer
4. **Verify** — verifier, critic, integrator (3-machine evidence required)
5. **Optimize** — optimizer, 10x-improver, observability-engineer, risk-board-tracker, dependency-graph-tracker

## Hard rules (from wt-meta)

- Touch ONLY `files_allowed` from yaml
- NEVER touch `files_forbidden` (use scaffold_request к owner)
- Tests FIRST commit must exist (TDD discipline)
- 3-machine verify mandatory before merge

## Merge gate (`scripts/orchestrator/merge-gate.ts`)

- typecheck/lint/tests exit 0
- evidence/{mac-14-arm,windows-2022,ubuntu-22}/{build.log,smoke-result.json}
- mission-control artifacts populated (cjm/, erd/, sequence/, ui-inventory/, observability/)
- definition_of_done в yaml all true
