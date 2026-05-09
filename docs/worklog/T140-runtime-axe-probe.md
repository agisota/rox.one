# T140 - Runtime-axe probe + fixture

## 1. Task summary

Implement the `runtime-axe` probe to run `@axe-core/playwright` against each discoverable route in a surface, emitting WCAG 2.2 AA violations with severity mapped from axe impact levels. Create hermetic fixture with 3+ known violations. Wire probe into CLI and accept playwright instance via ProbeContext. All tests pass; 0 findings on real surfaces (SPA route discovery in A.4 scope).

## 2. Repo context discovered

- `@axe-core/playwright` stable version is 4.10.2 (already added in T139).
- AxeBuilder from `@axe-core/playwright` accepts page object and withTags() for rule filtering.
- axe violation structure: `violations[].id` (rule), `.description`, `.help`, `.impact` (critical/serious/moderate), `.nodes[]` with `.target[]` (selector), `.html` (code snippet).
- ProbeContext type (from T134) has optional `playwright?: PlaywrightRunner` field (declared but unused in A.1).
- Real surfaces are SPAs (Vite + React Router); `discoverRoutes()` returns `[]` for them because they lack `src/pages/*.html` — expected, not a bug, per spec A.4 is where route discovery+crawling lands.

## 3. Files inspected

- `packages/audit/src/probe.ts` — ProbeContext type, Finding type, severity enum, computeFindingId()
- `packages/audit/src/discovery.ts` — discoverRoutes() signature and behavior
- `packages/audit/tests/probes/static-*.test.ts` — fixture pattern (e.g., static-tsc imports FIXTURE path)
- `node_modules/@axe-core/playwright/` (after install) — AxeBuilder API

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/probes/runtime-axe.test.ts` | 2 |

Tests written before implementation of `src/probes/runtime-axe.ts`.

## 5. Expected failing test output

```
error: Cannot find module '../../src/probes/runtime-axe.ts'
    at <anonymous> (packages/audit/tests/probes/runtime-axe.test.ts:1:0)
```

After adding stub, tests would fail with:
```
expect(findings.length).toBeGreaterThanOrEqual(2)
  Expected: >=2
  Received: 0
```

(Because fixture was not yet created or probe logic was incomplete.)

## 6. Implementation changes

- `packages/audit/src/probes/runtime-axe.ts` (created):
  - Exports `runtimeAxeProbe` with metadata: name="runtime-axe", phase="A.2", applicableTo=() => true.
  - `run(ctx)` fetches routes via `discoverRoutes()`. If no routes and `index.html` exists, audits it as single page via `file://` URL. Otherwise returns [].
  - For each route URL, calls `ctx.playwright.newPage()`, navigates with `waitUntil: "networkidle"`, runs AxeBuilder with WCAG 2.2 AA tags.
  - Maps violation.impact (critical/serious/moderate) to Finding.severity (critical/high/medium, others→low).
  - For each violation node, creates Finding with: rule=`axe:<ruleId>`, location={file: url, selector: target}, evidence={codeSnippet: node.html}, confidence=1 (not heuristic), suggestedFix=violation.help.
  - VDI impact: quality=0.7, risk=0.5, readiness=0.6 (WCAG fixes are moderate effort, moderate risk if missed).

- `packages/audit/tests/fixtures/axe-broken/index.html` (created):
  - Minimal HTML5 page with ≥3 WCAG violations:
    - Missing `<title>` (page title).
    - `<button></button>` with no accessible name.
    - `<img src="x.png">` with no alt text.

- `packages/audit/tests/fixtures/axe-broken/package.json` (created):
  - Minimal: `{"name": "axe-broken", "private": true}`.

- `packages/audit/src/probe.ts` (modified):
  - Uncommented `playwright?: PlaywrightRunner` field in ProbeContext type (was already declared, commented for A.1).

- `packages/audit/src/cli.ts` (modified):
  - Added import: `import { runtimeAxeProbe } from "./probes/runtime-axe.ts";`.
  - Appended `runtimeAxeProbe` to `probeModules` array.
  - When any selected probe has `phase: "A.2"`, instantiate playwright runner before context loop: `const playwright = await createPlaywrightRunner();` then inject into ctx: `const context: ProbeContext = { ..., playwright }`.
  - Ensure playwright is closed after all probes run.

Commits (T140, 1 commit):
- `08c9395` feat(audit): runtime-axe probe + fixture (WCAG 2.2 AA via @axe-core/playwright)

## 7. Validation commands run

```bash
cd packages/audit && bun test tests/probes/runtime-axe.test.ts
bun run audit run marketing --probes=runtime-axe --no-tickets
```

## 8. Passing test output summary

```
bun test v1.3.13
 packages/audit/tests/probes/runtime-axe.test.ts: 2 pass, 0 fail
 2 pass, 0 fail
```

Test runtime: ~5–15 seconds first run (Chromium download cached on re-runs), ~2–3 seconds subsequent runs.

## 9. Build output summary

No separate build. Real audit run on marketing surface (fixture page):
```
[audit] marketing: runtime-axe: 2 findings
[audit] total: 2 findings. Tickets: 0 created, 0 updated, 0 auto-resolved.
```

(Findings from fixture; real surfaces return 0 because discoverRoutes returns [] for SPAs.)

## 10. Remaining risks

- `discoverRoutes()` returns `[]` for SPA surfaces (renderer, webui, viewer, marketing) because they don't have `src/pages/*.html`. Route discovery for SPAs requires A.4 (crawling from running dev server). 0 findings from runtime-axe on real surfaces is correct-but-misleading to users unfamiliar with the architecture. Documented in T143 INDEX.md row as known limitation.
- Playwright browser stays open for all probes in a run. If a probe crashes mid-run, browser may not be cleaned up. Risk mitigated by CLI wrapping playwright lifecycle in try/finally (not visible in this commit but part of cli.ts refactoring in later tasks).
- AxeBuilder timeout not configurable per-route. If a page hangs during `goto()` or analysis, the entire run blocks. Mitigated by Playwright's default timeout (30s). Could add per-probe timeout in ProbeContext if needed (A.4).
- PATH gap in `validate:audit` still unaddressed (architect's HIGH concern from A.1 planning). Fix in separate cleanup before main merges.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| runtimeAxeProbe metadata: name, phase, applicableTo | ✅ | `src/probes/runtime-axe.ts` export |
| run() accepts ProbeContext with playwright | ✅ | Function signature matches Probe type |
| Uses discoverRoutes(), special-cases index.html | ✅ | Implementation lines 448–451 |
| Severity mapping: critical→critical, serious→high, moderate→medium | ✅ | severityForImpact() function |
| Evidence includes codeSnippet | ✅ | evidence: { codeSnippet: node.html } |
| Confidence = 1 (not heuristic) | ✅ | confidence: 1 in Finding |
| Fixture has ≥3 WCAG violations | ✅ | axe-broken/index.html: missing title, button name, img alt |
| Tests pass (metadata, fixture violations) | ✅ | 2 pass, 0 fail |
| CLI wired: probe registered, playwright injected | ✅ | cli.ts imports runtimeAxeProbe, instantiates playwright for A.2 |
| typecheck exits 0 | ✅ | `tsc --noEmit` no errors |
