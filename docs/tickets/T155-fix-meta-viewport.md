# T155 - Fix webui meta-viewport (WCAG 2.2 1.4.4)

Status: done

## Context

Sub-project D. The A.4 first audit run surfaced a real WCAG violation: `apps/webui/src/index.html` contains `maximum-scale=1.0, user-scalable=no` in the viewport meta tag. Both attributes prevent the browser's pinch-to-zoom gesture, violating WCAG 2.2 Success Criterion 1.4.4 (Resize Text, Level AA) which requires that text can be resized up to 200% without loss of content or functionality.

## Goal

1. Remove `maximum-scale=1.0` and `user-scalable=no` from the viewport meta in `apps/webui/src/index.html`.
2. Add a regression test (`apps/webui/tests/index-html.test.ts`) asserting those strings are absent.
3. Confirm the `runtime-axe` probe no longer emits a meta-viewport finding.

## Required UI

None — change is to the HTML shell; no visual layout change expected for most users. Mobile users regain zoom capability.

## Required Data/API

None.

## Required Automations

Runtime-axe probe (`packages/audit/src/probes/runtime-axe.ts`) will no longer flag this route after the fix, so future audit runs automatically reflect the fix.

## Required Subagents

None.

## TDD Requirements

1. Write `apps/webui/tests/index-html.test.ts` asserting `user-scalable=no` and `maximum-scale=1.0` are absent from `src/index.html`.
2. Confirm test fails before fix (these strings ARE present in original).
3. Apply fix, confirm test passes.

## Implementation Requirements

Edit `apps/webui/src/index.html` line 5:

Before:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

After:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

## Validation Commands

```bash
cd apps/webui && bun test tests/index-html.test.ts
bun run packages/audit/src/cli.ts run webui --probes=runtime-axe --no-tickets --out=/tmp/d-after
python3 -c "import json; d=json.load(open('/tmp/d-after/queue.json')); print('findingCount:', d['findingCount']); print([f['rule'] for f in d.get('findings',[])])"
```

## Acceptance Criteria

- [x] `apps/webui/src/index.html` viewport meta no longer contains `user-scalable=no`
- [x] `apps/webui/src/index.html` viewport meta no longer contains `maximum-scale=1.0`
- [x] `apps/webui/tests/index-html.test.ts` added — 1 pass, 0 fail
- [x] `runtime-axe` probe run → `findingCount: 0` (meta-viewport not in findings)
- [x] Worklog complete
- [x] Commit created

## Worklog

`docs/worklog/T155-fix-meta-viewport.md`
