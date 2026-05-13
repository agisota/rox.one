# T284 - Rebrand package scope closeout

Status: DONE

## Context

R.5.1 through R.5.11 have moved workspace package metadata, dependencies,
imports, and lockfile entries from `@rox-agent/*` to `@rox-one/*`.
The final package-scope closeout must prove active TypeScript, package
metadata, and tsconfig surfaces no longer carry legacy scoped package names.

## Goal

Add a closeout regression that fails on any active `@rox-agent/` package
scope reference in `*.ts`, `*.tsx`, `package.json`, or `tsconfig*.json`, then
remove the remaining active legacy package-scope literals from the server build
packaging script.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None required. The remaining active matches are already isolated to
`scripts/build-server.ts`.

## TDD Requirements

Extend the R.5 package-scope regression suite before implementation and confirm
it fails on the remaining legacy package-scope literals.

## Implementation Requirements

- Keep the scan focused on active code/config surfaces:
  - `apps/**/*.ts`
  - `apps/**/*.tsx`
  - `packages/**/*.ts`
  - `packages/**/*.tsx`
  - `scripts/**/*.ts`
  - root and workspace `package.json`
  - `tsconfig*.json`
- Exclude build outputs, dependencies, `.omx`, and `.omc`.
- Update `scripts/build-server.ts` runtime package-scope handling from
  `@rox-agent/*` to `@rox-one/*`.
- Record the shared/server-core compatibility-shim status explicitly without
  inventing an unpublished shim package shape in this closeout.

## Validation Commands

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:docs`
- `git diff --check`
- Active package-scope grep:
  `rg -n "@rox-agent/" scripts apps packages package.json tsconfig*.json --glob "*.ts" --glob "*.tsx" --glob "package.json" --glob "tsconfig*.json" --glob "!**/dist/**" --glob "!**/node_modules/**" --glob "!**/.omx/**" --glob "!**/.omc/**"`

## Acceptance Criteria

- [x] Ticket exists before code changes.
- [x] Red test proves the active package-scope closeout gap.
- [x] R.5 regression suite asserts zero active legacy package-scope references
  in the closeout surface.
- [x] `scripts/build-server.ts` uses `@rox-one/*` workspace scope handling.
- [x] Active package-scope grep returns no matches.
- [x] Full suite passes.
- [x] Build passes.
- [x] Compatibility-shim ambiguity is recorded as a remaining risk, not hidden.
- [x] Worklog complete after evidence is recorded.
- [x] Commit created.

## Worklog

Update `docs/worklog/T284-rebrand-pkg-scope-closeout.md`.
