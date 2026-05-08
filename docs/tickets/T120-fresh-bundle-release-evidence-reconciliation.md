# T120 - Fresh Bundle Release Evidence Reconciliation

Status: DONE

## Context

T119 added a repeatable fresh bundle artifact report that removes stale Electron
renderer, WebUI, and Viewer build outputs before rebuilding and measuring bundle
assets. The release handoff docs still describe the older T092 read-only
`report:bundle-artifacts` baseline, including the stale-output risk that T119
resolved for measurement.

Release evidence should reference the fresh report command and preserve the
remaining risk accurately: large chunks are still non-fatal, but the clean
baseline is no longer the stale WebUI `dist` total from T092.

## Goal

Reconcile release documentation with T119 fresh bundle evidence while keeping
the private-RC/public-production boundary unchanged.

## Scope

- Update release docs that summarize bundle evidence.
- Reference `bun run report:bundle-artifacts:fresh` as the current clean bundle
  measurement command.
- Record the fresh Electron renderer, WebUI, and Viewer JS totals from T119.
- Preserve the remaining large-chunk policy risk as non-fatal current evidence.

## Out of scope

- Rebuilding bundles.
- Changing Vite chunking or bundle budgets.
- Changing runtime UI behavior.
- Changing dependency manifests.
- Changing signing, notarization, ASAR, or release upload policy.

## Constraints

- Follow worklog-first and red-before-implementation flow.
- Docs-only change.
- Keep public production blocked.
- Preserve T092 as historical evidence and T119 as the current fresh
  measurement evidence.

## Validation Commands

- `rg -n "report:bundle-artifacts:fresh|T119|17,464,023|16\\.65 MB" docs/release docs/tickets/T105-release-handoff-current-evidence.md docs/worklog/T105-release-handoff-current-evidence.md`
- `bun run validate:docs`
- `git diff --check`
- `git status --short -- package.json bun.lock apps/electron/package.json`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Worklog captures stale release evidence before implementation | DONE |
| Targeted docs evidence check fails before implementation | DONE |
| Release docs cite T119 fresh bundle evidence | DONE |
| Release docs cite `report:bundle-artifacts:fresh` | DONE |
| Fresh WebUI clean-build total replaces stale T092 total as current baseline | DONE |
| Large chunks remain documented as non-fatal risk | DONE |
| Private RC versus public production boundary is unchanged | DONE |
| Docs validation passes | DONE |
| Worklog is complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T120-fresh-bundle-release-evidence-reconciliation.md`.
