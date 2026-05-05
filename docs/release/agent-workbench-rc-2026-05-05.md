# Agent Workbench Suite RC - 2026-05-05

## Release Notes

This release candidate closes the local Agent Workbench MVP and Experience Layer roadmap under the fake-provider validation contract.

Included surfaces:

- ROX.ONE white-label shell and Russian-first UI baseline.
- Prompt-to-spec workflow surfaces: Rewrite, TDD Plan, Review Gate, Spec Builder, pipeline planning, automation presets.
- Experience Layer surfaces: Deep Missions, Arena Builder, Mission Control, Progression Observatory, Quest Map, and Agent Forge.
- Account, teams, billing ledger, storage quota, cloud workspace, and explicit local-cloud sync MVP contracts.
- File manager scopes, PDF viewer, markdown entity graph, Office adapter contract, and browser research fake-provider gating.
- Team chat, mobile responsive shell, security hardening, observability, audit trail, and E2E core scenario suite.

## MVP User Guide

Use the app as a mission-control workbench:

1. Start from Composer and choose the relevant product action: improve prompt, create TDD plan, review, split work, or assemble a spec.
2. Use Spec Builder when a rough idea must become executable requirements, output contracts, and validation gates.
3. Use Review Gate before accepting generated artifacts. Blocking findings must be fixed before the deliverable is treated as verified.
4. Use Experience screens for long-running work: configure Deep Missions, inspect Mission Control checkpoints, monitor VDI and submetrics in Progression, unlock Quest Map work only through evidence, and manage team/private agents in Agent Forge.
5. Use Account and Team surfaces for user state, access, usage, storage, and workspace sync. MVP tests use deterministic fake providers.

## Admin Guide

Required release-candidate checks:

- `bun run validate:ci`
- `bun run e2e:core`
- `bun run validate:e2e-core-scenarios`
- `bun run validate:docs`
- `git diff --check`

Production release upload is intentionally separate from this RC gate. `bun run release` builds local artifacts and requires S3 version-bucket credentials before upload.

## Known Limitations

- Private GitHub push was blocked in this runtime by approval policy, even though the private origin and behind=0 state were verified in the supervisor plan.
- Real S3, payment, email, LLM, browser, marketplace, and production auth providers are outside the test contract and must be validated in deployment-specific tickets.
- Account, team, workspace, ledger, sync, and storage surfaces are covered as MVP/fake-provider contracts; durable multi-tenant persistence and external reconciliation remain production hardening work.
- Mac ARM developer build and Electron smoke are covered, but signed/notarized production distribution and real update-channel upload are separate release operations.
- Worktrees T003-T012 are clean and merged; physical archive/removal is a separate organize pass.

## Evidence Snapshot

- `bun run validate:ci`: passed.
- `bun run e2e:core`: passed and reached Electron `App initialized successfully`.
- `bun run validate:e2e-core-scenarios`: passed.
- Remaining ticket before this RC close: `T040-final-release-candidate`.
