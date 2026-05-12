# T134 - Bootstrap audit package

Status: complete

## Context

Phase A.1 of the audit harness. Bootstrap the `packages/audit/` Bun workspace with all shared infrastructure: `Probe` interface, `Finding` type, `ProbeRegistry`, pure `rank()` function, JSON queue reporter, Markdown sidecar reporter, and CLI entrypoint. Subsequent tickets (T135–T138) build on this foundation.

## Summary

Create the `@craft-agent/audit` package from scratch. Scope the package name to the monorepo convention (`@craft-agent/*`). Deliver: workspace manifest, tsconfig, Probe interface, Finding type, stable hash ID, ProbeRegistry with worker-pool parallelism + per-probe timeout + crash isolation, pure ranker with severity/surface/VDI weights, JSON queue reporter (atomic tmp+rename, manifest written last), Markdown sidecar reporter (severity-grouped), CLI entrypoint (~150 LOC), and package README.

## Acceptance Criteria

- [x] `packages/audit/package.json` name is `@craft-agent/audit`, version `0.9.1`.
- [x] `bun pm ls --workspaces` lists `@craft-agent/audit@0.9.1`.
- [x] `Probe` interface, `Finding` type, all enums, `FINDING_SCHEMA_VERSION = 1` exported from `src/probe.ts`.
- [x] `computeFindingId()` is stable: same inputs → same SHA-256-prefix id across process restarts.
- [x] `ProbeRegistry` supports `register()`, serial `run()`, parallel worker-pool `run()`, per-probe timeout, crash isolation producing zero-confidence meta-findings.
- [x] Pure `rank(findings)` orders by `severityWeight × surfaceWeight × confidence + vdiBonus`.
- [x] JSON queue reporter writes `queue.json` + `manifest.json` atomically (tmp+rename); `manifest.json` written last.
- [x] Markdown sidecar groups findings by severity.
- [x] CLI parses `--probes`, `--worker-cap`, `--out`, `--no-tickets`, `--top-k`, `--help`.
- [x] `bun test packages/audit` — all tests pass.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T134-bootstrap-audit-package.md` complete.
- [x] Commit created.

## TDD Test Shape

Files: `tests/probe.test.ts`, `tests/registry.test.ts`, `tests/ranker.test.ts`, `tests/reporters/json-queue.test.ts`, `tests/reporters/markdown-sidecar.test.ts`, `tests/cli.test.ts`.

```
probe.test.ts      — computeFindingId stability, Finding shape invariants, schemaVersion=1
registry.test.ts   — register/run, parallelism ordering, timeout meta-finding, crash isolation
ranker.test.ts     — golden score ordering, tie-breaking, empty input
json-queue.test.ts — atomic write (manifest exists iff queue.json exists), dir creation
markdown-sidecar.test.ts — severity grouping, empty-findings output
cli.test.ts        — --help exits 0, unknown probe flag exits non-zero
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/package.json` | Create |
| `packages/audit/tsconfig.json` | Create |
| `packages/audit/README.md` | Create |
| `packages/audit/src/probe.ts` | Create |
| `packages/audit/src/registry.ts` | Create |
| `packages/audit/src/ranker.ts` | Create |
| `packages/audit/src/ranker.config.ts` | Create |
| `packages/audit/src/reporters/json-queue.ts` | Create |
| `packages/audit/src/reporters/markdown-sidecar.ts` | Create |
| `packages/audit/src/cli.ts` | Create |
| `packages/audit/tests/probe.test.ts` | Create |
| `packages/audit/tests/registry.test.ts` | Create |
| `packages/audit/tests/ranker.test.ts` | Create |
| `packages/audit/tests/reporters/json-queue.test.ts` | Create |
| `packages/audit/tests/reporters/markdown-sidecar.test.ts` | Create |
| `packages/audit/tests/cli.test.ts` | Create |
| `.gitignore` (root) | Modify — add `audits/` |

## Validation Commands

```bash
cd packages/audit && bun run typecheck
cd packages/audit && bun test
bun pm ls --workspaces | grep audit
```

## Worklog

`docs/worklog/T134-bootstrap-audit-package.md`
