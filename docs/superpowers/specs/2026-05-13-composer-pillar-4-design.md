# Composer Pillar 4 Design

- **Status:** drafted
- **Date:** 2026-05-13
- **Extends:** Pillar 3 RTL + a11y series (T180..T199)
- **Roadmap phase:** Phase 10, master roadmap goal
- **Author ticket:** `T233-composer-pillar-4-spec`

## Goal

Continue the composer polish series with five follow-on affordances that build
on the Pillar 3 RTL/a11y foundation already landed in
`apps/electron/src/renderer/components/app-shell/input/`. Pillar 4 stays inside
that surface (plus optional helpers under
`apps/electron/src/renderer/components/app-shell/input/` and a single hook spot
under `apps/electron/src/renderer/hooks/` when isolated logic warrants it). No
new top-level component directories.

## Non-goals

- Do not introduce a new "composer" component directory; the canonical surface
  is `apps/electron/src/renderer/components/app-shell/input/`.
- Do not change the `FreeFormInput` public prop contract beyond additive
  optional props (history persistence, voice-input slot opt-in).
- Do not ship a working ASR (voice input) implementation. Pillar 4 lands the
  slot only, behind a feature flag, with placeholder semantics.
- Do not add new top-level i18n bundles beyond the existing seven locale files.
- Do not refactor the slash/mention menu surface plumbing (Pillar 3 already
  shipped its RTL coverage and document-listener limitations).
- Do not migrate the `RichTextInput` away from its current cmdk + Radix mix.

## Locked Decisions

1. **All sub-tickets stay inside `apps/electron/src/renderer/components/app-shell/input/`**
   so the Pillar 3 RTL harness keeps working without container rewires.
2. **Pure helpers ship as module-level functions** in `*-history.ts`,
   `*-emphasis.ts`, etc., with bun:test coverage. UI plumbing follows in RTL
   tests, matching the Pillar 3 `working-directory-history.ts` pattern.
3. **Session-scoped state lives in memory** unless a sub-ticket explicitly
   needs to survive reload. Composer history is session-scoped (cleared on
   `sessionId` change). No new local-storage keys without an ADR.
4. **Keyboard shortcuts use the existing `isMac` helper** from
   `apps/electron/src/renderer/lib/platform.ts` for Cmd vs Ctrl resolution.
5. **Every Pillar 4 sub-ticket carries the same five test-axis check**:
   pure-function bun:test, RTL render with a11y assertion, axe rule deltas
   documented, i18n parity (when strings change), and validate:rebrand exit 0.
6. **Voice-input is slot-only**. The slot must accept a registered handler at
   runtime but render an empty span when no provider has registered. ASR
   implementation is out of scope until a separate spec lands.

## Sub-Ticket Cluster

Pillar 4 covers five sub-features. Each one is independently shippable; the
spec only commits to landing T234 in this PR. T235..T240 are deferred to
future cycles, each gated on the same global validation matrix.

### T234 — Composer history recall (smallest, first)

- **Goal**: Submitted messages get pushed onto a per-session history stack.
  Up arrow with empty input recalls the previous submission; Down arrow walks
  forward. Editing a recalled entry does not pollute the stack.
- **Files touched**:
  - new: `apps/electron/src/renderer/components/app-shell/input/composer-history.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-history.test.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.history.rtl.test.tsx`
  - edit: `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
    (wire the stack, push on submit, recall on ArrowUp/ArrowDown when empty
    + caret at index 0)
- **Test surface**:
  - pure: push/recall/clear/dedupe/max-length, session-id change clears
  - rtl: submit-then-recall, down-walk, edited-recall-does-not-pollute,
    session-change-clears, history coexists with slash/mention menus (recall
    suppressed when the menu owns ArrowUp/ArrowDown)
- **Stopping condition**: bun:test for `composer-history.test.ts` green,
  RTL `freeform-input.history.rtl.test.tsx` green, `validate:rebrand` exit 0,
  no new dead CSS classes.

### T235 — Emphasis modes toolbar

- **Goal**: Add a bold/italic/code/strikethrough toolbar with keyboard
  shortcuts (`Cmd/Ctrl+B`, `Cmd/Ctrl+I`, `` Cmd/Ctrl+` ``, `Cmd/Ctrl+Shift+X`).
  Empty selection inserts the matching markdown pair with the caret between;
  selected text wraps/unwraps the pair.
- **Files touched**:
  - new: `apps/electron/src/renderer/components/app-shell/input/composer-emphasis.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-emphasis.test.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.emphasis.rtl.test.tsx`
  - new: `apps/electron/src/renderer/components/app-shell/input/EmphasisToolbar.tsx`
  - edit: `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- **Test surface**:
  - pure: wrap/unwrap/empty-insert helpers, idempotent unwrap on already-bold
  - rtl: keyboard shortcut wiring, toolbar button click wiring, a11y axe pass
- **Stopping condition**: identical to T234 plus axe `button-name` on the new
  toolbar buttons.

### T236 — Multi-line autosize + line numbers in expanded mode

- **Goal**: When the composer is in expanded mode, show one-based line numbers
  in a left gutter and ensure autosize tracks gutter height.
- **Files touched**:
  - new: `apps/electron/src/renderer/components/app-shell/input/line-numbers.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/line-numbers.test.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.line-numbers.rtl.test.tsx`
  - edit: `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
  - edit: `apps/electron/src/renderer/components/app-shell/input/useAutoGrow.ts`
- **Test surface**:
  - pure: line counter handles `\n`, `\r\n`, trailing newline, empty string,
    very long single line
  - rtl: gutter visible in expanded mode only, gutter width tracks digit count
- **Stopping condition**: identical to T234 plus visual `data-testid`
  attribute on the gutter so visual diff (Phase 16) can target it.

### T237 — Attachment paste-image preview dialog

- **Goal**: When an image is pasted, open a one-step preview dialog with
  format picker (PNG / JPEG / WebP / "keep original") + filename input.
  Submitting the dialog adds the (possibly transcoded) image to the
  attachments list.
- **Files touched**:
  - new: `apps/electron/src/renderer/components/app-shell/input/PasteImageDialog.tsx`
  - new: `apps/electron/src/renderer/components/app-shell/input/paste-image-flow.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/paste-image-flow.test.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/paste-image-dialog.rtl.test.tsx`
  - edit: `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- **Test surface**:
  - pure: format negotiation (model supports vs not), filename normalisation,
    extension-vs-mime mismatch path
  - rtl: dialog opens on paste, format picker keyboard nav, cancel preserves
    the original attachment list, focus returns to composer on close
- **Stopping condition**: identical to T234 plus DialogTitle/Description
  audit (mirror T199 result for the new dialog), i18n keys live in all seven
  locale files.

### T238 — Voice-input toolbar slot

- **Goal**: Add a deterministic toolbar slot (`<VoiceInputSlot />`) that is
  rendered next to the send button, hidden by default. A `registerVoiceInput`
  module-level function lets a future ASR implementation plug in. Pillar 4
  ships the slot and a no-op registration test only.
- **Files touched**:
  - new: `apps/electron/src/renderer/components/app-shell/input/voice-input-slot.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/__tests__/voice-input-slot.test.ts`
  - new: `apps/electron/src/renderer/components/app-shell/input/VoiceInputSlot.tsx`
  - edit: `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- **Test surface**:
  - pure: register/unregister, isRegistered, idempotent re-registration
  - rtl: slot is absent when no provider registered, slot renders the
    provider's element when one is registered (test installs a stub
    provider via the registry helper)
- **Stopping condition**: identical to T234 plus an ADR note that voice ASR
  is gated behind this slot until a separate implementation spec lands.

## Sub-Feature Picked For This PR

This PR lands **T234 (composer history recall)** because it is:

- Pure logic for the helper (no Radix portals, no axe overrides beyond what
  T187 already disables).
- Two new test files plus one small FreeFormInput edit (push on submit,
  intercept ArrowUp/ArrowDown when empty and not consumed by an open menu).
- No new i18n strings — submit-message recall is keyboard-only and reuses
  the existing textarea placeholder.
- Low risk: no production data persisted, session-scoped only.

## Data Flow

```text
FreeFormInput submitMessage()
  -> pushHistoryEntry(stack, message)
  -> setHistoryStack(next)
  -> onSubmit(message, ...)

FreeFormInput handleKeyDown(ArrowUp/ArrowDown)
  -> if input.trim() && cursor > 0 -> bail (caret nav)
  -> if any inline menu is open and owns the key -> bail
  -> recallHistoryAt(stack, cursor) -> { message, cursor }
  -> setInput(message)
  -> richInputRef.setSelectionRange(message.length, message.length)
```

## History Store Shape

```ts
export interface ComposerHistoryEntry {
  message: string
  submittedAt: number
}

export interface ComposerHistoryState {
  entries: ComposerHistoryEntry[]
  cursor: number // -1 == not recalling, 0..entries.length-1 == recalling
}
```

`cursor === -1` means we are not in recall mode and `setInput` is owned by the
user. As soon as ArrowUp moves us into recall mode (`cursor === 0`), Down/Up
walk the cursor in `[0, entries.length-1]`. Pressing Down off the front of
the list returns to `cursor === -1` and restores whatever the user had typed
before recall started (`scratch` slot, stored on the state object below).

```ts
export interface ComposerHistoryState {
  entries: ComposerHistoryEntry[]
  cursor: number
  scratch: string // text the user had typed before recall began
  sessionId: string | null // null === no session bound yet
}
```

## Behavioral Contract Per Sub-Ticket

Each sub-ticket lands with:

1. A self-contained helper module.
2. A bun:test file colocated under `__tests__/` exercising the helper.
3. An RTL render test exercising the FreeFormInput wiring.
4. An axe assertion that the new affordance has no axe violations (rules
   may be selectively disabled per the Pillar 3 conventions documented in
   T187).
5. Worklog entry (11-section format).
6. Ticket entry referencing the spec.
7. `validate:rebrand` exit 0.

## Acceptance For The Spec Ticket (T233)

- [x] Pillar 4 spec lands at the path above.
- [x] Sub-ticket cluster lists at least 4 candidate items (this spec lists 5).
- [x] Spec calls out the surface boundary (input/ directory).
- [x] Locked decisions section captures every non-trivial decision the
      sub-tickets inherit (session scope, keyboard shortcut helper, axe
      conventions, voice-input slot semantics).
- [x] First sub-ticket (T234) implementation lands in the same PR.
- [x] `validate:rebrand` remains 0.
- [x] No `.swarm/master-roadmap-log.md` touch in this PR.
