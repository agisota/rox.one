# T156 - static-bundle probe: glob-pattern budgets (hash-drift fix)

Status: done

## Context

Sub-project D architect review. `apps/webui/budget.json` used exact
content-hashed chunk names like `"assets/main-CzWr7TDn.js"`. Vite
re-hashes on rebuild, producing `main-XXXXXXXX.js`. The probe's
`existsSync` returned false for the old hash → 0 findings → vacuous
pass. Same risk for viewer and marketing.

## Goal

Modify `packages/audit/src/probes/static-bundle.ts` to support glob
patterns (e.g. `"assets/main-*.js"`) in budget.json. The probe expands
each pattern against the real dist files, picks the largest match, and
compares it to the budget. Exact-filename keys (no `*`) continue to work
unchanged for backward compatibility (electron's `main.js` budget).

Stale globs (pattern matches zero files) emit a
`_probe.bundle.budget-stale` finding with `confidence: 0` so the gate
fails visibly rather than silently passing.

## Required UI

None.

## Required Data/API

Updated budget.json format (backward compatible):

```json
{ "assets/main-*.js": 5793531 }
```

## Required Automations

- `validate:audit` (`bash scripts/audit-smoke.sh`) picks up the change
  automatically.

## TDD Requirements

Add unit tests for:
1. Glob matches hashed chunk, under budget → 0 findings.
2. Glob matches hashed chunk, over budget → over-budget finding.
3. Stale glob (no match) → budget-stale finding, confidence 0.
4. Exact filename key, no match → silently skipped (backward compat).

## Implementation Requirements

- Add `expandPattern(distRoot, pattern)` helper: splits at last `/`,
  converts `*` → `[^/]*` regex, reads the directory, filters matches.
- If pattern has no `*`: exact-match fallback (original logic).
- If glob matches nothing: emit `_probe.bundle.budget-stale` zero-confidence finding.
- If glob matches 1+: pick largest by byte size, compare to budget.

## Validation Commands

```bash
cd packages/audit && ~/.bun/bin/bun test tests/probes/static-bundle.test.ts
bash scripts/audit-smoke.sh --skip-build   # 0 findings, exit 0
# Regression: stale glob → exit 1
# Regression: halved budget → exit 1
```

## Acceptance Criteria

- [x] Glob patterns expand against real dist files
- [x] Largest match compared to budget
- [x] Stale glob emits budget-stale finding (confidence 0)
- [x] Exact-filename keys still work (backward compat)
- [x] All 9 unit tests pass
- [x] budget.json files updated for webui, viewer, marketing
- [x] electron budget.json left as exact filename (no glob needed)
- [x] Worklog complete
- [x] Commit created

## Worklog

`docs/worklog/T156-T158-d-followup-architect-fixes.md`
