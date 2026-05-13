# T234 - Composer History Recall (Pillar 4 Sub-Feature 1)

## 1. Task summary

Land the first Pillar 4 sub-feature from the T233 design spec: a per-session
in-memory composer history stack with ArrowUp / ArrowDown recall. Wire it
into `FreeFormInput.tsx` via a `useRef`-held state object, push submitted
messages onto the stack after `onSubmit`, intercept ArrowUp / ArrowDown when
no inline menu owns the key and the input is empty (or we are already in
recall mode), and clear history on `sessionId` change. Stay inside
`apps/electron/src/renderer/components/app-shell/input/` — no new top-level
directories.

## 2. Repo context discovered

- The composer surface lives at
  `apps/electron/src/renderer/components/app-shell/input/`, not
  `apps/electron/src/renderer/components/composer/`. The Phase 10 master
  roadmap uses "composer" as a shorthand.
- The `working-directory-history.ts` helper is the canonical "pure helper +
  colocated bun:test + thin FreeFormInput wiring" precedent. Composer
  history mirrors that shape with one addition: a recall cursor so the same
  stack can drive both push and recall semantics.
- `FreeFormInput.tsx` is ~3000 LOC. `submitMessage` centralises every
  keyboard- and toolbar-driven submit, so a single push point lands in the
  right spot. `handleKeyDown` already gates ArrowUp / ArrowDown behind
  inline-menu state, so the recall intercept slots in immediately after the
  inlineLabel branch and before the Enter handling.
- The `inputRef.current` ref is kept in sync with the `input` state via a
  side-effect at line 636. This means I do not have to add another
  hot-path subscription to know the previous input value when deciding
  whether the user is editing a recalled entry.
- Bun's hoisted-linker `@radix-ui/react-context` duplication forces every
  RTL test that renders `FreeFormInput` to stub Tooltip / DropdownMenu /
  Popover via per-file `vi.mock` blocks. The history test inherits those
  mocks verbatim from `freeform-input.send.rtl.test.tsx`.
- The `RichTextInput` test stub exposes a controlled textarea whose
  `props.value` flows from React state. Writing to the state via
  `setInput(...)` does NOT fire `onChange` — only user-driven keystrokes
  do — so a `handleInputChange` side-effect can safely flip the recall
  cursor off without echoing on programmatic recalls.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `apps/electron/src/renderer/components/app-shell/input/working-directory-history.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/working-directory-history.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.send.rtl.test.tsx`
- `apps/electron/src/test-utils/render.tsx`
- `apps/electron/vitest.config.ts`
- `docs/superpowers/specs/2026-05-13-composer-pillar-4-design.md` (T233)

## 4. Tests added first

Two test files, both colocated under
`apps/electron/src/renderer/components/app-shell/input/__tests__/`:

- `composer-history.test.ts` — 15 bun:test cases covering the pure helper.
- `freeform-input.history.rtl.test.tsx` — 8 vitest + RTL cases covering the
  FreeFormInput wiring.

Both files were written before the helper and the wiring. The helper file's
test suite ran red on the first execution with
`Cannot find module '../composer-history'`. The RTL suite then ran red
against an unmodified `FreeFormInput.tsx` with 5 failing cases and 3 passing
cases (the no-history baseline tests — empty input on ArrowUp, session-id
swap, a11y).

## 5. Expected failing test output

```text
$ bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-history.test.ts
apps/electron/src/renderer/components/app-shell/input/__tests__/composer-history.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module '../composer-history' from '/tmp/rox-m10/apps/electron/src/renderer/components/app-shell/input/__tests__/composer-history.test.ts'
-------------------------------

 0 pass
 1 fail
```

```text
$ bun run test:rtl -- freeform-input.history
Test Files  1 failed (1)
     Tests  5 failed | 3 passed (8)
   Duration  8.32s

× FreeFormInput composer history [T234] > Submit + ArrowUp on empty input recalls the last submission
× FreeFormInput composer history [T234] > Three submits + ArrowUp x3 walks back through them
× FreeFormInput composer history [T234] > ArrowDown after recall walks forward
× FreeFormInput composer history [T234] > ArrowDown past most-recent recall restores empty scratch
× FreeFormInput composer history [T234] > Editing a recalled entry + Enter pushes the edited message (no pollution)
✓ FreeFormInput composer history [T234] > sessionId change clears history (next ArrowUp is a no-op)
✓ FreeFormInput composer history [T234] > ArrowUp with non-empty text does NOT trigger recall
✓ FreeFormInput composer history [T234] > a11y: no axe violations on the rendered composer
```

## 6. Implementation changes

### New: `apps/electron/src/renderer/components/app-shell/input/composer-history.ts`

Pure helper module with no React or DOM dependencies. Exports:

- `MAX_COMPOSER_HISTORY` (50)
- `ComposerHistoryEntry` and `ComposerHistoryState` types
- `RecallResult` type
- `createComposerHistoryState()` — empty state
- `pushHistoryEntry(state, message, submittedAt)` — push with dedupe and cap
- `recallPrevious(state, currentInput)` — older direction, captures scratch
- `recallNext(state)` — newer direction, restores scratch at top of stack
- `resetHistoryForSession(state, sessionId)` — clears when session changes

State shape:

```ts
interface ComposerHistoryState {
  entries: ComposerHistoryEntry[]
  cursor: number              // -1 = not recalling, 0 = most recent
  scratch: string             // pre-recall text, restored on walk-forward
  sessionId: string | null
}
```

### Edit: `FreeFormInput.tsx`

Three surgical splices:

1. **Import block** (~line 90): adds the composer-history helpers and the
   `ComposerHistoryState` type.
2. **History ref + session-bound effect** (~line 700): holds the history
   state in a `useRef` so updates do not cause re-renders. A
   `useEffect([sessionId])` calls `resetHistoryForSession` whenever the
   bound session changes.
3. **Submit path** (~line 1380): after `onSubmit(...)`, calls
   `pushHistoryEntry(historyRef.current, message, Date.now())`.
4. **Key-down path** (~line 1483): adds an ArrowUp / ArrowDown intercept
   gated on `cursor >= 0 || input.trim().length === 0`, no modifier keys,
   and (implicitly) no open inline menu (the existing guards earlier in the
   handler `return` first when a menu owns navigation).
5. **Input-change path** (~line 1543): when the user edits a recalled
   value (cursor `>= 0` and the next value differs from the previous), we
   reset the cursor to `-1` and clear scratch. The history entries are
   preserved; only the recall position is dropped. This keeps the
   "edited recall doesn't pollute history" semantics: the next push uses
   the edited message and the dedupe still works against the head entry.

### New: RTL test file

`freeform-input.history.rtl.test.tsx` — 8 cases. Mock block mirrors
`freeform-input.send.rtl.test.tsx` verbatim (RichTextInput stub, Tooltip,
DropdownMenu, Popover, sonner toast, dialogs, ServerDirectoryBrowser,
SourceSelectorPopover, EditPopover, EscapeInterruptContext,
useDirectoryPicker). Adds one detail: the RichTextInput stub's
`setValue(v)` now also calls `props.onChange(v)` so programmatic value
sets propagate to the host state and trigger React's re-render. Without
this, the composer-history recall path could set the underlying DOM value
but the controlled React state would lag, making `await waitFor(() =>
expect(textarea.value).toBe(...))` brittle.

## 7. Validation commands run

```bash
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-history.test.ts
bun run test:rtl -- freeform-input.history
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/
bun run validate:rebrand
git diff --check
```

## 8. Passing test output summary

```text
$ bun test .../composer-history.test.ts
 15 pass
 0 fail
 51 expect() calls
Ran 15 tests across 1 file. [43.00ms]
```

```text
$ bun run test:rtl -- freeform-input.history
 ✓ src/renderer/components/app-shell/input/__tests__/freeform-input.history.rtl.test.tsx (8 tests) 629ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

```text
$ bun test apps/electron/src/renderer/components/app-shell/input/__tests__/
 68 pass
 0 fail
 224 expect() calls
Ran 68 tests across 11 files. [203.00ms]
```

```text
$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist
```

```text
$ git diff --check
(exit 0 — no whitespace issues)
```

The wider RTL suite (`bun run test:rtl` without filter) still shows the same
2 pre-existing `ProductModeToolbar compact actions` failures present on
`origin/main` HEAD; those are not regressions caused by this ticket.

## 9. Build output summary

No production build run. The implementation is purely additive at the
renderer surface and does not touch packaging, IPC, or main-process code.

## 10. Remaining risks

- **Caret-position vs empty-input check.** The recall intercept gates on
  `input.trim().length === 0` (the React state value) plus the recall
  cursor. Future work could refine the gate to also check the actual caret
  position (`richInputRef.current?.selectionStart === 0`) so a multi-line
  draft with the cursor on a non-empty line never accidentally triggers
  history recall. The current heuristic is conservative: when the input has
  any non-whitespace text and we are not already in recall mode, we leave
  ArrowUp / ArrowDown alone.
- **No persistence across reload.** History lives in a `useRef` and clears
  when the FreeFormInput unmounts (which happens on session change or
  app close). This is consistent with the spec's "session-scoped" decision.
  A future ticket could persist the last N submissions per session via
  local storage; spec section 6 names this as a non-goal for Pillar 4.
- **`MAX_COMPOSER_HISTORY = 50` is hard-coded.** No setting exposes the cap
  yet. The cap is a sane default; raising or lowering it can land in a
  follow-up.
- **`scratch` is text-only.** Attachments and skill mentions are not
  captured in the scratch slot. Editing a recalled entry that also has
  pending attachments leaves the attachments untouched (which is the
  expected behavior — attachments are independent of the textarea).

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `composer-history.ts` ships pure helper functions with no React or DOM dependencies | PASS | New file imports `bun:test` only in test; production file has zero React imports |
| All 15 pure-helper bun:test cases green | PASS | `15 pass | 0 fail` output above |
| All 8 RTL test cases green | PASS | `Tests 8 passed (8)` output above |
| `validate:rebrand` exit 0 | PASS | Output above |
| `git diff --check` exit 0 | PASS | Empty output above |
| No new local-storage keys | PASS | grep `KEYS.` in `composer-history.ts` returns nothing |
| `.swarm/master-roadmap-log.md` not touched | PASS | `git status` does not list it |
| Worklog complete | PASS | This file |
