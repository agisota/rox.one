# T138 - Ticket-gen, idempotency, CLI wiring, first end-to-end run

Status: complete

## Context

Phase A.1 closing ticket. Wire `ticket-gen` into the CLI, implement idempotency invariants, run the full audit against all four real surfaces for the first time, append a row to `docs/audits/INDEX.md`, add `validate:audit` smoke to `validate:ci`, write the root README section, and add the 80% coverage gate script.

## Summary

Implement `packages/audit/src/ticket-gen.ts`: finding → AGENTS.md-format ticket stub with YAML frontmatter (`findingId`, `probe`, `surface`, `rule`, `severity`, `firstSeen`, `lastSeen`, `status`). Idempotency: existing tickets detected by parsing frontmatter; re-runs update `lastSeen` only. Auto-resolved tickets: when a finding disappears, ticket status flips to `auto-resolved` via frontmatter patch. Allocator scans `docs/tickets/T<N>-*.md` for highest N, starts next at N+1. Wire into CLI via `--no-tickets` and `--top-k=50` flags. First end-to-end run: `bun run audit run renderer,webui,viewer,marketing --probes=static-*` producing 0 findings (probe-vs-surface config path mismatch documented). Row appended to `docs/audits/INDEX.md`. `validate:audit` smoke added to root `package.json` `validate:ci` chain.

## Acceptance Criteria

- [x] `ticket-gen` creates `docs/tickets/T<N>-<slug>.md` with YAML frontmatter for each finding.
- [x] Re-run with same finding: existing ticket updated (`lastSeen`), no duplicate created.
- [x] Finding that disappears: ticket `status` flips to `auto-resolved`.
- [x] Ticket number allocator starts from `highestExistingN + 1`.
- [x] CLI `--no-tickets` suppresses ticket creation; `--top-k` limits stubs to top-K findings.
- [x] `bun run audit run renderer,webui,viewer,marketing --probes=static-*` exits 0.
- [x] `docs/audits/INDEX.md` has first run row dated `2026-05-09T09-41-31-836Z`.
- [x] Root `package.json` `validate:ci` includes `bun run validate:audit`.
- [x] Root `README.md` has `## Audit harness` section.
- [x] `bun run test:coverage:check` from `packages/audit` prints "Coverage OK".
- [x] `bun test packages/audit` — all tests pass.
- [x] Worklog `docs/worklog/T138-ticket-gen-and-first-run.md` complete.
- [x] Commit created.

## TDD Test Shape

Files: `tests/ticket-gen.test.ts` (7 test cases, idempotency suite added in Task 21), `tests/cli.test.ts` (extended).

```
ticket-gen.test.ts:
  test("creates ticket with frontmatter for a finding")
  test("slugifies rule + surface into filename")
  test("allocates ticket number above highest existing")
  test("idempotent: second run with same findingId does not create duplicate")
  test("idempotent: lastSeen updated on re-run")
  test("auto-resolves ticket when finding no longer present")
  test("respects topK limit")
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/ticket-gen.ts` | Create |
| `packages/audit/tests/ticket-gen.test.ts` | Create |
| `packages/audit/src/cli.ts` | Modify — add `--no-tickets`, `--top-k` flags, invoke ticket-gen |
| `packages/audit/package.json` | Modify — add `test:coverage`, `test:coverage:check` scripts |
| `package.json` (root) | Modify — add `validate:audit`, extend `validate:ci` |
| `README.md` (root) | Modify — add `## Audit harness` section |
| `docs/audits/INDEX.md` | Create — first run row appended |

## Validation Commands

```bash
cd packages/audit && bun test
cd packages/audit && bun run test:coverage:check
bun run validate:audit
bun run audit run renderer,webui,viewer,marketing --probes=static-*
```

## Worklog

`docs/worklog/T138-ticket-gen-and-first-run.md`
