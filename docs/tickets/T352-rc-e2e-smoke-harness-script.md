# T352 - RC E2E smoke harness script

Status: Todo

## Context

Phase 20 RC scenario tickets T339 through T348 require a shared smoke command:

```bash
bun run e2e:smoke -- --scenario <scenario-id>
```

S01 validation on 2026-05-13 reached the command gate and failed before Electron
could launch because the root `package.json` does not define `e2e:smoke`.

## Goal

Provide a reproducible RC smoke harness entry point that can dispatch the ten
Phase 20 scenario ids and fail clearly when a scenario is unsupported or the
host environment cannot run the required packaged Electron flow.

## Required Scope

- Add a root `e2e:smoke` script.
- Route `--scenario s01-registration` to the S01 registration and session
  persistence smoke path.
- Preserve existing `electron:smoke`, `electron:ui-smoke:packaged:mac`, and
  `e2e:core` behavior.
- Keep the command safe on non-macOS hosts by failing with an explicit
  environment blocker instead of hanging.

## TDD Requirements

1. Add a harness contract test that proves `s01-registration` is a recognized
   scenario id.
2. Add a negative contract test that an unknown scenario exits non-zero with a
   clear supported-scenarios message.
3. Add a package-script validation check proving `package.json` exposes
   `e2e:smoke`.

## Validation Commands

```bash
bun test <new harness test>
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
```

## Acceptance Criteria

- [ ] `bun run e2e:smoke -- --scenario s01-registration` no longer fails with
      `Script not found "e2e:smoke"`.
- [ ] Unsupported scenario ids fail closed with a clear message.
- [ ] S01 can proceed to either a real pass/fail smoke result or an explicit
      host-environment blocker.
- [ ] T339 can be re-run and updated from `Blocked` to `DONE` only after the
      smoke result and screenshots are captured.

## Worklog

Update `docs/worklog/T352-rc-e2e-smoke-harness-script.md` when implementing the
harness.
