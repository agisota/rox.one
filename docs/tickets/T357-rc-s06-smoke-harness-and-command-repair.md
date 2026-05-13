# T357 - RC S06 Smoke Harness And Command Repair

Status: Todo

## Context

Phase 20 RC Scenario S06 validates the File upload -> entity graph -> source
link path. T344 requires the shared smoke command:

```bash
bun run e2e:smoke -- --scenario s06-file-upload-entity-graph
```

Current `scripts/e2e-smoke.ts` registers S01 through S05, but not S06. T344 also
points at stale workbench/entity-graph globs that match no files.

## Goal

Register `s06-file-upload-entity-graph` in the RC smoke harness and repair the
T344 validation command paths so deterministic file upload/path validation,
entity graph, and source-link-adjacent coverage is rerunnable.

## TDD Requirements

1. Extend `scripts/__tests__/e2e-smoke-harness.test.ts` first so it fails while
   `s06-file-upload-entity-graph` is unsupported.
2. Assert the S06 scenario points at current file RPC/path validation,
   markdown-entity graph, renderer file-change, and session file-watch tests.
3. Keep existing S01 through S05 behavior unchanged.

## Implementation Requirements

- Add no production dependency.
- Do not change file manager, entity graph, or renderer runtime behavior.
- Update T344 validation commands from stale globs to current explicit paths.
- Mark this ticket DONE only after the S06 smoke command passes locally.

## Validation Commands

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s06-file-upload-entity-graph
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## Acceptance Criteria

- [ ] Harness contract test fails before implementation for unsupported S06.
- [ ] `s06-file-upload-entity-graph` is listed in supported scenarios.
- [ ] S06 smoke runs current file manager/path validation tests.
- [ ] S06 smoke runs current markdown entity graph tests.
- [ ] S06 smoke runs current source-link-adjacent renderer tests.
- [ ] T344 no longer references stale workbench/entity-graph globs.
- [ ] Existing S01 Linux host-blocker behavior is unchanged.
- [ ] Worklog captures red/green evidence.

## Worklog

Update `docs/worklog/T357-rc-s06-smoke-harness-and-command-repair.md`.
