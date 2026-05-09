# T148 - First A.4 audit run + INDEX row

Status: complete

## Context

Phase A.4 of the audit harness. Execute the first live audit run using the route crawler against the three user-facing SPAs (webui, viewer, marketing), record findings, and append an INDEX row documenting the run.

## Summary

Run `bun run packages/audit/src/cli.ts run webui viewer marketing --probes=runtime-axe --out=audits/2026-05-09T_a4-first` to spawn three Vite dev servers, crawl routes on each, probe with axe-core, collect findings, and write queue.json. Discovered 1 critical finding (`axe:meta-viewport` on webui's `<meta name="viewport" content="...user-scalable=no">` — WCAG 2.2 violation). Viewer and marketing passed axe on tested routes. Append row to `docs/audits/INDEX.md` with timestamp, probes, surfaces, finding counts, queue path, and ticket notes.

## Acceptance Criteria

- [x] Audit CLI command completes successfully across webui, viewer, marketing with runtime-axe probe.
- [x] Dev servers spawn in parallel; all 3 running concurrently (no sequential boot).
- [x] Routes discovered via crawlRoutes on each surface: webui (multiple routes); viewer (entry `/s/`); marketing (landing pages).
- [x] Findings produced: 1 critical (`axe:meta-viewport` on webui).
- [x] Findings have populated `location.route` field (route is known).
- [x] Queue.json written to `audits/2026-05-09T_a4-first/queue.json` with valid format.
- [x] Audit run duration: ~5-6 seconds end-to-end (fixture boot ~30s in beforeAll, reused across routes; subsequent probing is fast).
- [x] `docs/audits/INDEX.md` appended with row: timestamp `2026-05-09T_a4-first`, probes `runtime-axe`, surfaces `webui,viewer,marketing`, findings count `1`, critical `1`, high `0`, medium `0`, low `0`, queue path, ticket notes (0 tickets created; route crawler made discovery possible; webui meta-viewport defect identified for remediation).
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T148-first-a4-audit-run.md` complete.
- [x] Commit created.

## Validation Commands

```bash
cd packages/audit && bun run typecheck
~/.bun/bin/bun run packages/audit/src/cli.ts run webui viewer marketing --probes=runtime-axe --no-tickets --out=audits/2026-05-09T_a4-first
cat audits/2026-05-09T_a4-first/queue.json | jq '.[] | select(.severity == "critical") | .ruleId'
cat docs/audits/INDEX.md | tail -1
```

## Worklog

`docs/worklog/T148-first-a4-audit-run.md`
