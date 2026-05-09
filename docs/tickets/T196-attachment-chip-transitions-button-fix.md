# T196 - Attachment Chip Transitions + AttachmentBubble type=button Fix

Status: DONE

## Context

Two related issues exist in the attachment chip component tree, both warranting a single focused commit:

1. **Architect-flagged HIGH from PR-B2:** `AttachmentBubble`'s X-remove button was a `<button>` with no explicit `type` attribute. Browsers default `<button>` to `type="submit"` inside a form; clicking the X was therefore submitting the parent form and triggering `onSubmit` before `handleRemoveAttachment` updated state. T187's attachments test documented this misbehavior as observed; it explicitly deferred the fix to Pillar 3.

2. **Missing chip transition:** Attachment chips appeared and disappeared without animation. The composer's design language uses 150ms fade+scale transitions for transient content blocks (consistent with the escape overlay and browser status chip in `ToolbarStatusSlot`).

## Goal

Fix the `type="button"` bug (architect HIGH) and add a 150ms enter/exit fade+scale to each attachment chip, honoring `prefers-reduced-motion` via `ReducedMotionContext`. Update the T187 attachments test to assert the corrected behavior.

## Required UI

- `AttachmentPreview` wraps the chip list with `LayoutGroup` + `AnimatePresence` (from `motion/react`).
- Each chip is wrapped in `motion.div` with `layout`, `initial={{ opacity: 0, scale: 0.9 }}`, `animate={{ opacity: 1, scale: 1 }}`, `exit={{ opacity: 0, scale: 0.9 }}`.
- Transition: 150ms when `useReducedMotionPreference()` returns `false`; `{ duration: 0 }` when `true`.
- Chip key changed from `${attachment.path}-${index}` (composite) to `attachment.path` (stable). This is required for `AnimatePresence` to track chip identity correctly across mid-list removals.
- `AttachmentBubble`'s X-remove `<button>` gains `type="button"`.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Update `freeform-input.attachments.rtl.test.tsx` (T187): the test named `'clicking the chip remove button drops one attachment from the local state'` captured the form-submit bug as observed behavior. Rename and rewrite it to assert the corrected behavior:

- Test name: `'clicking the chip remove button drops one attachment and does NOT submit the form'`.
- Assertion: `onAttachmentsChange` is called with the remaining item (`['two.txt']`); `onSubmit` is NOT called.

## Implementation Requirements

- `apps/electron/src/renderer/components/app-shell/AttachmentPreview.tsx`:
  - Add imports: `AnimatePresence`, `LayoutGroup`, `motion` from `motion/react`; `useReducedMotionPreference` from `@/context/ReducedMotionContext`.
  - Compute `const reduced = useReducedMotionPreference()` and `const transition = reduced ? { duration: 0 } : { duration: 0.15 }`.
  - Wrap the chip map with `<LayoutGroup><AnimatePresence initial={false}>`.
  - Replace direct `<AttachmentBubble>` render with `<motion.div key={attachment.path} layout initial/animate/exit transition>` wrapper.
  - Change key from `${attachment.path}-${index}` to `attachment.path`.
  - Add `type="button"` to the X-remove `<button>` inside `AttachmentBubble`.
- `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.attachments.rtl.test.tsx`:
  - Rename and rewrite the remove-button test per TDD Requirements above.

## Validation Commands

- `bun run test:rtl`
- `bun run typecheck:electron`

## Acceptance Criteria

- [x] `AttachmentBubble` X-remove button has `type="button"`.
- [x] Clicking X does NOT submit the parent form (onSubmit not called).
- [x] `AttachmentPreview` uses `LayoutGroup` + `AnimatePresence` + `motion.div` per chip.
- [x] Chip key is `attachment.path` (stable, not composite).
- [x] Transition is 0ms when `prefers-reduced-motion: reduce` is active.
- [x] T187 attachments test updated: asserts corrected behavior, no longer documents the bug.
- [x] `bun run test:rtl` green.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T196-attachment-chip-transitions-button-fix.md`.
