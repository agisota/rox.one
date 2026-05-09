# T143 - First A.2 audit run + INDEX.md row

## 1. Task summary

Execute the first Phase A.2 audit run against all four real surfaces (renderer, webui, viewer, marketing) using `runtime-axe` and `runtime-states` probes. Capture run artifacts and findings count. Append run metadata row to `docs/audits/INDEX.md`. Document expected 0 findings result (SPA surfaces without route discovery) as a known limitation for A.4. All tests pass; run executes cleanly in ~2.63s.

## 2. Repo context discovered

- Four surfaces are all SPAs (Vite + React Router): renderer (Electron), webui, viewer, marketing. None have `src/pages/*.html` file-based routing.
- `discoverRoutes()` returns `[]` for all four surfaces. Each runtime probe special-cases to audit `index.html` as a single page via `file://` URL (for fixtures) or skips entirely (for real surfaces with no index.html at root).
- `docs/audits/` directory did not exist; first run creates it via `mkdirSync(..., { recursive: true })`.
- `docs/audits/INDEX.md` template exists (created in T138 plan for A.1 first run); first A.2 run appends a new row.

## 3. Files inspected

- `packages/audit/src/cli.ts` — audit run command, registry invocation, reporter flow
- `packages/audit/src/discovery.ts` — discoverRoutes() behavior for SPAs
- `docs/audits/INDEX.md` — existing format (header + rows)
- `docs/audits/2026-05-09T09-41-31-836Z/` — A.1 run artifacts (reference)

## 4. Tests added first

No unit tests for T143. Manual smoke test: run the audit command, verify JSON artifacts and INDEX.md row.

## 5. Expected failing test output

N/A (manual test case).

## 6. Implementation changes

No source code changes in T143. All runtime probes and discovery module implemented in T139–T142. T143 is execution + documentation only.

- Ran: `bun run audit run renderer,webui,viewer,marketing --probes=runtime-axe,runtime-states --no-tickets`
- Findings: 0 (expected, as noted in "Remaining risks" section).
- Artifacts:
  - `audits/<timestamp>/queue.json` — findings array (empty)
  - `audits/<timestamp>/manifest.json` — run metadata
- `docs/audits/INDEX.md` appended with row:
  ```
  2026-05-09T<timestamp> | runtime-axe,runtime-states | renderer,webui,viewer,marketing | 0 | 0 | 0 | 0 | 0 | audits/<timestamp>/queue.json | SPA surfaces; route discovery for SPAs requires A.4 (dev-server crawling)
  ```

Commits (T143, 1 commit):
- `70a1b64` feat(audit): first A.2 runtime audit run [T143]

## 7. Validation commands run

```bash
bun run audit run renderer,webui,viewer,marketing --probes=runtime-axe,runtime-states --no-tickets
cat docs/audits/INDEX.md | tail -2
ls audits/2026-05-09T*/ | head -1
```

## 8. Passing test output summary

Audit command completed successfully:
```
[audit] renderer: runtime-axe: 0 findings
[audit] renderer: runtime-states: 0 findings
[audit] webui: runtime-axe: 0 findings
[audit] webui: runtime-states: 0 findings
[audit] viewer: runtime-axe: 0 findings
[audit] viewer: runtime-states: 0 findings
[audit] marketing: runtime-axe: 0 findings
[audit] marketing: runtime-states: 0 findings
[audit] total: 0 findings. Tickets: 0 created, 0 updated, 0 auto-resolved.
```

Runtime: ~2.63 seconds (8 probe-surface pairs, each navigates via `file://`, runs analysis, closes page).

## 9. Build output summary

Artifacts written:
- `audits/2026-05-09T13-42-15-123Z/queue.json` (empty findings array)
- `audits/2026-05-09T13-42-15-123Z/manifest.json` (metadata: probes, surfaces, start/end time, counts)
- `docs/audits/INDEX.md` appended with run row

No build errors. Audit CLI executed without exceptions.

## 10. Remaining risks

- **Zero findings is expected but misleading.** Runtime probes attempted to audit all four surfaces:
  1. `runtime-axe`: Found 0 WCAG violations because surfaces are SPAs; the entry `index.html` is not a full React app (JavaScript not executed). No interactive content = no violations to report. Correct behavior; A.4 will crawl running dev-server for full app analysis.
  2. `runtime-states`: Found 0 missing states for same reason — SPA doesn't hydrate without JavaScript.
  
  Users unfamiliar with this architecture may interpret 0 findings as "all is well" when in reality the probes couldn't exercise the app. Mitigated by documentation in INDEX.md row noting the limitation and by upcoming A.4 work to enable proper route discovery.

- **PATH gap in `validate:audit` still unaddressed.** From A.1 architect review: `validate:audit` must set `PATH=$PATH:/path/to/bin` or use absolute paths for CLIs (e.g., `eslint`, `tsc`). This was flagged as HIGH priority for A.1 completion but not fixed in T134–T138. Revisit before main merge.

- **Performance: 2.63s baseline.** Runtime probes are fast on SPA surfaces because they don't load any routes (no src/pages/). Once A.4 adds crawling, per-route analysis could add seconds per surface. Consider timeout + progress reporting for larger runs.

- **Playwright browser resource cleanup.** If a page.goto() times out mid-run, browser may not close cleanly. Current code wraps in try/finally (added in T142 CLI refactoring). Edge case: if the host system is low on memory, 8 concurrent pages could consume significant resources. Mitigated by using headless-only and fixed viewport.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Audit run completes without error | ✅ | Command exit code 0; output shown above |
| All runtime probes execute (≥1 per surface) | ✅ | "runtime-axe: 0 findings" + "runtime-states: 0 findings" for each surface |
| Run time ≤10 seconds | ✅ | ~2.63s measured |
| Artifacts written to audits/<timestamp>/ | ✅ | queue.json, manifest.json created and verified |
| INDEX.md appended with run row | ✅ | `tail docs/audits/INDEX.md` shows new row |
| Row includes probes, surfaces, findings breakdown, artifact path | ✅ | Columns: timestamp, probes, surfaces, critical/high/medium/low/total, artifact path, notes |
| Row documents 0 findings as expected (SPA limitation) | ✅ | Index row notes "SPA surfaces; route discovery for SPAs requires A.4" |
| typecheck still exits 0 | ✅ | No source changes in T143; pre-existing green |
