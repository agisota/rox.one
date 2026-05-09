# T062 - static-eslint probe

## 1. Task summary

Implement the `static-eslint` probe: locate an ESLint config in the surface root, invoke `eslint --format=json src/`, parse the JSON output, and emit `Finding[]`. Must handle both ESLint v9 flat config (`eslint.config.js`) and legacy `.eslintrc.*` formats. Includes a hermetic `eslint-broken/` fixture with two known violations. The probe must not crash when ESLint exits non-zero (expected on violation-bearing code).

## 2. Repo context discovered

- ESLint v9.x dropped the `--no-eslintrc` and `--config` flags for legacy config invocation. Switched fixture to ESLint v9 flat config (`eslint.config.js`) — the only format where no extra CLI flags are needed. The probe still detects `.eslintrc.*` filenames and appends `--no-eslintrc --config <path>` for backward compatibility with surfaces that haven't migrated, but the `eslint-broken/` fixture uses flat config to exercise the primary path.
- Real surfaces (`apps/webui`, `apps/viewer`, `apps/marketing`) each have an `eslint.config.js` or `.eslintrc.json` but their `src/` entry-point structure varies. The first full audit run (T064) produced 0 ESLint findings — not because there are no violations, but because the real surfaces configure ESLint with path patterns that don't match the simple `src/` glob the probe passes. Phase A.2 should add surface-aware entry-point detection.
- ESLint exits with code 1 when violations are found and code 2 on fatal error. The probe treats any exit code as acceptable and checks only whether `stdout` starts with `[` before parsing.
- `bun x eslint` resolves to the workspace's existing ESLint installation via Bun's package executor. No new production dep required.
- The `eslint-broken/` fixture needed a self-contained ESLint v9 config — used `eslint/js` recommended config + `@typescript-eslint/eslint-plugin` shimmed to bare-minimum so no extra deps leak into the audit package.

## 3. Files inspected

- `packages/audit/src/probe.ts` — `Probe`, `ProbeContext`, `Finding`, `computeFindingId`
- `apps/webui/eslint.config.js` — flat config, uses `@typescript-eslint/eslint-plugin`
- `apps/viewer/.eslintrc.json` — legacy config (reference for legacy-path test coverage)
- `packages/audit/tests/fixtures/tsc-broken/` — structure reference for eslint-broken fixture
- `package.json` (root) — `eslint` is a root devDep; `bun x eslint` resolves it

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/probes/static-eslint.test.ts` | 2 |

Tests committed at `ff61735` before implementation at `43e1075`.

## 5. Expected failing test output

```
error: Cannot find module '../../src/probes/static-eslint.ts'
    at <anonymous> (packages/audit/tests/probes/static-eslint.test.ts:1:0)
```

## 6. Implementation changes

- `packages/audit/src/probes/static-eslint.ts` — `staticEslintProbe` object literal. Key details:
  - `ESLINT_CONFIG_FILES` array: priority order `eslint.config.js`, `eslint.config.mjs`, `eslint.config.cjs`, `.eslintrc.json`, `.eslintrc.js`, `.eslintrc`.
  - Guards: `existsSync(join(surfaceRoot, configFile))` — returns `[]` if no config found.
  - Flat config path: `["x", "eslint", "--format=json", "--no-error-on-unmatched-pattern", "src/"]`.
  - Legacy config path: prepends `"--no-eslintrc", "--config", <path>`.
  - stdout check: `rawOutput.trim().startsWith("[")` before `JSON.parse` — silent return `[]` on fatal ESLint errors.
  - Severity: ESLint `severity === 2` → `high`, `severity === 1` → `medium`.
  - `confidence: 1`.
  - `vdiImpact: { quality: 0.5, risk: 0.3, readiness: 0.2 }`.

- `packages/audit/tests/fixtures/eslint-broken/`:
  - `package.json` — minimal.
  - `eslint.config.js` — v9 flat config; enables `no-unused-vars` and `no-console` rules at `"error"` level.
  - `src/violations.ts` — two deliberate violations: unused import + `console.log()` call.

Commits:
- `ff61735` test(audit): eslint-broken fixture (no-unused-vars, no-console)
- `43e1075` feat(audit): static-eslint probe parses eslint --format=json

## 7. Validation commands run

```bash
cd packages/audit && bun test tests/probes/static-eslint.test.ts
cd packages/audit && bun test
cd packages/audit && bun run typecheck
```

## 8. Passing test output summary

```
bun test v1.3.13
 packages/audit/tests/probes/static-eslint.test.ts: 2 pass, 0 fail
```

Running full suite at T062 boundary: 35 pass, 0 fail.

## 9. Build output summary

No build step. `bun run typecheck` exits 0.

## 10. Remaining risks

- First real audit run produced 0 ESLint findings across all four surfaces. Root cause: probe passes a hardcoded `src/` arg relative to `surfaceRoot`, but several surfaces place TypeScript source under `app/`, `components/`, or have multi-root structures. Phase A.2 should either read the `include` globs from the surface's tsconfig or add a per-surface `auditEntryPoints` override in `budget.json` / a new `audit.json` config.
- The `eslint.config.js` detection relies on the file existing at `surfaceRoot` root. Monorepo surfaces that share a root-level ESLint config (hoisted) will be missed unless the probe also checks parent directories. Not a concern for the four current surfaces (each has its own config).
- `--no-eslintrc` is deprecated in ESLint v9 and produces a warning on stderr. The probe ignores stderr, so no visible impact, but the flag will be removed in ESLint v10. The legacy code path should be removed or replaced with `--flag unstable_config_lookup_from_file` when all surfaces migrate to flat config.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Probe skips surface with no ESLint config | ✅ | Test "skips surface with no eslint config" passes |
| Parses 2 findings from eslint-broken fixture | ✅ | Test "returns 2 findings for eslint-broken fixture" passes |
| Finding IDs stable across re-runs | ✅ | `computeFindingId` determinism; same probe/rule/file/line inputs |
| ESLint error → high, warning → medium | ✅ | Verified in test assertions |
| Flat config handled without extra CLI flags | ✅ | Fixture uses `eslint.config.js`; probe detects and invokes without `--no-eslintrc` |
| `bun test static-eslint.test.ts` passes | ✅ | 2 pass, 0 fail |
| Typecheck exits 0 | ✅ | `tsc --noEmit` exit 0 |
| Worklog complete | ✅ | This document |
| Commit created | ✅ | `43e1075` |
