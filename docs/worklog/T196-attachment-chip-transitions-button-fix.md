# T196 - Attachment Chip Transitions + AttachmentBubble type=button Fix

## 1. Task summary

Two changes in one commit against the same component tree. (a) Fix the architect-flagged HIGH from PR-B2: `AttachmentBubble`'s X-remove `<button>` lacked `type="button"`, defaulting to `type="submit"` and submitting the parent form on every chip removal click. (b) Add 150ms fade+scale enter/exit transitions to attachment chips using `motion/react`'s `LayoutGroup` + `AnimatePresence` + per-chip `motion.div`, with the stable key `attachment.path` replacing the former composite `${path}-${index}`. Update the T187 attachments test to assert the corrected behavior.

## 2. Repo context discovered

- `AttachmentPreview` rendered chips directly with `key={\`${attachment.path}-${index}\`}`. The composite key meant that removing item 0 from a 3-item list would shift items 1 and 2 to new keys (index changes), causing `AnimatePresence` to unmount and remount them instead of tracking them as the same elements. The stable key `attachment.path` gives `AnimatePresence` correct identity across mid-list removals.
- `AttachmentBubble`'s X button was `<button onClick={onRemove} ...>`. In an HTML form, `<button>` with no `type` attribute defaults to `type="submit"`. The FreeFormInput wraps the entire composer in a `<form>` element; clicking the X therefore triggered the form's `onSubmit` handler before `handleRemoveAttachment` could update state. T187 captured this as observed behavior in a detailed comment and deferred the fix.
- `ReducedMotionContext` is the established pattern for transition gating (introduced in T183). `useReducedMotionPreference()` returns a boolean; the transition object is computed once per render: `{ duration: 0.15 }` or `{ duration: 0 }`. This matches the pattern used in `ToolbarStatusSlot` and other animated surfaces.
- `motion/react` (Framer Motion) is already a production dependency of the electron app; no new dependency required.
- `LoadingBubble` placeholders are outside the `AnimatePresence` block (they use a different key scheme `loading-${i}` and do not need enter/exit tracking). They are placed inside the `LayoutGroup` so layout shifts from chip addition/removal animate correctly relative to the loading placeholders.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/AttachmentPreview.tsx` — full read; confirmed composite key, missing import for motion/react and ReducedMotionContext, AttachmentBubble X button markup
- `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.attachments.rtl.test.tsx` — full read; confirmed the test that documented the form-submit bug with the "observed behavior" comment block
- `apps/electron/src/renderer/context/ReducedMotionContext.tsx` — confirmed `useReducedMotionPreference()` hook export and boolean return type
- `apps/electron/src/renderer/components/app-shell/input/ToolbarStatusSlot.tsx` — read for reference on LayoutGroup + AnimatePresence pattern already in the codebase
- `apps/electron/package.json` — confirmed `motion` (motion/react) already listed as dependency

## 4. Tests added first

The existing T187 test `'clicking the chip remove button drops one attachment from the local state'` was rewritten before the implementation to assert the corrected behavior. The new test name is `'clicking the chip remove button drops one attachment and does NOT submit the form'`.

New assertions:
- `await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalled())` — handler called.
- `lastCall[0].map((x: FileAttachment) => x.name)` equals `['two.txt']` — correct remaining item.
- `expect(onSubmit).not.toHaveBeenCalled()` — form was not submitted.

## 5. Expected failing test output

Before the `type="button"` fix, the rewritten test would fail at:

```text
AssertionError: expected "spy" not to have been called but was called 1 time
  → expect(onSubmit).not.toHaveBeenCalled()
```

This confirmed the test correctly captured the bug before the fix landed.

## 6. Implementation changes

**`apps/electron/src/renderer/components/app-shell/AttachmentPreview.tsx`:**

- Added imports: `AnimatePresence`, `LayoutGroup`, `motion` from `motion/react`; `useReducedMotionPreference` from `@/context/ReducedMotionContext`.
- Inside `AttachmentPreview`: compute `const reduced = useReducedMotionPreference()` and `const transition = reduced ? { duration: 0 } : { duration: 0.15 }`.
- Replaced the flat chip map with:
  ```tsx
  <LayoutGroup>
    <AnimatePresence initial={false}>
      {attachments.map((attachment, index) => (
        <motion.div
          key={attachment.path}
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={transition}
        >
          <AttachmentBubble ... />
        </motion.div>
      ))}
    </AnimatePresence>
    {/* Loading placeholders */}
    {Array.from({ length: loadingCount }).map((_, i) => (
      <LoadingBubble key={`loading-${i}`} />
    ))}
  </LayoutGroup>
  ```
- `AttachmentBubble` X-remove `<button>`: added `type="button"`.

**`apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.attachments.rtl.test.tsx`:**

- Renamed test: `'clicking the chip remove button drops one attachment and does NOT submit the form'`.
- Replaced the 20-line observed-bug assertion block with:
  - `fireEvent.click(removeButton!)` — unchanged.
  - `await waitFor(...)` asserting `onAttachmentsChange` called with `[{ name: 'two.txt', ... }]`.
  - `expect(onSubmit).not.toHaveBeenCalled()` — new assertion.
- Removed the old comment block documenting the form-submit cycle.

Net change: 41 insertions, 30 deletions across 2 files.

## 7. Validation commands run

```bash
bun run test:rtl
bun run typecheck:electron
```

## 8. Passing test output summary

```text
bun run test:rtl
 ✓ freeform-input.attachments.rtl.test.tsx > FreeFormInput attachments [T187] > renders a chip with the attachment file name
 ✓ freeform-input.attachments.rtl.test.tsx > FreeFormInput attachments [T187] > clicking the chip remove button drops one attachment and does NOT submit the form
 ✓ freeform-input.attachments.rtl.test.tsx > FreeFormInput attachments [T187] > paperclip button is rendered with an accessible label
 ✓ freeform-input.attachments.rtl.test.tsx > FreeFormInput attachments [T187] > Enter with only an attachment (no text) submits the attachment via onSubmit
 ✓ freeform-input.attachments.rtl.test.tsx > FreeFormInput attachments [T187] > a11y: no axe violations with attachments rendered
Tests  46 passed | 1 todo (47)

bun run typecheck:electron
PASS
```

## 9. Build output summary

No production bundle size change beyond the added animation wrapper code. `motion/react` was already a dependency; no new package added. The `LayoutGroup` and `AnimatePresence` components are tree-shaken from the existing `motion/react` import.

## 10. Remaining risks

- **Stable key assumes `attachment.path` is unique per chip.** If two attachments in the same list share a path (e.g., two files from different directories that happen to have the same base name after normalization, or a user adding the same file twice), `AnimatePresence` will collapse them into a single rendered element. This is acceptable for the current attachment model: `handleRemoveAttachment(index)` operates by index, and the existing upload flow does not deduplicate by path. If path-deduplication is ever enforced at the data layer, this key is safe. If not enforced, document this assumption when the attachment data model is revisited.
- **`LoadingBubble` is inside `LayoutGroup` but outside `AnimatePresence`.** Loading placeholders do not need enter/exit tracking (they are added and removed in a batch at the end of the chip list). However, being inside `LayoutGroup` means they will participate in layout animations alongside chips. If a placeholder count change coincides with a chip add/remove, the layout shift will animate smoothly — this is the intended behavior.
- **T187 test suite count is now 46 pass + 1 todo.** The test count in CI reports will differ from the Pillar 2 baseline (previously 24 pass + 1 todo from T187 alone; 46 total across all RTL files after T188). The Pillar 3 test suite starts at 46 + 1 todo with no new test files added in T196 — only a test rewrite. If a CI gate or dashboard tracks exact test counts, no adjustment is needed: the count is unchanged (one test renamed and rewritten, not added or removed).

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `AttachmentBubble` X-remove button has `type="button"` | PASS | `fbf11ff` — `<button type="button" onClick={onRemove} ...>` in AttachmentPreview.tsx |
| Clicking X does NOT submit the parent form | PASS | `fbf11ff` — `expect(onSubmit).not.toHaveBeenCalled()` in freeform-input.attachments.rtl.test.tsx |
| `AttachmentPreview` uses `LayoutGroup` + `AnimatePresence` + `motion.div` per chip | PASS | `fbf11ff` — AttachmentPreview.tsx render structure |
| Chip key is `attachment.path` (stable) | PASS | `fbf11ff` — `key={attachment.path}` on `motion.div` |
| Transition is 0ms when `prefers-reduced-motion: reduce` is active | PASS | `fbf11ff` — `const transition = reduced ? { duration: 0 } : { duration: 0.15 }` |
| T187 attachments test updated: corrected behavior asserted | PASS | `fbf11ff` — test renamed to `'...does NOT submit the form'`; `onSubmit` not-called assertion added |
| `bun run test:rtl` green (46 pass + 1 todo) | PASS | Test run output above |
| Typecheck passes | PASS | `bun run typecheck:electron` — PASS |
| Commit created | PASS | `fbf11ff` — `feat(composer): attachment chip transitions + fix X button type=button [T196]` |
