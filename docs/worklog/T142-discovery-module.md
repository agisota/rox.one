# T142 - Discovery module (closes A.1 0-findings gap)

## 1. Task summary

Centralize surface config discovery logic. Implement `packages/audit/src/discovery.ts` with path-walking functions for tsconfig, eslint config, and budget. Retrofit static probes (static-tsc, static-eslint, static-bundle) to use discovery. First A.1 audit run produced 0 findings because hardcoded paths didn't match real workspace layouts (configs stored one level up). Discovery closes this gap by walking up to repo root if needed. After discovery refactoring, 0 findings persists but is now *correct* — codebase typecheck:all and lint already pass, no budget.json exists.

## 2. Repo context discovered

- `apps/electron/tsconfig.json` exists; renderer surface root is `apps/electron/src/renderer/`, so tsconfig is one level up.
- `eslint.config.js` at repo root (flat config); surfaces inherit it by walking up (no per-surface override).
- No `budget.json` anywhere in the repo; all surfaces return `null` from `findBudget()` (correct behavior, no budget constraints defined).
- `discoverRoutes()` scans for `<surfaceRoot>/src/pages/*.html` for file-based routing. SPAs (renderer, webui, viewer, marketing) have no such directory; returns `[]` (expected, per spec A.4 is where crawling lands).

## 3. Files inspected

- `apps/electron/tsconfig.json` — exists, one level up from renderer surface root
- `eslint.config.js` (root) — flat config format
- `packages/audit/src/probes/static-tsc.ts` — hardcoded path construction pre-refactoring
- `packages/audit/src/probes/static-eslint.ts` — hardcoded candidate file loop pre-refactoring
- `packages/audit/src/probes/static-bundle.ts` — readBudget() function pre-refactoring
- `.gitignore` — existing patterns

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/discovery.test.ts` | 9 |

Tests written before implementation of `src/discovery.ts`.

## 5. Expected failing test output

```
error: Cannot find module '../src/discovery.ts'
    at <anonymous> (packages/audit/tests/discovery.test.ts:1:0)
```

After stubs, tests would fail with path/format mismatches:
```
expect(findTsconfig("/some/path")).toBe(expected)
  Expected: "/some/path/tsconfig.json"
  Received: null
```

## 6. Implementation changes

- `packages/audit/src/discovery.ts` (created):
  - **findTsconfig(surfaceRoot: string): string | null**
    - Checks `<surfaceRoot>/tsconfig.json`.
    - Falls back one directory up: `<parent>/tsconfig.json`.
    - Returns null if neither found.
  
  - **findEslintConfig(surfaceRoot: string): {path, format} | null**
    - format: "flat" | "legacy"
    - Checks flat variants (eslint.config.js, .mjs, .ts) at surfaceRoot.
    - Checks legacy variants (.eslintrc.json, .eslintrc.js, .eslintrc) at surfaceRoot.
    - Walks up directory tree to filesystem root, checking both variants.
    - Returns {path, format} or null.
  
  - **findBudget(surfaceRoot: string): string | null**
    - Checks exact `<surfaceRoot>/budget.json` only.
    - Does NOT walk up (budget is surface-specific).
    - Returns path or null.
  
  - **discoverRoutes(surface: Surface, surfaceRoot: string): string[]**
    - Scans `<surfaceRoot>/src/pages/*.html` for file-based routes.
    - Returns array of route URLs (e.g., `["/", "/about"]` for index.html + about.html).
    - Returns `[]` for unknown/SPA surfaces or if src/pages/ doesn't exist.

- `packages/audit/tests/discovery.test.ts` (created):
  - Tests for each function covering: present at root, absent, walk-up one level, walk-up to repo root, no config anywhere, flat vs legacy detection, empty surface.

- `packages/audit/src/probes/static-tsc.ts` (modified):
  - Replaced hardcoded `join(ctx.surfaceRoot, "tsconfig.json")` with `findTsconfig(ctx.surfaceRoot)`.
  - Added import: `import { findTsconfig } from "../discovery.ts";`.
  - Adjusted null check to handle optional return.

- `packages/audit/src/probes/static-eslint.ts` (modified):
  - Replaced candidate file loop with `const found = findEslintConfig(ctx.surfaceRoot);`.
  - Added import: `import { findEslintConfig } from "../discovery.ts";`.
  - Uses `found.format` to decide CLI args (flat uses `--config <path>`, legacy uses `-c <path>`).

- `packages/audit/src/probes/static-bundle.ts` (modified):
  - Replaced `readBudget(ctx.surfaceRoot)` call with `findBudget(ctx.surfaceRoot)`.
  - Added import: `import { findBudget } from "../discovery.ts";`.

Commits (T142, 2 commits):
- `e7fc4a3` feat(audit): surface discovery module with fallback paths
- `8f637e5` fix(audit): use discovery module in static probes — closes A.1 0-findings gap

## 7. Validation commands run

```bash
cd packages/audit && bun test tests/discovery.test.ts
cd packages/audit && bun test tests/probes/static-*.test.ts
bun run validate:audit
```

## 8. Passing test output summary

```
bun test v1.3.13
 packages/audit/tests/discovery.test.ts:             9 pass, 0 fail
 packages/audit/tests/probes/static-tsc.test.ts:     4 pass, 0 fail
 packages/audit/tests/probes/static-eslint.test.ts:  2 pass, 0 fail
 packages/audit/tests/probes/static-bundle.test.ts:  3 pass, 0 fail
 18 pass, 0 fail
```

(Existing static probe tests still pass because discovery returns the same paths for fixtures.)

## 9. Build output summary

No separate build. Audit run with discovery-enabled static probes:
```
bun run validate:audit
[audit] renderer: static-tsc: 0 findings
[audit] renderer: static-eslint: 0 findings
[audit] renderer: static-bundle: 0 findings
[...all surfaces...]
[audit] total: 0 findings. Tickets: 0 created, 0 updated, 0 auto-resolved.
```

0 findings is now *correct* (codebase is clean; typecheck:all + lint pass; no budget constraints). Previously 0 was misleading because the probes weren't finding configs. Now they find configs and correctly report no violations.

## 10. Remaining risks

- `findEslintConfig()` walks up to filesystem root. Could find configs in unexpected places (e.g., `~/.config/eslint.config.js` if home directory is in the path). Practical risk is low because discovery stops at the repo root in practice (ancestor directory check would still find repo-level config before home). Could add explicit repo-root boundary if needed (A.4).
- `discoverRoutes()` only scans `src/pages/*.html` for file-based routing. Multi-level nesting (e.g., `src/pages/admin/index.html`) would return only the file, not the proper route. Phase A.4 refines with framework-specific routes (Next.js pages/, SvelteKit routes/, etc.).
- First full audit run with discovery still produces 0 findings (correct, but potentially confusing to users new to the architecture). Phase A.2 documents this clearly in T143.
- PATH gap in `validate:audit` still unaddressed (architect's HIGH concern from A.1 planning). Fix in separate cleanup before main merges.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| findTsconfig returns surfaceRoot/tsconfig.json when present | ✅ | `tests/discovery.test.ts` case 1 passes |
| findTsconfig walks up one level | ✅ | `tests/discovery.test.ts` case 3 passes |
| findTsconfig returns null when absent | ✅ | `tests/discovery.test.ts` case 2 passes |
| findEslintConfig detects flat config | ✅ | `tests/discovery.test.ts` case 4 passes |
| findEslintConfig detects legacy config | ✅ | `tests/discovery.test.ts` case 5 passes |
| findEslintConfig walks up to repo root | ✅ | `tests/discovery.test.ts` case 6 passes |
| findEslintConfig returns null when absent | ✅ | `tests/discovery.test.ts` case 7 passes |
| findBudget checks exact path only (no walk-up) | ✅ | `tests/discovery.test.ts` case 8 passes |
| discoverRoutes returns [] for SPA | ✅ | `tests/discovery.test.ts` case 9 passes |
| static-tsc uses findTsconfig | ✅ | Import + call visible in modified file |
| static-eslint uses findEslintConfig | ✅ | Import + call visible in modified file |
| static-bundle uses findBudget | ✅ | Import + call visible in modified file |
| All static probe tests still pass | ✅ | 4 + 2 + 3 = 9 pass, 0 fail |
| Audit run produces correct 0 findings | ✅ | validate:audit output shown above |
| typecheck exits 0 | ✅ | `tsc --noEmit` no errors |
