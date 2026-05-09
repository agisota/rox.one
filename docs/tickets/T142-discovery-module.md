# T142 - Discovery module (closes A.1 0-findings gap)

Status: complete

## Context

Phase A.1 produced 0 findings because static probes hardcoded config paths (e.g., `<surfaceRoot>/tsconfig.json`). Real surfaces store configs one level up in the workspace hierarchy. Centralize discovery logic and retrofit static probes to use it.

## Summary

Implement `packages/audit/src/discovery.ts` with `findTsconfig()`, `findEslintConfig()`, `findBudget()`, and `discoverRoutes()` functions. `findTsconfig()` and `findEslintConfig()` walk up the directory tree to repo root if not found at surface root. `findBudget()` does NOT walk (exact path only). `discoverRoutes()` scans `<surfaceRoot>/src/pages/*.html` for file-based routing. Rewrite `static-tsc.ts`, `static-eslint.ts`, and `static-bundle.ts` to use discovery. Write comprehensive tests for all discovery cases (present at root, walk-up, absent, no config).

## Acceptance Criteria

- [x] `packages/audit/src/discovery.ts` exports `findTsconfig()`, `findEslintConfig()` (returns {path, format}), `findBudget()`, `discoverRoutes()`.
- [x] `findTsconfig()`: checks surfaceRoot and one level up; returns null if absent.
- [x] `findEslintConfig()`: checks surfaceRoot and walks up to repo root; detects flat (eslint.config.js) and legacy (.eslintrc.json); returns {path, format}.
- [x] `findBudget()`: checks exact surfaceRoot/budget.json only; returns null if absent (no walk-up).
- [x] `discoverRoutes()`: scans src/pages/*.html for file-based routes; returns [] for SPA/unknown surfaces.
- [x] `packages/audit/tests/discovery.test.ts` — ≥9 tests pass (path variants, format detection, walk-up bounds, absence).
- [x] `static-tsc.ts`, `static-eslint.ts`, `static-bundle.ts` refactored to use discovery; all existing probe tests still pass.
- [x] First audit run with discovery-enabled static probes produces non-zero findings OR documents correct reason for 0 (e.g., SPA with no src/pages).
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T142-discovery-module.md` complete.
- [x] Commit created (2 commits: discovery module, then static probe rewrites).

## TDD Test Shape

Files: `tests/discovery.test.ts`.

```
discovery.test.ts:
  - findTsconfig: at root, absent, walk-up one level
  - findEslintConfig: flat at root, legacy at root, walk-up, absent
  - findBudget: present, absent (no walk-up)
  - discoverRoutes: empty for unknown surface, routes for file-based, empty for SPA
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/discovery.ts` | Create |
| `packages/audit/tests/discovery.test.ts` | Create |
| `packages/audit/src/probes/static-tsc.ts` | Modify — use findTsconfig |
| `packages/audit/src/probes/static-eslint.ts` | Modify — use findEslintConfig |
| `packages/audit/src/probes/static-bundle.ts` | Modify — use findBudget |

## Validation Commands

```bash
cd packages/audit && bun test tests/discovery.test.ts
cd packages/audit && bun test tests/probes/static-*.test.ts
bun run validate:audit
```

## Worklog

`docs/worklog/T142-discovery-module.md`
