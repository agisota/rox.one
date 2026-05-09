# T143 - First A.2 audit run + INDEX.md row

Status: complete

## Context

Phase A.2 runtime probes (T139–T142) are now ready. Execute the first A.2 audit run against all four real surfaces with `--probes=runtime-*`. Capture findings, append a row to `docs/audits/INDEX.md`, and document expected zero-findings result for SPA surfaces without route discovery.

## Summary

Run `bun run audit run renderer,webui,viewer,marketing --probes=runtime-axe,runtime-states --no-tickets` to test A.2 runtime probes on real surfaces. For each surface, runtime probes attempt to discover routes; SPAs return empty route lists because they have no `src/pages/*.html`. Audit completes in ~2.63s with 0 findings (expected for SPA surfaces without route discovery — A.4 task). Append INDEX.md row with run timestamp, probes, surfaces, and findings count. Document limitation: route discovery for SPAs requires running the dev server and crawling (A.4 scope).

## Acceptance Criteria

- [x] `bun run audit run renderer,webui,viewer,marketing --probes=runtime-axe,runtime-states --no-tickets` completes without error.
- [x] All runtime probes execute and return findings arrays (may be empty for SPA surfaces).
- [x] Run takes ≤10 seconds (expected ~2.63s for skipping SPA routes).
- [x] Audit artifacts written to `audits/<timestamp>/queue.json` and `manifest.json`.
- [x] `docs/audits/INDEX.md` appended with run row: timestamp, probes, surfaces, findings breakdown, artifact path.
- [x] INDEX.md row documents 0 findings as "expected for SPA surfaces without route discovery".
- [x] Worklog `docs/worklog/T143-first-a2-run.md` complete with section 10 risk documenting known limitation.
- [x] Commit created.

## TDD Test Shape

No unit tests. Manual smoke test: audit run completes, produces valid JSON artifacts, INDEX.md row appended.

## Files Affected

| File | Action |
|---|---|
| `docs/audits/INDEX.md` | Modify — append first A.2 run row |

## Validation Commands

```bash
bun run audit run renderer,webui,viewer,marketing --probes=runtime-axe,runtime-states --no-tickets
cat docs/audits/INDEX.md | tail -1
```

## Worklog

`docs/worklog/T143-first-a2-run.md`
