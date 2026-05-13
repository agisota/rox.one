# Chat Page — Keyboard Navigation Spec

Route: Main content panel when a session is selected (any session ID).
Components: `ChatPage`, `ChatDisplay`, `FreeFormInput`, `InlineMentionMenu`, `InlineSlashCommand`.
Last reviewed: 2026-05-14 (sourced from production code).

---

## Visual reference

```
┌──────────────────────────────────────────────────────────────┐
│ [sidebar toggle btn] [session title ▾] [share btn] [info btn]│  ← PanelHeader
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  (message scroll area — not a tab stop itself)               │
│                                                              │
│    [TurnCard] [copy btn] [retry btn] [action menu ⋯]         │
│    ...                                                       │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [permission mode btn ◐] [composer input (contenteditable)]   │  ← composer bar
│ [model selector] [thinking btn] [source toggle] [send btn ▶] │
└──────────────────────────────────────────────────────────────┘
```

---

## Tab sequence

Focus zone: `chat` (`data-focus-zone="chat"`).

Starting from a freshly-focused chat panel (`Mod+3`):

1. **Session title dropdown trigger** (`PanelHeader` title button) — opens rename/flag/archive/delete session menu.
2. **Share / info button** (header actions slot) — either a share dropdown trigger or compact info popover trigger depending on `isCompactMode`.
3. **Leading action button** (optional; e.g. back button in compact mode).
4. **Right sidebar toggle button** (`rightSidebarButton` prop, when rendered).
5. **Turn-card action buttons** (per visible `TurnCard`): copy, retry, context menu trigger (`⋯`). These are inside the scroll area; Tab reaches them in DOM order (top-to-bottom).
6. **Permission mode button** — opens slash command mode menu (Explore / Ask / Execute). Shift+Tab on this button cycles permission modes directly (action `chat.cyclePermissionMode`).
7. **Composer input** (`contenteditable` — `role="textbox" aria-multiline="true"`) — primary text entry.
8. **Model selector button** — opens model/connection picker dropdown.
9. **Thinking level button** (when visible) — opens thinking level selector.
10. **Source/skill toggle buttons** (when present).
11. **Send button** (`▶`) — submits the current draft.

Shift+Tab reverses this sequence.

---

## Keyboard behaviour inside the composer (FreeFormInput)

### Submitting a message

Two configurable modes (`inputMode` setting):

| Mode | Send key | Newline key |
|---|---|---|
| `enter` (default) | `Enter` | `Shift+Enter` |
| `cmd-enter` | `Mod+Enter` | `Enter` |

`Mod+Enter` always sends regardless of mode (power-user shortcut).

IME composition (CJK input): `Enter` during active composition does **not** submit — it completes the composition instead. The `isComposing` flag is checked before submit.

### Inline menus triggered from the composer

**`@` mention menu** (`InlineMentionMenu`):
- Triggered by typing `@` at start of input or after whitespace / `(`, `"`, `'`.
- `ArrowDown` / `ArrowUp` — navigate items; wraps at list ends.
- `Enter` or `Tab` — select highlighted item, insert `[skill:…] ` / `[source:…] ` / `[file:…] ` token.
- `Escape` — close menu; cursor stays in composer; focus does **not** leave the input.
- When menu is open: `Enter`, `Tab`, `ArrowUp`, `ArrowDown` are consumed by the menu and do **not** propagate to the composer.

**`/` slash command menu** (`InlineSlashCommand`):
- Triggered by typing `/` at start of input or after whitespace.
- `ArrowDown` / `ArrowUp` — navigate items.
- `Enter` or `Tab` — select item: mode commands strip the `/command` text and update permission mode; folder items change the working directory.
- `Escape` — close menu; cursor stays in composer.
- When no filter matches, menu closes automatically so `Enter` propagates normally.

**Label picker** (when open):
- `ArrowUp` / `ArrowDown`, `Enter` consumed by picker; does not propagate.
- `Escape` — closes picker.

---

## Escape behaviour

| Context | Escape result |
|---|---|
| `@` mention menu open | Closes mention menu; focus stays in composer input |
| `/` slash command menu open | Closes slash command menu; focus stays in composer input |
| Label picker open | Closes label picker; focus stays in composer |
| Rename session dialog open | Closes dialog (`RenameDialog`); focus returns to title trigger button |
| Session share dropdown open | Closes dropdown; focus returns to share button |
| Agent task processing (no overlay, `!hasSelection`) | First press sends stop signal. Double-press required per `chat.stopProcessing` action description |
| Text selected in composer | Browser clears selection first; Escape does not propagate to stop-processing |

---

## Global shortcuts active on this page

| Shortcut | Action |
|---|---|
| `Mod+N` | New chat |
| `Mod+T` | New chat in panel |
| `Mod+,` | Open settings |
| `Mod+F` | Open search |
| `Mod+B` | Toggle sidebar |
| `Mod+.` | Toggle focus mode |
| `Mod+1` | Focus sidebar zone |
| `Mod+2` | Focus navigator zone |
| `Mod+3` | Focus chat zone |
| `Mod+[` / `Mod+]` | Go back / forward (session history) |
| `Mod+←` / `Mod+→` | Go back / forward (when `!inputFocus`) |
| `Mod+⇧]` / `Mod+⇧[` | Focus next / previous panel |
| `Shift+Tab` (from permission mode btn) | Cycle permission mode (Explore → Ask → Execute → Explore) |
| `Escape` | Stop processing / close overlay (see above) |
| `Mod+G` / `Mod+⇧G` | Next / previous search match |
| `Mod+/` | Show keyboard shortcuts reference |

---

## Test invariants

- [ ] Tab from outside the chat zone reaches the composer input within 12 Tab presses.
- [ ] Composer input (`[role="textbox"]`) is reachable by keyboard and receives focus.
- [ ] `Enter` in the composer submits the message when `inputMode=enter` and no inline menu is open.
- [ ] `Shift+Enter` inserts a newline (does not submit) when `inputMode=enter`.
- [ ] `Mod+Enter` always submits regardless of `inputMode`.
- [ ] Typing `@` followed by at least one character opens the mention menu.
- [ ] `Escape` while mention menu is open closes the menu and focus remains in the composer.
- [ ] `ArrowDown` moves highlight in the mention menu; `Enter` selects the highlighted item.
- [ ] Typing `/` opens the slash command menu.
- [ ] `Escape` while slash command menu is open closes it; focus remains in the composer.
- [ ] After closing a RenameDialog, focus returns to the element that opened it.
- [ ] All interactive header buttons (share, title trigger) are Tab-reachable and have visible focus rings.
- [ ] No axe violations (wcag2a + wcag2aa + wcag21aa + wcag22aa) on the "session not found" branch.
