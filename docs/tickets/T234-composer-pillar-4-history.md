# T234 - Composer History Recall (Pillar 4 Sub-Feature 1)

Status: DONE

## Context

Pillar 4 of the composer polish series (see `T233-composer-pillar-4-spec.md`)
covers five sub-features. The smallest, lowest-risk item is composer history
recall: store each submitted message in a per-session in-memory stack, then
recall it on ArrowUp / walk forward on ArrowDown when the input is empty.

Composer history mirrors the pattern of the existing
`working-directory-history.ts` helper (pure functions + colocated bun:test +
thin `FreeFormInput.tsx` wiring) and stays inside the
`apps/electron/src/renderer/components/app-shell/input/` surface.

## Goal

Land an in-memory composer history store, wire it into `FreeFormInput.tsx`'s
submit + key-down paths, and prove the wiring with one bun:test file (pure
helper) plus one RTL test file (full FreeFormInput render).

## Required UI

No visual change. Recall happens in-place via the same textarea. Existing
placeholder and `ArrowUp` semantics are preserved when text already exists or
when an inline menu owns the key.

## Required Data/API

In-memory state shaped as:

```ts
interface ComposerHistoryEntry { message: string; submittedAt: number }
interface ComposerHistoryState {
  entries: ComposerHistoryEntry[]
  cursor: number   // -1 = not recalling, 0 = most recent submission
  scratch: string  // text the user had typed before recall began
  sessionId: string | null
}
```

State is module-internal to `composer-history.ts`. No persistence; reset on
`sessionId` change or refresh.

## Required Automations

None.

## Required Subagents

None — surface is well understood.

## TDD Requirements

Two test files, both colocated under
`apps/electron/src/renderer/components/app-shell/input/__tests__/`:

- `composer-history.test.ts` (bun:test) — pure helper coverage.
- `freeform-input.history.rtl.test.tsx` (vitest + RTL) — FreeFormInput wiring.

Pure-helper test cases (`composer-history.test.ts`):

1. `createComposerHistoryState()` produces empty state with `cursor === -1`.
2. `pushHistoryEntry` adds to the front and resets cursor to `-1`.
3. `pushHistoryEntry` deduplicates consecutive identical messages.
4. `pushHistoryEntry` caps history at `MAX_COMPOSER_HISTORY` (50) entries.
5. `pushHistoryEntry` ignores empty / whitespace-only messages.
6. `recallPrevious` on empty state is a no-op.
7. `recallPrevious` from `cursor === -1` captures `scratch` and moves to
   cursor 0.
8. `recallPrevious` walks back through entries up to `length - 1`.
9. `recallNext` from `cursor === 0` returns `scratch` and resets cursor to
   `-1`.
10. `recallNext` from `cursor === -1` is a no-op.
11. `resetHistoryForSession` clears entries + scratch + cursor when session
    changes; same session is a no-op.

RTL test cases (`freeform-input.history.rtl.test.tsx`):

1. Submitting once + ArrowUp on empty input recalls the last submission.
2. Submitting three times + ArrowUp ArrowUp ArrowUp walks back through them.
3. ArrowDown after recall walks forward.
4. ArrowDown past most-recent recall restores the empty scratch text.
5. Editing a recalled value and pressing Enter pushes the edited message
   onto history without rewriting the recalled entry.
6. Changing `sessionId` clears history (next ArrowUp is a no-op).
7. ArrowUp when text is non-empty does NOT trigger recall (caret nav owns
   the key).
8. a11y: no axe violations on the rendered composer.

## Implementation Requirements

- New file `apps/electron/src/renderer/components/app-shell/input/composer-history.ts`
  exporting the state shape, `MAX_COMPOSER_HISTORY`, `createComposerHistoryState`,
  `pushHistoryEntry`, `recallPrevious`, `recallNext`, `resetHistoryForSession`.
- New file `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-history.test.ts`
  for the pure-helper test cases.
- New file `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.history.rtl.test.tsx`
  for RTL coverage.
- Edit `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`:
  - import the helper + state shape.
  - hold the state in a `useRef` (so we mutate without re-render churn).
  - after `onSubmit(...)` inside `submitMessage`, push the pre-clear message.
  - inside `handleKeyDown`, intercept ArrowUp / ArrowDown when `input.trim()`
    is empty, no inline menu has navigation focus, and the caret is at 0.
  - reset history when `sessionId` changes.

## Validation Commands

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-history.test.ts`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.history.rtl.test.tsx`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] `composer-history.ts` ships pure helper functions with no React or DOM
      dependencies.
- [x] All 11 pure-helper bun:test cases green.
- [x] All 8 RTL test cases green (or marked `it.todo` with a documented
      reason in the worklog).
- [x] `validate:rebrand` exit 0.
- [x] `git diff --check` exit 0.
- [x] No new local-storage keys.
- [x] No `.swarm/master-roadmap-log.md` touch.
- [x] Worklog at `docs/worklog/T234-composer-pillar-4-history.md`.

## Worklog

See `docs/worklog/T234-composer-pillar-4-history.md`.
