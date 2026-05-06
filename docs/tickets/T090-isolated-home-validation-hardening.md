# T090 - Isolated Home Validation Hardening

Status: READY TO COMMIT

## Goal

Reduce production-readiness risk by hardening startup/runtime paths that fail in
clean or isolated environments, and by reconciling test/runtime assumptions so
validation evidence is internally consistent.

## Scope

- Make config-default loading robust when `~/.rox/config-defaults.json` has not
  yet been bootstrapped in a fresh HOME.
- Restore deterministic test coverage for runtime refresh payload shape when an
  LLM connection is actually configured.
- Eliminate the known focused blockers that are feasible without changing
  product behavior or introducing real-provider dependencies.
- Update ticket/worklog evidence with exact failing and passing commands.

## Constraints

- Preserve existing Craft/ROX behavior unless tests prove a startup/runtime bug.
- Do not touch `.env`, secrets, `events.jsonl`, `.claude/`, caches, or build
  artifacts.
- Keep tests fake-provider-safe and deterministic.
- Prefer the smallest safe changes over broad architectural rewrites.

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Fresh/isolated HOME no longer crashes on config-default reads in validated paths | DONE |
| Workspace creation and backend factory tests pass under isolated HOME | DONE |
| Runtime refresh payload-shape test reflects real configured connection state and passes | DONE |
| Targeted focused validation commands are recorded in worklog | DONE |
| Remaining risks are documented precisely | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |
