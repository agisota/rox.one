# T094 - Release Doc Reconciliation

Status: DONE

## Goal

Reconcile release documentation with the committed T091-T093 hardening state so
the RC docs no longer claim stale working-tree status or stale lint warnings.

## Scope

- Update release docs that still describe T091 as uncommitted.
- Add T092/T093 release-hardening evidence where the current RC summary lists
  completed ticket work.
- Update lint/readiness wording to reflect the T093 zero-warning lint pass.
- Preserve historical evidence sections when they explicitly describe the earlier
  T087 command run.

## Out of scope

- Changing product/runtime code.
- Rewriting the release narrative or production-readiness decision.
- Rerunning the full release suite.
- Staging unrelated local artifacts such as `events.jsonl` or `.claude/`.

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Release docs no longer say T091 is uncommitted | DONE |
| T092/T093 committed hardening evidence is represented | DONE |
| Current lint/readiness docs reflect 0 warnings after T093 | DONE |
| `bun run validate:docs` passes | DONE |
| `git diff --check` passes | DONE |
