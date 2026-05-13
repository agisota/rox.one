# T209 - Liquid Glass checkout mtime skew

Status: DONE

## Context

C4 final validation exposed a stable failure in the macOS Liquid Glass icon
contract on Linux checkout state. The committed `Assets.car` content is clean,
but the filesystem writes icon source files a few milliseconds after
`Assets.car`, so the mtime-only freshness check treats the compiled asset as
stale.

## Goal

Keep the Liquid Glass stale-asset guard durable while avoiding false positives
from same-checkout sub-second mtime skew.

## Required UI

None.

## Required Data/API

- Do not change icon artwork.
- Do not touch mtimes as the fix.
- Keep the stale-source guard active for real source changes.

## Required Automations

- Extend the existing contract test to cover the checkout-skew tolerance.

## Required Subagents

Use a read-only explorer for the unfamiliar icon packaging path.

## TDD Requirements

Use the existing red contract failure as the red state, then add the minimal
test coverage that proves the packaging hook applies the same tolerance.

## Implementation Requirements

- Apply a small mtime tolerance in the test and `afterPack` stale-source check.
- Keep the tolerance narrow enough that real stale assets remain blocked.

## Validation Commands

- `bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`
- Relevant final validation commands after all blockers are fixed.

## Acceptance Criteria

- [x] The contract test passes on a clean Linux checkout.
- [x] `afterPack` uses the same tolerance as the contract.
- [x] No icon sources or compiled icon content are changed.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T209-liquid-glass-checkout-mtime-skew.md`.
