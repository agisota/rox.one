# T092 - Bundle/Performance Chunk Budget

Status: READY_TO_COMMIT

## Goal

Turn the current Vite large chunk warnings for Electron, WebUI, and Viewer into
explicit release-risk evidence by adding a read-only bundle artifact report and
recording the measured baseline in repo docs.

## Scope

- Inspect current built asset output for Electron renderer, WebUI, and Viewer.
- Add a focused read-only reporting script for JS/CSS bundle artifacts.
- Print top largest JS/CSS assets and total JS/CSS size per target.
- Warn when any JS/CSS asset exceeds the current 500 KB Vite warning budget.
- Record measured baseline and release-risk interpretation in ticket/worklog.

## Out of scope

- Rechunking or code-splitting Electron/WebUI/Viewer bundles.
- Changing runtime behavior or product UX.
- Failing CI/build on current large chunk warnings.
- Deleting historical build outputs or build artifacts.
- Production dependency changes.

## Constraints

- Follow `AGENTS.md` TDD/validation expectations using validation checks first.
- Do not touch `events.jsonl` or `.claude/`.
- The report must fail only when expected build output is missing or malformed,
  not when size warnings are present.
- Prefer existing dependencies and Bun/Node standard library only.
- Keep the implementation read-only with respect to built artifacts.

## Acceptance Criteria

| Criteria | Status |
|---|---|
| `docs/tickets/T092-bundle-performance-budget.md` exists and captures scope/risks | DONE |
| `docs/worklog/T092-bundle-performance-budget.md` exists in required format | DONE |
| `scripts/report-bundle-artifacts.ts` reports Electron/WebUI/Viewer JS/CSS sizes | DONE |
| Package script `report:bundle-artifacts` exists | DONE |
| Report warns for chunks over 500 KB without failing on warnings | DONE |
| Report fails when expected build output is missing or lacks JS/CSS assets | DONE |
| Measured baseline for Electron/WebUI/Viewer is documented as release evidence | DONE |
| Focused validation commands pass | DONE |
| No unrelated runtime files are touched | DONE |
| Commit exists only after explicit user approval | PENDING |
