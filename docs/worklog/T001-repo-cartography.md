# T001 Repo Cartography Worklog

## Task summary

Create a read-only architecture map for the Rox Agents fork before implementing Agent Workbench Suite product layers. T001 changes documentation and validation only; no source behavior is changed.

## Repo context discovered

The repository is a Bun monorepo with Electron renderer/main/preload code, shared domain packages, server-core runtime/API code, reusable UI components, existing automation/label/workspace/skill/test surfaces, and desktop/web build scripts.

## Files inspected

Discovery used directory and symbol search over these surfaces:
- `package.json`
- `apps/electron/src/main`
- `apps/electron/src/preload`
- `apps/electron/src/renderer`
- `apps/electron/src/shared`
- `apps/electron/src/transport`
- `packages/server/src`
- `packages/server-core/src`
- `packages/shared/src`
- `packages/ui/src`

## Tests added first

Added `scripts/validate-architecture-docs.ts` before creating the architecture docs. The validator checks required architecture documents, subsystem headings, and worklog sections.

## Expected failing test output

Command:

```sh
bun run scripts/validate-architecture-docs.ts
```

Expected red-phase output:

```text
[architecture-docs] missing required file: docs/architecture/repo-map.md
```

## Implementation changes

Created:
- `docs/architecture/repo-map.md`
- `docs/architecture/extension-points.md`
- `docs/architecture/test-harness-map.md`
- `docs/worklog/T001-repo-cartography.md`
- `scripts/validate-architecture-docs.ts`

Updated:
- `package.json` with `validate:architecture-docs`

## Validation commands run

Red phase:

```sh
bun run scripts/validate-architecture-docs.ts
```

Green phase:

```sh
bun run validate:architecture-docs
```

Static whitespace check:

```sh
git diff --check -- docs/architecture docs/worklog/T001-repo-cartography.md scripts/validate-architecture-docs.ts package.json
```

## Passing test output summary

Expected green output:

```text
[architecture-docs] ok: 4 docs, 10 subsystem headings
```

## Build output summary

No application source changed in T001. Full app build is intentionally deferred to implementation tickets and release gates.

## Remaining risks

The architecture map is based on static repo discovery and should be updated when later tickets add new product modules. It does not claim production readiness for managed cloud, billing, or team isolation.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| All key systems mapped | PASS | Repo map covers UI, Server, Workspaces, Skills, Automations, Permissions, Labels, Remote Server, Tests, Build |
| Future tasks can cite file paths | PASS | Docs include concrete package/file paths and recommended extension points |
| No source behavior changed | PASS | T001 changes docs, validator script, and package script only |
| Validation script exists | PASS | `scripts/validate-architecture-docs.ts` |
| Validation passes | PASS | `bun run validate:architecture-docs` |
