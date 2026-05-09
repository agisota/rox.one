# T187 - FreeFormInput RTL Coverage

Status: DONE

## Context

FreeFormInput.tsx (~630 LOC) is the composer's primary hot path: it handles text submission, file attachments, mode selection, slash/mention inline menus, and the thinking-level dropdown chain. The component is heavily wired to Radix primitives, Jotai atoms, i18n, and `window.electronAPI`. No behavioral tests existed prior to Pillar 2. Regressions on any of these paths were invisible to CI.

## Goal

Write five self-contained RTL test files covering FreeFormInput's main interaction paths: send hot path, attachments, product-mode switching, slash/mention menus, and thinking-level dropdown. Target 24 passing tests + 1 `it.todo` (slash menu document-listener limitation). All mocks are per-file; no shared mock modules.

## Required UI

None — test coverage only.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Tests are written against the existing FreeFormInput implementation. Each file must pass under `bun run test:rtl` before the ticket is done. The one `it.todo` is intentional and documented.

## Implementation Requirements

Five files under `apps/electron/src/renderer/components/app-shell/input/__tests__/`:

1. **`freeform-input.send.rtl.test.tsx`** (5 tests):
   - Enter submits typed text via `onSubmit`.
   - Shift+Enter does not submit (newline path).
   - Empty input + Enter is a no-op.
   - Whitespace-only input + Enter is a no-op (`input.trim()` guard).
   - a11y: no axe violations after typing (with `label` rule disabled for hidden file input).

2. **`freeform-input.attachments.rtl.test.tsx`** (5 tests):
   - Renders a chip with the attachment file name.
   - Paperclip button is rendered with an accessible label.
   - Clicking the chip's remove button triggers the observed form-submit + state-clear cycle (AttachmentBubble X-button bug captured as documented behavior).
   - Enter with only an attachment (no text) submits via `onSubmit`.
   - a11y: no axe violations with attachments rendered (`label` + `button-name` disabled for known gaps).

3. **`freeform-input.mode-switching.rtl.test.tsx`** (5 tests):
   - Default mode is `research` (trigger reflects it).
   - Click opens a listbox with multiple options.
   - ArrowDown then Enter selects the next mode; trigger label updates.
   - Escape closes the open listbox.
   - a11y: no axe violations with the picker open.

4. **`freeform-input.slash-mention.rtl.test.tsx`** (4 tests + 1 todo):
   - Typing `/` opens the slash command menu (`[data-inline-menu]` container).
   - Escape closes the slash menu via `fireEvent.keyDown(document, ...)`.
   - Typing `@` opens the mention menu.
   - `it.todo` — ArrowDown + Enter selection deferred (InlineSlashCommand wires keydown to `document`; userEvent does not propagate there under happy-dom).
   - a11y: no axe violations with the slash menu open.

5. **`freeform-input.thinking-level.rtl.test.tsx`** (5 tests):
   - Renders an item for every THINKING_LEVELS entry (`off/low/medium/high/xhigh/max`).
   - Clicking a thinking-level item invokes `onThinkingLevelChange` with the level id.
   - Trigger label reflects the prop-supplied thinking level.
   - Selector is not marked disabled when model supports thinking.
   - a11y: no axe violations after rendering with thinking level set.

### Mock pattern (all five files)

Each file is self-contained with `vi.mock` at module scope for:
- `@/components/ui/rich-text-input` — replaced with a `<textarea>` stand-in exposing the same imperative handle.
- `@/context/EscapeInterruptContext` — `useEscapeInterrupt` no-op stub.
- `@/hooks/useDirectoryPicker` — no-op stub.
- `../PromptRewriteDialog`, `../ThinkingPartnerRoundTableDialog`, `../ComposerArtifactPanel` — render null.
- `@rox-agent/ui` — Tooltip primitives replaced with passthrough fragments (multi-copy `@radix-ui/react-context` workaround).
- `@/components/ui/dropdown-menu`, `@/components/ui/styled-dropdown` — children-passthrough stubs (4/5 files); thinking-level file uses functional stubs that forward `onSelect` to `onClick`.
- `@/components/ui/popover` — passthrough stub.
- `@/components/ServerDirectoryBrowser`, `@/components/ui/SourceSelectorPopover`, `@/components/ui/EditPopover` — render null.

## Validation Commands

- `bun run test:rtl`
- `bun run typecheck:electron`

## Acceptance Criteria

- [x] Five test files exist under `apps/electron/src/renderer/components/app-shell/input/__tests__/`.
- [x] 24 tests pass, 1 `it.todo` present (slash menu document-listener).
- [x] All mocks are self-contained per-file (no shared mock modules).
- [x] AttachmentBubble X-button form-submit behavior captured as observed (not fixed).
- [x] Hidden file input axe `label` violation and chip remove `button-name` violation documented and disabled per-test.
- [x] `bun run test:rtl` green.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commits created.

## Worklog

See `docs/worklog/T187-freeform-input-rtl-coverage.md`.
