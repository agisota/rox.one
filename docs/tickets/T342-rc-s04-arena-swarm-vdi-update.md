# T342 - RC Scenario S04: Arena Swarm → Dedupe Signals → Review Board → VDI Update

Status: Todo

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 4** from `plan.md §16`:

> Arena swarm → dedupe signals → review board → VDI update.

The scenario exercises the Agent Arena (T044/T078), the Swarm Signal Processor
(T050), the Review Board (T013), and the global VDI (Validation Depth Index)
metric (T077). A swarm of arena agents produces signals, duplicates are collapsed
by the signal processor, the consolidated output surfaces in the Review Board, and
finally the VDI score updates in the global HUD (T080).

## Goal

Verify that a multi-agent arena swarm produces signals that are correctly deduped
by the Swarm Signal Processor, that the deduped signals appear in the Review
Board, and that the VDI metric in the global HUD reflects the updated execution
quality — all within a single session.

## Required UI

- Agent Arena builder screen (T044)
- Swarm run view with signal list
- Review Board showing consolidated signals
- Global Experience HUD with VDI indicator (T080)

## Required Data/API

- Arena swarm launch RPC (`/rpc/arena.launchSwarm`)
- Signal deduplication RPC or processor (`packages/shared/src/agent/swarm/`)
- Review Board signal feed RPC (`/rpc/review.signals`)
- VDI update event stream or polling endpoint
- Experience Runtime Store (T074) binding HUD to VDI

## Required Automations

- Swarm completion triggers signal dedup and Review Board population
- VDI updates in real time as swarm produces validated outputs
- Duplicate signals are collapsed (not dropped) with a count indicator

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Unit test: Swarm Signal Processor collapses identical signals and preserves
   unique ones with correct dedup count.
2. Integration test: launch a 2-agent swarm → assert at least one signal in the
   Review Board on completion.
3. Integration test: submit duplicate signals to the processor → assert single
   deduped entry with `count ≥ 2`.
4. Integration test: VDI store value increases after a swarm run with verified
   outputs.

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any regressions found should be filed as blocking tickets before Phase 20 can
close.

## Validation Commands

```bash
# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s04-arena-swarm-vdi

# Swarm signal processor tests
bun test packages/shared/src/agent/swarm/__tests__/**

# Experience/VDI runtime store tests
bun test apps/electron/src/renderer/components/workbench/**/__tests__/vdi*.test.*

# Agent contract gate
bun run validate:agent-contract
```

## Acceptance Criteria

- [ ] Arena builder allows selecting and launching 2+ agents as a swarm
- [ ] Swarm run produces visible signals in the signal list
- [ ] Duplicate signals are collapsed with a dedup count, not silently dropped
- [ ] Review Board shows the consolidated, deduped signal set
- [ ] Global HUD VDI indicator updates after the swarm completes
- [ ] VDI update is traceable to the swarm output (not a static stub)
- [ ] Screenshot evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S04)

## Worklog

Update `docs/worklog/T342-rc-s04-arena-swarm-vdi-update.md` with run log,
screenshots, and any blocker ticket references.
