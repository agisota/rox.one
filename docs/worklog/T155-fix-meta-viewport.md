# T155 - Fix webui meta-viewport (WCAG 2.2 1.4.4)

## 1. Task summary

Remove `maximum-scale=1.0` and `user-scalable=no` from `apps/webui/src/index.html` viewport meta tag. Both attributes prevent browser pinch-to-zoom, violating WCAG 2.2 SC 1.4.4 (Resize Text, Level AA). Add a regression test asserting these strings are absent. Confirm `runtime-axe` probe no longer emits this finding.

## 2. Repo context discovered

- `apps/webui/src/index.html` line 5 (before fix):
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  ```
- No existing test directory in `apps/webui/` — created `apps/webui/tests/`.
- `apps/webui/package.json`: has `"typecheck"` script but no explicit test runner config. Bun's built-in test runner (`bun test`) works without config — picks up `*.test.ts` files.
- `packages/audit/src/probes/runtime-axe.ts`: spawns a dev server and runs axe-core via Playwright. The `meta-viewport` axe rule fires when `user-scalable=no` is present. After removal, this rule no longer fires.
- `import.meta.dir` resolves to the test file's directory at runtime — used to construct the path to `../src/index.html`.

## 3. Files inspected

- `apps/webui/src/index.html`
- `apps/webui/package.json`
- `packages/audit/src/probes/runtime-axe.ts`
- `docs/worklog/T151-first-a3-audit-run.md` — worklog format reference

## 4. Tests added first

`apps/webui/tests/index-html.test.ts`:
```typescript
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const INDEX = join(import.meta.dir, "..", "src", "index.html");

describe("apps/webui index.html", () => {
  test("meta-viewport allows pinch-to-zoom (WCAG 2.2 1.4.4)", () => {
    const html = readFileSync(INDEX, "utf-8");
    expect(html).not.toContain("user-scalable=no");
    expect(html).not.toContain("maximum-scale=1.0");
  });
});
```

Before fix: test would fail (both strings present). After fix: test passes.

## 5. Expected failing test output

```
# Before fix (strings present):
expect(html).not.toContain("user-scalable=no")  → FAIL
expect(html).not.toContain("maximum-scale=1.0") → FAIL
```

## 6. Implementation changes

`apps/webui/src/index.html` (modified, line 5):

Before:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

After:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

`apps/webui/tests/index-html.test.ts` (created): regression test asserting absence of zoom-blocking attributes.

Commits (T155, 1 commit):
- `d565232` — fix(webui): allow pinch-to-zoom (WCAG 2.2 1.4.4) [T155]

## 7. Validation commands run

```bash
# Test
cd apps/webui && bun test tests/index-html.test.ts
# → 1 pass, 0 fail

# runtime-axe probe
bun run packages/audit/src/cli.ts run webui --probes=runtime-axe --no-tickets --out=/tmp/d-after
# → audit run complete: 0 findings, 6964ms
python3 -c "import json; d=json.load(open('/tmp/d-after/queue.json')); print('findingCount:', d['findingCount'])"
# → findingCount: 0
```

## 8. Passing test output summary

```
bun test v1.3.13 (bf2e2cec)
 1 pass
 0 fail
 2 expect() calls
Ran 1 test across 1 file. [20.00ms]
```

runtime-axe audit:
```
audit run complete: 0 findings, 6964ms
  /tmp/d-after/queue.json
  /tmp/d-after/queue.md
findingCount: 0
```

## 9. Build output summary

No build step needed — test reads source HTML directly; audit probe spawns a Vite dev server internally.

## 10. Remaining risks

- **Mobile layout assumption**: the original viewport meta disabled zoom (common pattern in PWA/app-like UIs to prevent accidental pinch). Removing `user-scalable=no` restores browser-default zoom — this is the correct WCAG behaviour. If any mobile layout depends on fixed viewport scale (e.g. canvas-based features, map views), a design review is recommended. No layout tests currently exist for mobile breakpoints.
- **viewport-fit=cover retained**: kept for iPhone notch/safe-area support — this attribute is WCAG-neutral.
- **`maximum-scale` without `user-scalable`**: removing both is sufficient. Some browsers (Safari iOS) ignored `user-scalable=no` starting iOS 10; removing it aligns behaviour across all browsers.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| `user-scalable=no` removed from index.html | ✅ | `apps/webui/src/index.html` line 5 |
| `maximum-scale=1.0` removed from index.html | ✅ | `apps/webui/src/index.html` line 5 |
| `apps/webui/tests/index-html.test.ts` added | ✅ | 1 pass, 0 fail |
| `runtime-axe` probe → `findingCount: 0` | ✅ | 0 findings, meta-viewport not in list |
| Commit created | ✅ | `d565232` |
