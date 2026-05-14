# T298b-rc-preflight-runner - Machine-executable runner for the RC pre-flight checklist (M.20)

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench
Suite.

T298 (PR #139) shipped `docs/release/v1-rc-preflight-checklist.md` — the
44-item human-readable RC pre-flight checklist. T298b is the
machine-executable half: a runner script that walks the validator subset
(16 of 44 items, all of §1) of that checklist and reports green/red per
gate so the release operator gets a deterministic, push-button signal
before tagging `v1.0.0-rc.1`.

Phase: M.20 (RC validation gate). Sibling ticket: `T298-rc-preflight.md`.
The runner is the executable companion to T298 — T298 froze the
checklist doc; this ticket only READS it.

## Goal

A `bun run rc:preflight` command that:

1. Parses §1 of `docs/release/v1-rc-preflight-checklist.md` to discover
   the ordered list of `validate:*` gates.
2. Runs each gate as `bun run validate:<name>` via `Bun.spawn`, captures
   exit code + a stdout/stderr tail + wall-clock duration.
3. Prints a green/red table keyed on gate name.
4. Exits non-zero if any gate fails. `--continue-on-failure` walks every
   gate even after a red, otherwise the runner short-circuits.

## Required UI

None — CLI-only deliverable.

## Required Data/API

None new. The runner consumes the existing `validate:*` `package.json`
scripts and the existing pre-flight checklist markdown.

## Required Automations

A new `rc:preflight` `package.json` script wired to the runner. No
hook/label/automation contract change; the checklist doc itself is
unchanged.

## Required Subagents

None — single executor pass. No skill delegation required.

## TDD Requirements

`scripts/__tests__/rc-preflight-runner.test.ts` ships in the same PR
and covers, at minimum:

1. The parser extracts the `validate:*` suffixes from §1 in document
   order and excludes aggregate gates (`validate:ci`, `validate:release`,
   `validate:dev`).
2. The parser throws when §1 is missing.
3. Happy path: two passing stub validators ⇒ `allPassed: true`,
   exit 0 propagates per gate.
4. Failure surface: one stub exits 1 ⇒ the runner reports red, captures
   stderr tail, short-circuits remaining gates, marks them `skipped`.
5. `--continue-on-failure` walks every gate including the ones after
   the red.
6. The rendered table contains the header, the gate names, the
   `pass`/`fail` status, and the failure summary string.
7. Missing checklist file throws a clear error.

Stub validators are real fixture projects (synthetic `package.json` +
`validate-*.ts` scripts that `process.exit(<code>)`) written under
`tmpdir()` for the duration of the test — no `Bun.spawn` mocking
required, the runner exercises the real spawn code path.

≥8 `expect()` calls total.

## Implementation Requirements

- New file `scripts/rc-preflight-runner.ts` (≤300 LOC source).
- New file `scripts/__tests__/rc-preflight-runner.test.ts` (≤250 LOC).
- `package.json` adds exactly one script: `rc:preflight`.
- No edits to `docs/release/v1-rc-preflight-checklist.md` — T298 froze
  it, the runner is a strict reader.
- No edits to `.swarm/master-roadmap-log.md`.

## Validation Commands

```
bun test scripts/__tests__/rc-preflight-runner.test.ts
bun run rc:preflight   # quick walk on the real validators
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

The 16 gates in `bun run rc:preflight` reflect the real state of the
working tree; gates that depend on build artifacts (bundle-budget,
bundle-policy, packaged-artifacts, audit) red on a clean checkout
because they need an Electron build first — this is the runner doing
its job, not a runner bug.

## Acceptance criteria

- `scripts/rc-preflight-runner.ts` exists, ≤300 LOC.
- `scripts/__tests__/rc-preflight-runner.test.ts` exists, ≤250 LOC,
  ≥8 `expect()` calls, every test green.
- `package.json` carries `"rc:preflight": "bun run scripts/rc-preflight-runner.ts"`.
- `docs/release/v1-rc-preflight-checklist.md` byte-for-byte unchanged.
- `docs/tickets/T298b-rc-preflight-runner.md` exists with `Status: DONE`.
- `docs/worklog/T298b-rc-preflight-runner.md` exists with the matching
  ticket id.
- PR opened against `main` from `feat/M20-T298b-rc-preflight-runner`.
