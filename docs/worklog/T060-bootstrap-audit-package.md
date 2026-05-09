# T060 - Bootstrap audit package

## 1. Task summary

Bootstrap the `@rox-agent/audit` Bun workspace package from scratch. Deliver the shared infrastructure that all subsequent A.1 tickets depend on: `Probe` interface, `Finding` type with stable SHA-256-prefix IDs, `ProbeRegistry` with worker-pool parallelism + per-probe timeout + crash isolation, pure `rank()` function, JSON queue reporter (atomic write, manifest-last), Markdown sidecar reporter, CLI entrypoint, and package README. This ticket spans Tasks 1–10 of the implementation plan.

## 2. Repo context discovered

- All 10 of 11 packages (excluding `server-core` which ships a bare `"name": "roxone"`) use the `@rox-agent/<name>` scoped naming convention. Initial plan specified `"name": "audit"` (unscoped) — corrected to `@rox-agent/audit` in commit `cbb33c8` after `bun pm ls --workspaces` revealed the pattern. `bun.lock` required a full refresh (`084c74c`) after the rename.
- `tsconfig.base.json` sets `noUncheckedIndexedAccess: true`. This surfaced in `registry.ts` where `findings[0]` needed optional chaining — fixed in `ac0ca9c`.
- Worker pool's internal `pending` queue uses `Array.shift()` which is O(n). Acceptable at A.1 scale (≤4 surfaces × ≤3 probes = 12 pairs max). Noted for future optimization.
- `src/index.ts` placeholder was required initially so `tsc --noEmit` did not exit with TS18003 ("no input files"). Dropped in `122c131` once `src/probe.ts` was committed and the `include` glob picked it up.
- Root `.gitignore` did not have an `audits/` entry. Added at end-of-file per plan.

## 3. Files inspected

- `tsconfig.base.json` — compiler options, `noUncheckedIndexedAccess`, `moduleResolution: bundler`
- `package.json` (root) — workspace glob `"packages/*"` already covers `packages/audit`; no edit needed for workspace registration
- `packages/core/package.json`, `packages/shared/package.json` — scoped name pattern, dep pinning style (exact versions, no `^`)
- `packages/shared/src/` — existing module structure for reference; confirmed Bun test runner (`bun:test`) is the standard
- `AGENTS.md` — TDD operating contract, required worklog sections

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/probe.test.ts` | 5 |
| `packages/audit/tests/registry.test.ts` | 7 |
| `packages/audit/tests/ranker.test.ts` | 6 |
| `packages/audit/tests/reporters/json-queue.test.ts` | 3 |
| `packages/audit/tests/reporters/markdown-sidecar.test.ts` | 4 |
| `packages/audit/tests/cli.test.ts` | 2 |

Tests were committed before their corresponding implementation modules in each TDD cycle.

## 5. Expected failing test output

```
error: Cannot find module '../src/probe.ts'
    at <anonymous> (packages/audit/tests/probe.test.ts:1:0)
```

Registry tests similarly failed with `Cannot find module '../src/registry.ts'`. Ranker tests failed with `Cannot find module '../src/ranker.ts'`.

## 6. Implementation changes

- `packages/audit/package.json` — `@rox-agent/audit@0.9.1`, exact-pinned deps (`js-yaml@4.1.1`, `typescript@5.9.3`), `test:coverage` and `test:coverage:check` scripts added in T064.
- `packages/audit/tsconfig.json` — extends `../../tsconfig.base.json`, strict, `moduleResolution: bundler`, includes `src/**/*` and `tests/**/*`, excludes `tests/fixtures/**`.
- `packages/audit/src/probe.ts` — exports `Surface`, `Phase`, `FindingSeverity`, `ProbeContext`, `Probe`, `FindingLocation`, `FindingEvidence`, `VdiImpact`, `Finding`, `FINDING_SCHEMA_VERSION = 1`, `computeFindingId()` (SHA-256 over `probe+rule+file+line`, first 16 hex chars).
- `packages/audit/src/registry.ts` — `ProbeRegistry` class: `register()`, serial `run()` (Tasks 3–4), then worker-pool `run()` (Task 5) with configurable `workerCap`, `withTimeout()` helper, crash isolation via `try/catch` producing `_probe.crash` meta-findings with `confidence: 0`.
- `packages/audit/src/ranker.ts` — `rank(findings)`: score = `severityWeight × surfaceWeight × confidence + vdiBonus`; stable tie-break by `id`.
- `packages/audit/src/ranker.config.ts` — `RANKER_CONFIG`: critical=1000, high=100, medium=10, low=1; renderer=4, webui=3, viewer=2, marketing=1; `vdiBonusMax=50`.
- `packages/audit/src/reporters/json-queue.ts` — `writeJsonQueue()`: tmp+rename for `queue.json`; `manifest.json` written last with run metadata.
- `packages/audit/src/reporters/markdown-sidecar.ts` — `writeMarkdownSidecar()`: findings grouped by severity (critical → low); backtick escaping fixed in `26e27bd`.
- `packages/audit/src/cli.ts` — argument parsing via `process.argv`, registry invocation, reporter dispatch, exit codes.
- `packages/audit/README.md` — usage, phase roadmap, output artifact description.
- `.gitignore` (root) — added `audits/` block.

Commits in T060 scope (16 commits, `2670a46`..`e8cb690`):
- `2670a46` feat(audit): bootstrap packages/audit workspace
- `b23df27` chore(audit): pin exact dep versions per engineering rules
- `cbb33c8` fix(audit): scope package name to @rox-agent/audit per monorepo convention
- `084c74c` fix(audit): refresh bun.lock after package rename to @rox-agent/audit
- `122c131` chore(audit): drop redundant src/.gitkeep
- `dd7c86f` feat(audit): Probe interface + Finding type with stable id
- `d36ceb7` feat(audit): ProbeRegistry register + serial run
- `d938298` feat(audit): ProbeRegistry worker-pool parallelism
- `0795b61` feat(audit): per-probe timeout + crash isolation with zero-confidence findings
- `ac0ca9c` fix(audit): optional-chain findings[0] access (noUncheckedIndexedAccess)
- `4b506d7` fix(audit): clear timeout timer + drop unsafe error cast in worker
- `1324a12` feat(audit): pure ranker with severity/surface/confidence/VDI weights
- `ebcd865` feat(audit): JSON queue reporter with atomic write + manifest-last
- `a6cc1e5` feat(audit): Markdown sidecar reporter, severity-grouped
- `26e27bd` fix(audit): escape backticks in markdown sidecar + empty-findings test
- `e8cb690` feat(audit): CLI entrypoint with --help, --probes, --worker-cap, --out

## 7. Validation commands run

```bash
cd packages/audit && bun run typecheck
cd packages/audit && bun test
bun pm ls --workspaces | grep audit
```

## 8. Passing test output summary

```
bun test v1.3.13
 packages/audit/tests/probe.test.ts:          5 pass, 0 fail
 packages/audit/tests/registry.test.ts:       7 pass, 0 fail
 packages/audit/tests/ranker.test.ts:         6 pass, 0 fail
 packages/audit/tests/reporters/json-queue.test.ts:       3 pass, 0 fail
 packages/audit/tests/reporters/markdown-sidecar.test.ts: 4 pass, 0 fail
 packages/audit/tests/cli.test.ts:            2 pass, 0 fail
 27 pass, 0 fail
```

(Total across all packages/audit tests at end of T060 scope.)

## 9. Build output summary

No separate build step. `cd packages/audit && bun run typecheck` (`tsc --noEmit`) exits 0 with no output.

## 10. Remaining risks

- Worker pool `pending` queue uses `Array.shift()` — O(n). Negligible at A.1 scale (≤12 probe-surface pairs). Refactor to a proper FIFO if A.2+ probe count grows past ~20.
- `src/index.ts` placeholder was created early, removed after `src/probe.ts` was committed. Any future clean-workspace checkout that runs `tsc --noEmit` before source files exist will hit TS18003 again — acceptable given the include glob catches all `src/**/*`.
- 5 separate fix commits within T060 (incremental review feedback). The commit history is auditable but dense; a future rebase pass could consolidate for readability (do not squash before Phase A.1 acceptance gate).
- CLI `--out` flag writes to a caller-supplied path with no path-traversal validation. Acceptable for an internal dev tool; would need sanitization if ever exposed to untrusted input.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Package name `@rox-agent/audit@0.9.1` | ✅ | `packages/audit/package.json` `name` field |
| `bun pm ls --workspaces` lists package | ✅ | Verified during Task 1 Step 4 |
| `Probe` interface + all types exported from `src/probe.ts` | ✅ | File exists; typecheck exits 0 |
| `computeFindingId()` stable across restarts | ✅ | `probe.test.ts` stability test passes |
| `ProbeRegistry` register/run/parallelism/timeout/crash isolation | ✅ | `registry.test.ts` 7 tests pass |
| Pure `rank()` correct ordering | ✅ | `ranker.test.ts` 6 golden tests pass |
| JSON reporter atomic write, manifest-last | ✅ | `json-queue.test.ts` 3 tests pass |
| Markdown sidecar severity grouping | ✅ | `markdown-sidecar.test.ts` 4 tests pass |
| CLI flag parsing | ✅ | `cli.test.ts` 2 tests pass |
| `bun run typecheck` exits 0 | ✅ | `tsc --noEmit` exit 0 |
| Worklog complete | ✅ | This document |
| Commit created | ✅ | `e8cb690` (last T060 commit) |
