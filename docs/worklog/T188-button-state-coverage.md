# T188 - button.tsx State Coverage

## 1. Task summary

Write `button.rtl.test.tsx` covering all 6 CVA variants, 4 sizes, disabled state (attribute + onClick suppression), keyboard focus + Enter/Space/click activation, `asChild` rendering, and 3 axe a11y assertions. 21 tests total.

## 2. Repo context discovered

- `button.tsx` is a thin CVA wrapper: `buttonVariants` defines 6 variant + 4 size combos; the component renders either a native `<button>` or, when `asChild` is true, delegates to a Radix `Slot` that renders the first child element in place.
- No `loading` or `isLoading` prop exists in the current CVA definition. If a future ticket adds one, T188 needs extension (noted as a known gap).
- The Radix Slot (`asChild`) pattern means `container.querySelector('button')` returns null when `asChild` is set; the `<a>` or other child element is the actual rendered node.
- `afterEach(cleanup)` is required. RTL's global cleanup hook is not enabled by default in Vitest (no `globals: true` in this config); each test leaves its rendered tree in `document.body`. Without explicit cleanup, queries like `getByRole('button')` match multiple nodes across tests.
- Three axe assertion paths cover: (1) a labeled button, (2) an icon-only button with `aria-label` (the common icon button pattern used throughout the composer), (3) a destructive variant. The `asChild` path is not separately axe-tested because the `<a>` child would require an `href` to avoid an axe `anchor-has-content` rule, adding noise beyond the scope.
- `userEvent.setup()` is used (not the legacy `userEvent.type`/`userEvent.click` top-level calls) to correctly simulate pointer events and keyboard focus traversal.

## 3. Files inspected

- `apps/electron/src/renderer/components/ui/button.tsx` — full review
- `node_modules/@radix-ui/react-slot/` — Slot prop forwarding behavior
- `apps/electron/src/test-utils/render.tsx` — wrapper (T186 harness)
- `apps/electron/src/test-utils/a11y.ts` — `expectNoA11yViolations` (T180 helper)

## 4. Tests added first

Describe/it structure written before assertions to confirm the test shape covered all CVA surface area visible in button.tsx's source.

## 5. Expected failing test output

Before `afterEach(cleanup)` was added:

```text
TestingLibraryElementError: Found multiple elements with the role "button"
  (all previous tests' buttons were still in document.body)
```

## 6. Implementation changes

**`apps/electron/src/renderer/components/ui/__tests__/button.rtl.test.tsx`** (new file, 139 lines)

Structure:

```
describe('Button')
  describe('variants')       — 7 tests (default + 6 named variants via it.each)
  describe('sizes')          — 4 tests via it.each
  describe('disabled state') — 2 tests
  describe('focus + click')  — 4 tests
  describe('asChild prop')   — 1 test
  describe('a11y')           — 3 tests
```

Key implementation notes:
- `it.each([['default'], ['destructive'], ...] as const)` — `as const` assertion required for TypeScript to accept literal variant strings as `ButtonProps['variant']`.
- Disabled-state click test uses `await user.click(...)` (userEvent) rather than `fireEvent.click` because userEvent correctly respects the `disabled` attribute and does not call the handler; `fireEvent.click` bypasses that gate.
- `within(container).getByRole('button')` scoped to the rendered container prevents cross-test bleed even before cleanup runs.
- asChild test confirms `container.querySelector('button')` is null and `container.querySelector('a')` is present with the expected text content.

## 7. Validation commands run

```bash
bun run test:rtl
bun run typecheck:electron
```

## 8. Passing test output summary

```text
bun run test:rtl (button suite only)
 ✓ button.rtl.test.tsx > Button > variants > renders the default variant with text content
 ✓ button.rtl.test.tsx > Button > variants > renders the default variant without errors
 ✓ button.rtl.test.tsx > Button > variants > renders the destructive variant without errors
 ✓ button.rtl.test.tsx > Button > variants > renders the outline variant without errors
 ✓ button.rtl.test.tsx > Button > variants > renders the secondary variant without errors
 ✓ button.rtl.test.tsx > Button > variants > renders the ghost variant without errors
 ✓ button.rtl.test.tsx > Button > variants > renders the link variant without errors
 ✓ button.rtl.test.tsx > Button > sizes > renders the default size without errors
 ✓ button.rtl.test.tsx > Button > sizes > renders the sm size without errors
 ✓ button.rtl.test.tsx > Button > sizes > renders the lg size without errors
 ✓ button.rtl.test.tsx > Button > sizes > renders the icon size without errors
 ✓ button.rtl.test.tsx > Button > disabled state > sets disabled attribute when disabled prop is passed
 ✓ button.rtl.test.tsx > Button > disabled state > does not call onClick when disabled
 ✓ button.rtl.test.tsx > Button > focus + click > can be focused via Tab
 ✓ button.rtl.test.tsx > Button > focus + click > fires onClick on Enter when focused
 ✓ button.rtl.test.tsx > Button > focus + click > fires onClick on Space when focused
 ✓ button.rtl.test.tsx > Button > focus + click > fires onClick on mouse click
 ✓ button.rtl.test.tsx > Button > asChild prop > renders as the child element when asChild is true
 ✓ button.rtl.test.tsx > Button > a11y > has no a11y violations for a labeled button
 ✓ button.rtl.test.tsx > Button > a11y > has no a11y violations for an icon-only button with aria-label
 ✓ button.rtl.test.tsx > Button > a11y > has no a11y violations for destructive variant
Tests  21 passed (21)
```

## 9. Build output summary

No production bundle change.

## 10. Remaining risks

- **No `loading` prop.** Button has no loading/pending state in its current CVA definition. If a future ticket adds `isLoading`, T188 needs to cover the loading button's axe profile (spinner + aria-busy or visually-hidden label). Noted in the test file comment.
- **asChild axe coverage omitted.** The `asChild` branch renders whatever element the child provides. If button is used as `asChild` over an `<a>` without `href`, axe will flag it. This is a consumer responsibility (not a button.tsx responsibility), but worth noting if a future PR wraps a button with asChild over a non-interactive element.
- **Keyboard focus test depends on document focus state.** `await user.tab()` focuses the first focusable element. If a future test file in the same Vitest run renders a focusable element that persists past cleanup, the Tab order could shift. The existing `afterEach(cleanup)` guard is the fence.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `button.rtl.test.tsx` exists | PASS | `apps/electron/src/renderer/components/ui/__tests__/button.rtl.test.tsx` |
| 21 tests covering variants, sizes, disabled, focus/click, asChild, a11y | PASS | Test output: 21 passed |
| All tests pass under `bun run test:rtl` | PASS | `f4b5f13` green |
| Typecheck passes | PASS | `bun run typecheck:electron` |
| Commit created | PASS | `f4b5f13` — `test(composer): RTL coverage for button.tsx states + a11y [T188]` |
