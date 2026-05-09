# T144 - A.2 architect-followup cleanup

## 1. Task summary

Architect verification of Phase A.2 (`feat/audit-a2-runtime`) identified 5 correctness/robustness concerns. Implement as 5 focused commits to prevent A.3 from inheriting compounding bugs. Fixes: (1) Playwright lifecycle leak in CLI, (2) runtime-states confidence downgrade, (3) runtime-axe location.route field, (4) strengthened CLI smoke + manifest-order tests, (5) CI-portable audit:smoke script.

## 2. Repo context discovered

- `packages/audit/src/cli.ts:114-131` — Playwright instantiation and close were not guarded by try/finally; any throw after `createPlaywrightRunner()` leaked the browser process.
- `packages/audit/src/probes/runtime-states.ts` — Three Finding emissions all used `confidence: 0.7`. Stylesheet substring matching (searching for `:hover`/`:focus`/`:disabled` substrings in CSS text) is a heuristic that can match unrelated elements, producing false positives.
- `packages/audit/src/probes/runtime-axe.ts` — `FindingLocation` interface (defined in `probe.ts`) has an optional `route?: string` field. The axe probe built its target URLs from route strings but discarded those route values, leaving `location.route` unpopulated.
- `packages/audit/tests/cli.test.ts` — Only two tests (help flag, error on missing surfaces); no end-to-end round-trip covering actual queue.json output.
- `packages/audit/tests/reporters/json-queue.test.ts` — Manifest-order test verified file existence and content but did not assert write ordering via mtime.
- `package.json` — `audit:smoke` and `validate:audit` called `bun run ...` directly; `bun` may not be on PATH in all CI environments (installed to `~/.bun/bin/bun` by the official installer).

## 3. Files inspected

- `packages/audit/src/cli.ts` — Full read; identified the try/finally gap at lines 114-131.
- `packages/audit/src/probes/runtime-states.ts` — Full read; confirmed three `confidence: 0.7` occurrences across interactive-states, empty-state, and error-state finding emissions.
- `packages/audit/src/probes/runtime-axe.ts` — Full read; confirmed targets was a `string[]` and `location.route` was absent.
- `packages/audit/src/probe.ts` — Full read; confirmed `FindingLocation.route?: string` is a defined field.
- `packages/audit/src/discovery.ts` — Full read; confirmed `discoverRoutes()` returns `string[]` of route paths (e.g., `"/"`, `"/about"`).
- `packages/audit/tests/cli.test.ts` — Full read; 2 tests.
- `packages/audit/tests/reporters/json-queue.test.ts` — Full read; 5 tests; manifest-order test checked existence/content only.
- `packages/audit/src/reporters/json-queue.ts` — Full read; confirmed `atomicWriteJson` is synchronous (`writeFileSync` + `renameSync`); manifest is last.
- `package.json` — Full read; confirmed `audit:smoke` and `validate:audit` script values.
- `docs/worklog/T141-runtime-states-probe.md` — Full read; identified §10 as the section to update with confidence downgrade rationale.

## 4. Tests added first (Fix 4)

| File | Test | Purpose |
|---|---|---|
| `packages/audit/tests/cli.test.ts` | "runs static-tsc against a fixture surface and writes valid queue.json" | Round-trip: CLI exits 0, queue.json has schemaVersion:1 and findings array |
| `packages/audit/tests/reporters/json-queue.test.ts` | "manifest.json is written last" (strengthened) | Adds `statSync` mtime assertion; skips if mtimes equal (sub-ms filesystem) |

## 5. Expected test state before Fix 4

Before adding the round-trip test, the CLI test file had 2 tests covering only error and help paths. The manifest-order test existed but only checked `existsSync` and JSON content — no ordering evidence.

## 6. Implementation changes

### Fix 1: Playwright try/finally (`packages/audit/src/cli.ts`)
Wrapped the entire block from `registry.run()` through `generateTickets()` and `process.stdout.write()` in `try { … } finally { if (playwright) await playwright.close(); }`. Removed the unconditional `if (playwright) await playwright.close()` that was previously between `registry.run()` and `rank()`. The browser now closes on both success and error paths.

### Fix 2: Confidence downgrade (`packages/audit/src/probes/runtime-states.ts`)
Used `replace_all: true` on `confidence: 0.7` → `confidence: 0.5` to catch all three occurrences atomically. Updated `docs/worklog/T141-runtime-states-probe.md` §10 with a dated note explaining the architect recommendation and the decision to take the lighter fix. Also updated the §11 acceptance criteria row from `confidence: 0.7` to `confidence: 0.5`.

### Fix 3: location.route field (`packages/audit/src/probes/runtime-axe.ts`)
Changed `targets` from `string[]` to `Array<{ url: string; route: string }>`. Route-based targets use `route: r`; the fallback index.html case uses `route: "/"`. Loop variable renamed from `url` to `target`, destructured to `{ url, route }`. All Finding emissions include `location: { file: url, selector: nodeTarget, route }`.

### Fix 4: Strengthened tests
- `tests/cli.test.ts`: Added `mkdtempSync`, `readFileSync`, `rmSync`, `tmpdir` imports. New test uses `spawnSync` with `--no-tickets` flag, `--probes=static-tsc`, and `--out=<tmp>`. Asserts exit 0, `queue.schemaVersion === 1`, `Array.isArray(queue.findings)`. Cleanup in `try/finally` to avoid tmp dir leaks.
- `tests/reporters/json-queue.test.ts`: Added `statSync` to imports. Strengthened manifest-order test to capture `mtimeMs` of both files via `statSync`. Assertion: `if (manifestMtime !== queueMtime) expect(manifestMtime).toBeGreaterThan(queueMtime)`. The conditional prevents flakiness on fast/tmpfs filesystems where both writes land in the same millisecond tick.

### Fix 5: CI-portable smoke script
Created `scripts/audit-smoke.sh` (executable, `chmod +x`):
- Resolves `bun` via `command -v bun` first (covers PATH-based installs and nix environments).
- Falls back to `$HOME/.bun/bin/bun` (covers the official `curl | bash` installer default).
- Errors with a clear message if neither is found.
- Uses `REPO_ROOT` derived from `$(dirname "$0")/..` so it works from any `cwd`.
- Uses `exec` to replace the shell process (clean signal handling, no double-exit).

Updated `package.json`:
- `"audit:smoke"`: `"bun run packages/audit/src/cli.ts ..."` → `"bash scripts/audit-smoke.sh"`
- `"validate:audit"`: `"bun run audit:smoke"` → `"bash scripts/audit-smoke.sh"` (direct invocation avoids an extra bun process)

## 7. Validation commands run

```bash
# All tests
cd /home/dev/craft/rox-one-terminal/packages/audit
~/.bun/bin/bun test
# → 67 pass, 0 fail

# Typecheck
~/.bun/bin/bun run typecheck
# → tsc --noEmit (exit 0)

# Smoke script
cd /home/dev/craft/rox-one-terminal
bash scripts/audit-smoke.sh
# → audit run complete: 0 findings, 0ms (exit 0)

# Playwright lifecycle (runtime probes, all surfaces)
~/.bun/bin/bun run packages/audit/src/cli.ts run renderer,webui,viewer,marketing --probes=runtime-* --out=/tmp/a2-cleanup-verify --no-tickets
# → audit run complete: 0 findings, 3335ms (exit 0)
rm -rf /tmp/a2-cleanup-verify
```

## 8. Passing test output summary

```
bun test v1.3.13 (bf2e2cec)
 67 pass
 0 fail
 145 expect() calls
Ran 67 tests across 14 files. [4.40s]
```

Previous count was 66. The new round-trip CLI test accounts for the +1.

## 9. Build output summary

No separate build step for the audit package (bun runs TypeScript directly). `tsc --noEmit` (typecheck) exits 0. Smoke script exits 0 with expected output.

## 10. Remaining risks

- **Mtime assertion advisory nature**: On tmpfs or very fast local filesystems, `queue.json` and `manifest.json` may be written within the same millisecond, making `manifestMtime === queueMtime`. The test handles this by skipping the greater-than assertion in that case. This means the ordering guarantee is verified by code inspection (synchronous write sequence in `json-queue.ts`) rather than runtime evidence on fast filesystems.
- **runtime-states confidence at 0.5**: This is now below the 0.7 threshold where most heuristic probes would sit. The full heuristic tightening (framework-aware CSS detection, configurable empty-state patterns) remains deferred to A.4. Until then, consumers should treat runtime-states findings as low-confidence signals requiring manual review.
- **runtime-axe route discovery**: The `route` field is now populated, but routes are only discovered from `src/pages/*.html` files. SPA surfaces (renderer, webui, viewer, marketing) still return 0 findings because their JavaScript bundles are not executed by `file://` navigation. Route discovery via dev-server crawling remains an A.4 task.
- **No --no-tickets in round-trip CLI test**: The test uses `--no-tickets` to avoid writing to `docs/tickets/` during CI test runs. This means ticket generation is not covered by the round-trip test. Ticket-gen has its own dedicated tests.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| CLI Playwright closed in finally block | ✅ | `cli.ts` try/finally wraps registry.run through reporters |
| runtime-states all findings confidence: 0.5 | ✅ | 3 occurrences replaced via replace_all in runtime-states.ts |
| T141 §10 updated with confidence downgrade note | ✅ | Dated entry added to T141 worklog §10 |
| runtime-axe findings include location.route | ✅ | targets array is {url, route}[]; route propagated to Finding |
| Fallback index.html case sets route: "/" | ✅ | `[{ route: "/", url: \`file://...\` }]` |
| CLI round-trip test exits 0 and queue.json valid | ✅ | test passes (67 total, 0 fail) |
| Manifest-order test uses mtime assertion | ✅ | statSync mtimeMs comparison with sub-ms guard |
| scripts/audit-smoke.sh resolves bun portably | ✅ | PATH first, ~/.bun/bin/bun fallback, error if neither |
| package.json audit:smoke + validate:audit updated | ✅ | Both use `bash scripts/audit-smoke.sh` |
| bun test: 67 pass, 0 fail | ✅ | Output captured above |
| bun run typecheck: exit 0 | ✅ | tsc --noEmit clean |
| bash scripts/audit-smoke.sh: exit 0 | ✅ | Confirmed with live run |
