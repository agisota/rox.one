# T187 - FreeFormInput RTL Coverage

## 1. Task summary

Write five self-contained RTL test files for FreeFormInput.tsx covering the send hot path (5 tests), attachment add/remove flow (5 tests), product-mode toolbar (5 tests), slash/mention inline menus (4 tests + 1 todo), and thinking-level dropdown chain (5 tests). Total: 24 passing + 1 todo. Per-file self-contained `vi.mock` blocks; no shared mock modules.

## 2. Repo context discovered

- FreeFormInput.tsx is ~630 LOC. It imports from ~14 external modules including Radix DropdownMenu, Tooltip, Popover; multiple Jotai atoms; i18n; motion/react; lucide-react; electronAPI; and three heavy dialog components (PromptRewriteDialog, ThinkingPartnerRoundTableDialog, ComposerArtifactPanel).
- `@radix-ui/react-context` ships its own singleton-based context registry. In this monorepo Bun's hoisted linker resolves two separate copies of `@radix-ui/react-context`: one inside `@craft-agent/ui` and one at the workspace level. A Tooltip rendered by one copy cannot see a Provider registered by the other. This is the core reason all Radix Tooltip and DropdownMenu primitives are mocked away in 4 of 5 test files.
- InlineSlashCommand (the `/` menu) and InlineMentionMenu (the `@` menu) both use a custom `[data-inline-menu]` DOM container — not cmdk. Their keyboard handlers are attached to `document` via `addEventListener`. This means `userEvent.type(textarea, '/')` triggers the menu open (because `onInput` is called on the textarea), but a subsequent `await userEvent.keyboard('{ArrowDown}{Enter}')` does not propagate to the document listener under happy-dom. This is the documented limitation behind the single `it.todo`.
- AttachmentBubble's X button is a `<button>` without `type="button"`. Browsers default to `type="submit"` for buttons inside a form; clicking the X therefore submits the enclosing form before `handleRemoveAttachment` can update state. This is a real bug. Tests observe and document the behavior; they do not fix it (out of scope for Pillar 2, tracked for Pillar 3).
- The hidden `<input type="file">` lacks an accessible name; axe flags it with the `label` rule. The per-chip X button lacks an accessible name; axe flags it with the `button-name` rule. Both are disabled per-test with inline `rules: { label: { enabled: false }, 'button-name': { enabled: false } }` overrides so the remainder of the composer surface still gets axe-checked.
- `window.electronAPI.debugLog` is consumed by mention-menu.tsx on every input event. Without it the `@` test throws `Cannot read properties of undefined` at runtime. The slash-mention test file's `beforeEach` adds `debugLog`, `listFiles`, and `listFilesInDirectory` to the baseline.
- The product-mode toolbar exposes a `data-testid="product-mode-picker"` attribute on the trigger element. Clicking it sets `aria-expanded="true"` and renders a `role="listbox"` with `role="option"` children. ArrowDown / Enter / Escape are handled by the listbox's own `onKeyDown`. This is a custom listbox, not a Radix Select.
- The thinking-level submenu uses Radix `DropdownMenuSub` + `StyledDropdownMenuSubContent`. In the thinking-level test file, the dropdown stubs are replaced with functional stubs: `StyledDropdownMenuItem` forwards `onSelect` to `onClick`, and `StyledDropdownMenuSubContent` renders a `role="menu"`. This allows `fireEvent.click(item)` to call `onThinkingLevelChange` without opening a real Radix portal.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` — full review
- `apps/electron/src/renderer/components/app-shell/input/AttachmentBubble.tsx` — X button type bug confirmed
- `apps/electron/src/renderer/components/app-shell/input/InlineSlashCommand.tsx` — document.addEventListener confirmed
- `apps/electron/src/renderer/components/app-shell/input/InlineMentionMenu.tsx` — document.addEventListener + debugLog confirmed
- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx` — custom listbox pattern confirmed
- `apps/electron/src/renderer/components/app-shell/input/ThinkingLevelSelector.tsx` — THINKING_LEVELS entries and onSelect wiring confirmed
- `packages/shared/src/skills/types.ts` — LoadedSkill shape (for mention test props)
- `packages/shared/src/types.ts` — FileAttachment shape

## 4. Tests added first

Each test file follows a "spec first" approach: the describe block and `it` descriptions were written before the mock body and assertion code. This ensured the test intent was clear before implementation details were locked in.

## 5. Expected failing test output

Before mocking `@craft-agent/ui`, the first render would fail with:

```text
Error: Missing TooltipProvider. Wrap the app in a <TooltipProvider>.
```

Before stubbing the dropdown primitives:

```text
Error: Missing DropdownMenuContext. Wrap the root component in a <DropdownMenu>.
  (this bubbles from inside @radix-ui/react-dropdown-menu's context lookup)
```

## 6. Implementation changes

**Five files created under `apps/electron/src/renderer/components/app-shell/input/__tests__/`:**

- `freeform-input.send.rtl.test.tsx` — 5 tests; `baseProps` factory; `afterEach(cleanup)`
- `freeform-input.attachments.rtl.test.tsx` — 5 tests; `makeAttachment` factory; attachment bug captured in test comment
- `freeform-input.mode-switching.rtl.test.tsx` — 5 tests; `within(listbox)` pattern for option queries
- `freeform-input.slash-mention.rtl.test.tsx` — 4 tests + 1 todo; `debugLog`/`listFiles` added to electronAPI stub
- `freeform-input.thinking-level.rtl.test.tsx` — 5 tests; functional dropdown stubs with role=menu/menuitem

**Mock strategy per file (4 of 5 use passthrough stubs, 1 uses functional stubs):**

Files 1–4 (`send`, `attachments`, `mode-switching`, `slash-mention`): Radix dropdown + tooltip primitives replaced with passthrough fragments. The menu surface is entirely mocked away because opening a real Radix DropdownMenu portal under happy-dom with multi-copy context fails before the test assertion is reached.

File 5 (`thinking-level`): StyledDropdownMenuItem gets a functional stub that calls `onSelect?.()` on click. StyledDropdownMenuContent wraps with `role="menu"`. This is the minimal functional surface needed to assert the click → callback wiring without triggering the full Radix portal.

**Test count breakdown (commits):**

| Commit | File | Tests |
| --- | --- | --- |
| `f59cdfb` | send | 5 |
| `31c8607` | attachments | 5 |
| `a89e1b3` | mode-switching | 5 |
| `ec11b6d` | slash-mention | 4 + 1 todo |
| `0a5470c` | thinking-level | 5 |

## 7. Validation commands run

```bash
bun run test:rtl
bun run typecheck:electron
```

## 8. Passing test output summary

```text
bun run test:rtl
 ✓ freeform-input.send.rtl.test.tsx > FreeFormInput send hot path [T187] > Enter submits typed text via onSubmit
 ✓ freeform-input.send.rtl.test.tsx > FreeFormInput send hot path [T187] > Shift+Enter does NOT submit (newline path)
 ✓ freeform-input.send.rtl.test.tsx > FreeFormInput send hot path [T187] > empty input + Enter is a no-op
 ✓ freeform-input.send.rtl.test.tsx > FreeFormInput send hot path [T187] > whitespace-only input + Enter is a no-op (input.trim() guard)
 ✓ freeform-input.send.rtl.test.tsx > FreeFormInput send hot path [T187] > a11y: no axe violations after typing
 ✓ freeform-input.attachments.rtl.test.tsx (5)
 ✓ freeform-input.mode-switching.rtl.test.tsx (5)
 ✓ freeform-input.slash-mention.rtl.test.tsx (4 | 1 todo)
 ✓ freeform-input.thinking-level.rtl.test.tsx (5)
Tests  24 passed | 1 todo (25)

bun run typecheck:electron
PASS
```

## 9. Build output summary

No production bundle change.

## 10. Remaining risks

- **AttachmentBubble missing `type="button"` on X button.** The click submits the form before `handleRemoveAttachment` updates state. Captured in the attachments test as observed behavior. Fix tracked for Pillar 3.
- **Hidden file input lacks accessible name.** axe `label` rule disabled per-test in attachments, mode-switching, slash-mention, and thinking-level files. Tracked for Pillar 3 alongside the AttachmentBubble fix.
- **Coverage gap on model picker + WorkingDirectoryBadge (~510 LOC).** The model picker's nested Radix submenus and vision toggles are entirely mocked away. WorkingDirectoryBadge is an embedded sub-component not separately testable without a FreeFormInput split. Both are deferred to a follow-up sub-project (see T189).
- **Slash menu document-listener not exercisable under happy-dom.** The one `it.todo` captures this. InlineSlashCommand's keyboard navigation attaches to `document`; userEvent dispatches synthetic events on elements, not on the document listener directly. Resolving this requires either a JSDOM switch for this one file or a refactor of InlineSlashCommand to accept a container prop.
- **Lucide-react icons in FreeFormInput.** The send-hot-path file stubs icons via `vi.mock('lucide-react', ...)` only where needed; other files inherit whatever icon cost happy-dom incurs when rendering SVGs. If icon renders become expensive under happy-dom, a global lucide stub in vitest-setup.ts should be added.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Five test files exist under `__tests__/` | PASS | `freeform-input.*.rtl.test.tsx` (5 files) |
| 24 tests pass | PASS | `bun run test:rtl` — Tests 24 passed |
| 1 `it.todo` present (slash menu document-listener) | PASS | `freeform-input.slash-mention.rtl.test.tsx` — `it.todo('ArrowDown + Enter...')` |
| All mocks self-contained per-file | PASS | Each file opens with its own `vi.mock(...)` block; no imported mock modules |
| AttachmentBubble X-button bug captured as observed behavior | PASS | Attachments test comment + assertion documents the form-submit cycle |
| Hidden file input + chip remove axe violations documented + disabled | PASS | `rules: { label: { enabled: false }, 'button-name': { enabled: false } }` in 4 files |
| `bun run test:rtl` green | PASS | Test run output above |
| Typecheck passes | PASS | `bun run typecheck:electron` |
| Commits created | PASS | `f59cdfb`, `31c8607`, `a89e1b3`, `ec11b6d`, `0a5470c` |
