# T336 - Shiki Adapter Contract Repair

Status: DONE

## Context

PR #85 merged the shared Shiki adapter under `packages/shared/src/highlight/`
before the required Phase 11 ADR, ticket, and worklog metadata landed. The
merged corpus test also fails full typecheck because `HIGHLIGHT_CORPUS[0]` is
possibly undefined under the repo's strict TS settings.

T243 is already used on `main` for RBAC property-based scope-forgery tests, so
this repair uses the next free ticket number instead of duplicating the
roadmap's original T243 placeholder.

## Goal

Repair the merged adapter slice by adding implementation metadata and fixing
the corpus test type error without changing runtime adapter behavior.

## Required UI

None.

## Required Data/API

No API changes. The existing `@rox-one/shared/highlight` export from PR #85
stays unchanged.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Run typecheck first and capture the failure:

```text
src/highlight/__tests__/highlight-corpus.test.ts(65,34): error TS18048:
'sample' is possibly 'undefined'.
```

Then fix the test and rerun the targeted corpus test plus full typecheck.

## Implementation Requirements

- Add implementation metadata in `docs/tickets/T336-shiki-adapter-contract-repair.md`.
- Add the matching 11-section worklog.
- Fix `packages/shared/src/highlight/__tests__/highlight-corpus.test.ts` with
  an explicit non-null assertion for the first corpus sample.
- Do not modify runtime adapter code.

## Validation Commands

- `bun test packages/shared/src/highlight/__tests__/`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [x] T336 ticket/worklog exist.
- [x] Corpus test typecheck failure is fixed.
- [x] Highlight corpus tests pass.
- [x] Typecheck, lint, docs, roadmap, rebrand, build, and diff checks pass.
- [x] Runtime adapter files remain behaviorally unchanged.

## Worklog

See `docs/worklog/T336-shiki-adapter-contract-repair.md`.
