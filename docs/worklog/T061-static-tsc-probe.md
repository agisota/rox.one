# T061 - static-tsc probe

## 1. Task summary

Implement the `static-tsc` probe: wrap `tsc --noEmit` per surface, parse the default diagnostic output, and emit `Finding[]` with stable IDs. Deliver a hermetic `tsc-broken/` fixture containing three deliberate TS errors (TS2345 argument type mismatch, TS2322 assignability, TS7006 implicit any). The probe must skip surfaces that have no `tsconfig.json` and must not trigger a full build.

## 2. Repo context discovered

- All four real surfaces (`apps/electron/src/renderer`, `apps/webui`, `apps/viewer`, `apps/marketing`) have a `tsconfig.json` — but several use `"extends"` chains pointing into shared packages. The probe passes `-p <surfaceRoot>/tsconfig.json` directly; `tsc` resolves the extends chain transparently. No special handling needed.
- Some surfaces (notably `apps/marketing`) use a non-standard tsconfig location or skip `"include"` arrays. The probe falls back to `[]` gracefully if `tsconfig.json` absent. A future enhancement (Phase A.2) could add a probe option to specify a custom tsconfig path.
- `bun x tsc` resolves to the workspace's pinned `typescript@5.9.3` via Bun's `bun x` executor — no global `tsc` dependency required.
- `spawnSync` from `node:child_process` is available in Bun's Node compatibility layer. Tested against Bun 1.3.13.
- The tsc default output format (`path(line,col): error TSxxxx: message`) is stable across TypeScript 4.x–5.x. No `--json` flag exists in tsc — parsing the text format is the only option.

## 3. Files inspected

- `packages/audit/src/probe.ts` — `Probe`, `ProbeContext`, `Finding`, `computeFindingId`, `FINDING_SCHEMA_VERSION`
- `packages/audit/src/registry.ts` — `ProbeRegistry` to understand how `run(ctx)` is invoked
- `apps/electron/src/renderer/tsconfig.json` — `extends ../../../../tsconfig.base.json`
- `apps/webui/tsconfig.json` — `extends ../../tsconfig.base.json`
- `tsconfig.base.json` — `noUncheckedIndexedAccess: true` (affects severity mapping test expectations)
- `packages/audit/tests/probe.test.ts` — `computeFindingId` test patterns used as reference for fixture test

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/probes/static-tsc.test.ts` | 4 |

Tests committed at `918f8b4` before implementation at `0c3ebac`.

## 5. Expected failing test output

```
error: Cannot find module '../../src/probes/static-tsc.ts'
    at <anonymous> (packages/audit/tests/probes/static-tsc.test.ts:1:0)
```

## 6. Implementation changes

- `packages/audit/src/probes/static-tsc.ts` — `staticTscProbe` object literal implementing `Probe`. Key details:
  - `applicableTo: () => true` — applies to all four surfaces.
  - Guards on `existsSync(tsconfigPath)` — returns `[]` if absent.
  - Invokes `spawnSync(process.execPath, ["x", "tsc", "--noEmit", "-p", tsconfigPath], { cwd, encoding: "utf-8", timeout })`.
  - `parseTscOutput()` regex: `/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/` — strips non-matching lines silently.
  - Severity mapping: `TS6133`/`TS6196` → `low`, `TS7006` → `medium`, all others → `high`.
  - `confidence: 1` (tsc diagnostics have no false positives).
  - `vdiImpact: { quality: 0.6, risk: 0.4, readiness: 0.3 }`.

- `packages/audit/tests/fixtures/tsc-broken/` — hermetic fixture:
  - `package.json` — minimal, `"type": "module"`.
  - `tsconfig.json` — `"strict": true`, `"noEmit": true`, `"include": ["src/**/*"]`.
  - `src/broken.ts` — three deliberate errors: TS2345 (wrong arg type to `parseInt`), TS2322 (assigning `string` to `number`), TS7006 (implicit `any` parameter).

Commits:
- `918f8b4` test(audit): tsc-broken fixture with TS2345/TS2322/TS7006
- `0c3ebac` feat(audit): static-tsc probe wraps tsc --noEmit, parses diagnostics

## 7. Validation commands run

```bash
cd packages/audit && bun test tests/probes/static-tsc.test.ts
cd packages/audit && bun test
cd packages/audit && bun run typecheck
```

## 8. Passing test output summary

```
bun test v1.3.13
 packages/audit/tests/probes/static-tsc.test.ts: 4 pass, 0 fail
```

Full suite (from T060 base + T061): 27 + 4 = 31 pass, 0 fail.

## 9. Build output summary

No build step. `bun run typecheck` (`tsc --noEmit`) exits 0.

## 10. Remaining risks

- Probe assumes `tsconfig.json` exists at `surfaceRoot` root. Surfaces that place their tsconfig at a subdirectory (e.g., `apps/electron/src/renderer/tsconfig.json`) require the caller to pass `surfaceRoot` pointing at that subdirectory, not the app root. The CLI currently passes `apps/<surface>` as `surfaceRoot` — adequate for webui/viewer/marketing, may need tuning for the renderer surface which nests its tsconfig inside `src/renderer/`.
- `parseTscOutput()` does not handle multi-line diagnostic messages (some TS errors span continuation lines with `~~~` underlines). Continuation lines are silently skipped — finding count is still accurate, message text may be truncated for complex generics errors.
- `bun x tsc` adds subprocess startup overhead per surface (~0.3s). At A.1 scale (4 surfaces) this is ~1.2s total — acceptable. At A.3+ scale with more surfaces, consider caching the tsc binary path.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Probe skips surface with no tsconfig.json | ✅ | Test "skips surface with no tsconfig.json" passes |
| Parses 3 findings from tsc-broken fixture | ✅ | Test "returns 3 findings for tsc-broken fixture" passes |
| Finding IDs stable across re-runs | ✅ | Test "finding IDs are stable across calls" passes |
| TS7006 → medium, TS2345 → high | ✅ | Test "severity mapping" passes |
| `confidence = 1` | ✅ | Verified in test assertions |
| `bun test static-tsc.test.ts` passes | ✅ | 4 pass, 0 fail |
| Typecheck exits 0 | ✅ | `tsc --noEmit` exit 0 |
| Worklog complete | ✅ | This document |
| Commit created | ✅ | `0c3ebac` |
