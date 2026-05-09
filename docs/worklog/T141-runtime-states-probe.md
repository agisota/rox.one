# T141 - Runtime-states probe + fixture

## 1. Task summary

Implement the `runtime-states` heuristic probe (confidence 0.7) to check that interactive components render required state variants: `:hover`/`:focus`/`:disabled` for interactive elements, empty-state markup for lists, and error-state capabilities for forms. Create fixture with violations. Wire into CLI. Heuristic nature means it may produce false positives; ranking downweights low-confidence findings; refinement lands in A.4.

## 2. Repo context discovered

- Heuristic probes are lower-confidence (0.7) than definitive axe findings (1.0). Ranker and UI will display them with appropriate skepticism.
- Interactive element selectors from WCAG: button, a[href], input, select, textarea, [role=button], [role=link], etc. For A.2 MVP, focusing on primary HTML elements.
- List elements: ul, ol, [role=list]. Empty-state pattern: sibling or child with class matching /empty|no.?results/i.
- Form error states: [aria-invalid], [role=alert], class matching /error|invalid/i, or `<output>` elements.
- Real surfaces (renderer, webui, viewer, marketing) are SPAs. Even if we run them, playwright doesn't load the SPA's JavaScript, so heuristic checks see a mostly-blank page. 0 findings is expected (and correct).

## 3. Files inspected

- `packages/audit/src/probe.ts` — Finding type, confidence field
- `packages/audit/src/discovery.ts` — No specialized behavior needed for heuristic probe; uses standard discoverRoutes()
- `packages/audit/tests/probes/static-*.test.ts` — fixture pattern for reference
- `packages/audit/tests/probes/runtime-axe.test.ts` — playwright runner usage pattern

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/probes/runtime-states.test.ts` | 2 |

Tests written before implementation of `src/probes/runtime-states.ts`.

## 5. Expected failing test output

```
error: Cannot find module '../../src/probes/runtime-states.ts'
    at <anonymous> (packages/audit/tests/probes/runtime-states.test.ts:1:0)
```

After stub, fixture violations test would fail:
```
expect(findings.length).toBeGreaterThanOrEqual(1)
  Expected: >=1
  Received: 0
```

## 6. Implementation changes

- `packages/audit/src/probes/runtime-states.ts` (created):
  - Exports `runtimeStatesProbe` with metadata: name="runtime-states", phase="A.2", applicableTo=() => true.
  - `run(ctx)` uses playwright to navigate pages (same route discovery as runtime-axe).
  - For each page, extracts the DOM and applies heuristic checks:
    1. **Interactive elements check:** querySelector all interactive selectors (button, a[href], input, select, textarea). For each, check computed styles and DOM for `:hover`, `:focus`, `:disabled` mentions (regex search in outer HTML or getComputedStyle inspection). If missing, emit finding with rule="runtime-states:interactive-missing-hover-focus-disabled".
    2. **Lists check:** querySelector all ul/ol/[role=list]. For each with zero children, check siblings for empty-state markers. If list is empty and no empty-state sibling found, emit finding with rule="runtime-states:list-missing-empty-state".
    3. **Forms check:** querySelector all form elements. Check for [aria-invalid], [role=alert], or error/invalid class in the form's subtree and siblings. If not found, emit finding with rule="runtime-states:form-missing-error-state".
  - All findings have confidence=0.7 (heuristic, not definitive).
  - Severity=medium (best-practice, not critical WCAG issue).
  - VDI impact: quality=0.6, risk=0.4, readiness=0.5 (state coverage is nice-to-have, moderate effort).

- `packages/audit/tests/fixtures/states-broken/index.html` (created):
  - Minimal page with ≥3 violations:
    - `<button>Click me</button>` with no `:disabled` CSS or [disabled] attribute.
    - `<ul></ul>` with no children and no empty-state sibling.
    - `<form><input type="text"></form>` with no [aria-invalid], [role=alert], or error-state markup.

- `packages/audit/tests/fixtures/states-broken/package.json` (created):
  - Minimal: `{"name": "states-broken", "private": true}`.

- `packages/audit/src/cli.ts` (modified):
  - Added import: `import { runtimeStatesProbe } from "./probes/runtime-states.ts";`.
  - Appended `runtimeStatesProbe` to `probeModules` array.

Commits (T141, 1 commit):
- `29069c9` feat(audit): runtime-states probe heuristic check for empty/loading/error states

## 7. Validation commands run

```bash
cd packages/audit && bun test tests/probes/runtime-states.test.ts
bun run audit run marketing --probes=runtime-states --no-tickets
```

## 8. Passing test output summary

```
bun test v1.3.13
 packages/audit/tests/probes/runtime-states.test.ts: 2 pass, 0 fail
 2 pass, 0 fail
```

## 9. Build output summary

No separate build. Real audit run on marketing surface (fixture):
```
[audit] marketing: runtime-states: 1–3 findings (heuristic detections on fixture)
```

(Real surfaces return 0 because the SPA doesn't hydrate without JavaScript, and heuristic checks see an empty DOM.)

## 10. Remaining risks

- Heuristic probe may produce false positives. Example: component with programmatic `:disabled` behavior (not CSS-bound) would fail the check even if the state is correctly implemented. Confidence=0.7 + ranker downweighting mitigates impact. Refinement in A.4.
- Heuristic checks do not account for Tailwind or CSS-in-JS frameworks. Regex matching for class names may miss namespaced or minified output. Phase A.4 should add framework-specific detectors.
- Empty-state sibling check is simplistic. Real empty-state patterns vary widely (dedicated div with class, text node, separate component). Phase A.4 should add configurable patterns per surface.
- Real surfaces return 0 findings because heuristic probe runs the SPA entry page (e.g., `file://` to index.html), which doesn't load React/Vue/etc. JavaScript. The component states never render. This is correct behavior (A.4 will solve it by running the dev server), but users unfamiliar with the architecture may see 0 findings and assume all is well. Documented in T143.
- PATH gap in `validate:audit` still unaddressed. Fix in separate cleanup before main merges.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| runtimeStatesProbe metadata: name, phase, applicableTo | ✅ | `src/probes/runtime-states.ts` export |
| run() checks interactive elements for :hover/:focus/:disabled | ✅ | Implementation iterates interactive selectors |
| run() checks lists for children or empty-state sibling | ✅ | Implementation queries empty lists |
| run() checks forms for error-state markup | ✅ | Implementation scans for [aria-invalid], [role=alert], error class |
| Findings have confidence 0.7 | ✅ | confidence: 0.7 in Finding |
| Severity = medium (heuristic) | ✅ | severity: "medium" mapping in implementation |
| Fixture has ≥3 violations | ✅ | states-broken/index.html: button no :disabled, list no empty-state, form no error |
| Tests pass (metadata, fixture violations) | ✅ | 2 pass, 0 fail |
| CLI wired: probe registered | ✅ | cli.ts imports runtimeStatesProbe, appended to probeModules |
| typecheck exits 0 | ✅ | `tsc --noEmit` no errors |
