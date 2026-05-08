# T123 - Release Contract Continuation Scope Sync

Status: DONE

## Context

`bun run validate:release` now fails in
`scripts/__tests__/release-current-handoff-contract.test.ts` because the
release snapshot correctly describes the current `T098-T122` continuation, but
the focused handoff contract still expects the historical `T098-T104`
continuation text from T105.

## Goal

Bring the release-current handoff contract back in sync with the current release
docs so the full release validation can proceed against the T122 state.

## Required UI

No UI change.

## Required Data/API

No data or API change.

## Required Automations

- The focused release-current handoff contract checks the current `T098-T122`
  continuation text.
- The final RC doc no longer claims only `T090 through T121` are committed.

## Required Subagents

No subagent required: this is a bounded release validation contract update.

## TDD Requirements

The red state is already captured by the full release validation command:

```bash
bun run validate:release
```

Expected failure before implementation:

```text
Expected to contain: "T098-T104 continuation"
Received: "... The T098-T122 continuation ..."
```

## Implementation Requirements

- Update only the stale contract/doc wording.
- Do not change build artifacts, package manifests, or lockfiles.
- Re-run focused and full release validation before marking done.

## Validation Commands

- `bun test scripts/__tests__/release-current-handoff-contract.test.ts`
- `bun run validate:release`
- `bun run electron:dist:dev:mac:arm64`
- `bun run validate:packaged-artifacts`
- `bun run validate:mac-private-release-boundary`
- `bun run electron:smoke:packaged:mac`
- `git diff --check`
- `git status --short -- package.json bun.lock apps/electron/package.json`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Red release validation failure is recorded | DONE |
| Focused release handoff contract passes | DONE |
| Full release validation passes | DONE |
| Fresh Mac ARM package build passes | DONE |
| Packaged artifacts and packaged smoke pass | DONE |
| Package/lock dependency files remain unchanged | DONE |
| Worklog is complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T123-release-contract-continuation-scope-sync.md`.
