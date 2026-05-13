# T299 - End-to-end spine integration

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Two `/goal` files exist in the repo: a master roadmap (M.1-M.21) and a rebrand sweep (R.0-R.11). Codex needs a single canonical document that ties them together, owns the unified ticket schema, and adds the post-release Lane P (P.1-P.6). Without a spine, codex cannot answer "what's next from the global view?" without reading two competing detail files.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- multi-agent workflows
- validation gates
- TDD-first implementation
- v1.0.0 public release

## Goal

Land the unified spine roadmap and the coherence-validation infrastructure so codex can drive end-to-end execution from the post-C.4 state (`d9f58ec`/`61016f9`) to a tagged `v1.0.0` GitHub Release across 46 phases (M.1.x done, R.0 done, R.1-R.11 + M.2-M.21 + P.1-P.6 to go).

## Required UI

None.

## Required Data/API

No runtime data or API changes. Documentation and lint infrastructure only.

## Required Automations

- New `bun run validate:roadmap` lint gate that enforces coherence across the three roadmap files (spine + master-roadmap + rebrand-sweep).
- Mandatory phase pre-check block in the spine that resumed `/goal` runs use to skip already-DONE phases.
- Forward-pointer banners in master-roadmap and plan.md pointing at the spine.

## Required Subagents

None for the ticket-authoring phase. The validator script implementation may use a read-only explorer for confirming roadmap-file paths.

## TDD Requirements

The spine is a documentation artifact, not runtime code. TDD applies to the validator:

1. The validator script returns exit 2 when any of the four roadmap files is missing.
2. The validator returns exit 0 with a one-line summary when all four files are present and coherent.
3. The validator returns exit 1 with structured violations when:
   - A phase ID in the spine ledger has no `# Phase` heading in its owner file.
   - A ticket ID appears in both master-roadmap and rebrand-sweep detail files.
   - A phase ID in the Mermaid dependency graph is not in the spine ledger.
   - A `DONE`-marked phase has no commit SHA in its ledger row.

## Implementation Requirements

Author nine atomic Lore-style commits on branch `docs/v1-end-to-end-spine-2026-05-13`:

1. New: `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md` (~600 LOC).
2. New: `docs/release/v1-end-to-end-dependency-graph.md` (~170 LOC, single Mermaid block).
3. New: `scripts/validate-roadmap-coherence.cjs` (~210 LOC, pure Node fs/path).
4. Edit: `package.json` (add `validate:roadmap` script line).
5. Edit: master-roadmap goal file (SUPERSEDED banner pointing at spine).
6. Edit: `plan.md` (mark 2026-05-05 historical, redirect §4 and §17).
7. New: this ticket (`docs/tickets/T299-spine-integration.md`).
8. New: worklog (`docs/worklog/T299-spine-integration.md`).
9. (R.0 follow-up only): forward-pointer banner in `rebrand-sweep-goal.md` lands either inline or via a follow-up commit on `main` once the rebrand-sweep PR (#44) merges.

Do NOT touch upstream attribution (`LICENSE`, `NOTICE`, `TRADEMARK.md`, `Dockerfile.server` `image.source` label) — these are legal-preserve under Apache 2.0 §4.

Do NOT touch historical worklogs/tickets/release-notes — they are immutable.

## Validation Commands

- `node scripts/validate-roadmap-coherence.cjs` (or `bun run validate:roadmap`)
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- Verify branch state: `git rev-parse --abbrev-ref HEAD` reports `docs/v1-end-to-end-spine-2026-05-13`
- Verify all six new/edited files appear in the commit log: `git log --oneline HEAD~9..HEAD`

## Acceptance Criteria

- [x] Spine goal file authored and committed.
- [x] Dependency graph Mermaid file authored and committed.
- [x] Coherence validator script authored, committed, smoke-tested (exits 0 on green tree, 1 on violations, 2 on missing files).
- [x] `package.json` exposes `validate:roadmap` script.
- [x] Master-roadmap file carries SUPERSEDED banner pointing at the spine.
- [x] `plan.md` carries HISTORICAL banner with §-by-§ redirections.
- [x] This ticket and its worklog committed.
- [x] Branch `docs/v1-end-to-end-spine-2026-05-13` pushed to origin.
- [x] PR opened against `main` with reviewer-friendly body.
- [ ] PR merged (operator decision).

## Worklog

`docs/worklog/T299-spine-integration.md`
