# T137 - static-bundle probe

## 1. Task summary

Implement the `static-bundle` probe: read `budget.json` from `surfaceRoot`, stat corresponding files under `dist/` (or `ctx.buildOutputRoot`), and emit a `bundle:over-budget` finding for each file exceeding its byte limit. Includes a hermetic `bundle-bloated/` fixture with a pre-built dist artifact and a tight budget. The probe does not trigger a build — it reads existing artifacts only.

## 2. Repo context discovered

- None of the four real surfaces (`apps/electron/src/renderer`, `apps/webui`, `apps/viewer`, `apps/marketing`) ship a `budget.json` file. The probe's graceful skip on missing `budget.json` means the first full audit run (T138) produces 0 bundle findings — by design, not by error. Phase A.2 or the "D" sub-project (a11y + perf budgets) should author `budget.json` per surface based on current `dist/` measurements.
- `apps/webui/dist/` and `apps/viewer/dist/` exist locally after a build but are gitignored. The probe only reads existing artifacts; it does not call `bun run build`. Correct behavior — the probe is invoked post-build in CI, pre-existing artifacts locally.
- `statSync().size` returns the raw file size in bytes. For gzipped assets, this reflects the on-disk size, not the gzip-compressed size that the browser receives. Budget entries should be set against the uncompressed size for simplicity; a Phase A.2 enhancement could add a `gzip: true` flag to `budget.json` entries.
- `ctx.buildOutputRoot` is an optional override that the CLI populates if `--out` points to a non-default dist location. Currently defaults to `join(surfaceRoot, "dist")`.

## 3. Files inspected

- `packages/audit/src/probe.ts` — `Probe`, `ProbeContext` (`buildOutputRoot` optional field)
- `packages/audit/src/probes/static-tsc.ts` — structure reference for probe implementation
- `apps/webui/package.json` — build script, dist output path (`dist/`)
- `apps/viewer/package.json` — build script, dist output path
- `apps/marketing/package.json` — Next.js, outputs to `.next/` (not `dist/`) — probe would not match without a `buildOutputRoot` override
- `packages/audit/tests/fixtures/bundle-bloated/` — created during this task

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/probes/static-bundle.test.ts` | 3 |

Fixture committed at `5bac8ad`. Tests were in the same commit (fixture + test files co-committed as the TDD "red" step).

## 5. Expected failing test output

```
error: Cannot find module '../../src/probes/static-bundle.ts'
    at <anonymous> (packages/audit/tests/probes/static-bundle.test.ts:1:0)
```

## 6. Implementation changes

- `packages/audit/src/probes/static-bundle.ts` — `staticBundleProbe` object literal. Key details:
  - `applicableTo: () => true` — applies to all surfaces (probe skips via `budget.json` absence, not `applicableTo`).
  - Guards: `existsSync(budgetPath)` — returns `[]` if absent.
  - `budget` parsed as `Record<string, number>` (filename → maxBytes).
  - Iterates `Object.entries(budget)`, stats each file, skips if `!existsSync(filePath)`.
  - Emits finding only when `actualBytes > maxBytes`.
  - Rule: `bundle:over-budget`.
  - Severity: `high` (over-budget assets directly degrade load performance).
  - `confidence: 1`.
  - `vdiImpact: { quality: 0.5, risk: 0.4, readiness: 0.3 }`.

- `packages/audit/tests/fixtures/bundle-bloated/`:
  - `package.json` — minimal.
  - `budget.json` — `{ "main.js": 100 }` (100-byte max).
  - `dist/main.js` — pre-built JS content, >100 bytes (deliberate overage).

Commits:
- `5bac8ad` test(audit): bundle-bloated fixture with budget.json
- `e240209` feat(audit): static-bundle probe checks dist/ against budget.json

## 7. Validation commands run

```bash
cd packages/audit && bun test tests/probes/static-bundle.test.ts
cd packages/audit && bun test
cd packages/audit && bun run typecheck
```

## 8. Passing test output summary

```
bun test v1.3.13
 packages/audit/tests/probes/static-bundle.test.ts: 3 pass, 0 fail
```

Running full suite at T137 boundary: 38 pass, 0 fail.

## 9. Build output summary

No build step. `bun run typecheck` exits 0.

## 10. Remaining risks

- None of the four real surfaces ship a `budget.json`. Until Phase A.2 or D adds budgets, the bundle probe produces 0 findings on real surfaces. This is true-but-misleading: the harness works correctly but provides no signal. Priority action: author `budget.json` for each surface using current `dist/` measurements as a baseline, then tighten iteratively.
- `apps/marketing` outputs to `.next/` (Next.js default), not `dist/`. The probe will silently skip all `budget.json` entries whose `filePath` resolves to `.next/<filename>` unless `ctx.buildOutputRoot` is overridden. The CLI `--out` flag exists for this purpose but is not yet wired per-surface; a per-surface `buildOutputRoot` config in `audit.json` would be cleaner.
- `statSync` throws if `filePath` is a directory (e.g., if `budget.json` accidentally names a directory). No guard currently — would surface as an unhandled crash in the probe and produce a `_probe.crash` meta-finding. Low probability but worth adding a `statSync().isFile()` guard in Phase A.2.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Probe metadata (name + phase) correct | ✅ | Test "metadata" passes |
| 0 findings when within budget | ✅ | Test "returns no findings when bundle under budget" passes |
| 1 finding when over budget | ✅ | Test "emits finding when bundle exceeds budget" passes |
| Rule is `bundle:over-budget` | ✅ | Asserted inline in "emits finding when bundle exceeds budget" |
| Message includes actual/budget/overage bytes | ✅ | Asserted inline in "emits finding when bundle exceeds budget" |
| Severity is `high` | ✅ | Asserted inline in "emits finding when bundle exceeds budget" |
| Skip on missing budget.json | ✅ | Test "returns [] when surfaceRoot has no budget.json" passes (added in T138 fix-up commit) |
| `bun test static-bundle.test.ts` passes | ✅ | 4 pass, 0 fail (3 original + 1 skip-on-absent added in T138 fix-up commit) |
| Typecheck exits 0 | ✅ | `tsc --noEmit` exit 0 |
| Worklog complete | ✅ | This document |
| Commit created | ✅ | `e240209` |
