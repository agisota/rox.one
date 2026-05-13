# AI Settings Page — Keyboard Navigation Spec

Route: Settings → AI (`settings/ai`). Opened via `Mod+,` then selecting "AI" in the navigator, or deep link `rox://settings/ai`.
Component: `AiSettingsPage`, `ConnectionRow`, `WorkspaceOverrideCard`, `OnboardingWizard` (in fullscreen overlay).
Last reviewed: 2026-05-14 (sourced from production code).

---

## Visual reference

```
┌──────────────────────────────────────────────────────────────┐
│ [AI Settings]                               [⋯ header menu] │  ← PanelHeader
├──────────────────────────────────────────────────────────────┤
│  (ScrollArea)                                                │
│                                                              │
│  [⚠ Credential health banner] (conditional)                  │
│    [Re-authenticate btn]                                     │
│                                                              │
│  ┌ Default Settings ──────────────────────────────────────┐  │
│  │  Connection: [Select ▾]                                 │  │
│  │  Model:      [Select ▾]                                 │  │
│  │  Thinking:   [Select ▾]                                 │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Workspace Overrides ───────────────────────────────────┐  │
│  │  [workspace expand/collapse btn] (one per workspace)    │  │
│  │    (expanded) Connection: [Select ▾]                    │  │
│  │    (expanded) Model: [Select ▾]                         │  │
│  │    (expanded) Thinking: [Select ▾]                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Connections ───────────────────────────────────────────┐  │
│  │  [connection row] [⋯ menu btn]  (one per connection)    │  │
│  │  [+ Add connection btn]                                 │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Performance ───────────────────────────────────────────┐  │
│  │  [1M context toggle]                                    │  │
│  │  [Extended prompt cache toggle]                         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

[Fullscreen overlay — shown when Add/Edit connection is active]
┌──────────────────────────────────────────────────────────────┐
│                            [✕ close btn] (top-right, fixed)  │
│  OnboardingWizard (multi-step: provider → credentials → done)│
└──────────────────────────────────────────────────────────────┘
```

---

## Tab sequence

### Main page (no overlay open)

1. **Header menu button** (`⋯`).
2. **Re-authenticate button** (conditional — only when credential health banner is shown).
3. **Default connection Select trigger**.
4. **Default model Select trigger**.
5. **Default thinking Select trigger**.
6. **Workspace expand/collapse buttons** (one per workspace; `type="button"`).
   - When expanded, inside each workspace card:
   - 6a. **Workspace connection Select trigger**.
   - 6b. **Workspace model Select trigger**.
   - 6c. **Workspace thinking Select trigger**.
7. **Connection row action menu buttons** (`⋯`, one per connection).
8. **Add connection button** (`+ Add connection`).
9. **1M context toggle** (`<button role="switch">`).
10. **Extended prompt cache toggle** (`<button role="switch">`).

### Fullscreen overlay (OnboardingWizard)

When the "Add connection" or "Edit" button is activated, a fullscreen overlay opens containing the `OnboardingWizard`. Focus should move into the overlay on open.

1. **Close button** (`✕`, fixed top-right) — closes overlay via `handleCloseApiSetup`.
2. Wizard step content (provider selection buttons, API key inputs, continue/back buttons).

The overlay registers with `DismissibleLayerProvider` indirectly via `FullscreenOverlayBase`; `Escape` closes it.

### Rename connection dialog (`RenameDialog`)

Opened from the `⋯` menu's Rename item after a `requestAnimationFrame` deferral to let the dropdown fully unmount first.

1. **Rename input** (auto-focused on open).
2. **Submit / Save button**.
3. **Cancel button** (if present).

### Connection context menu (`⋯` / `DropdownMenu`)

- `Enter` / `Space` on trigger → open dropdown.
- `ArrowDown` / `ArrowUp` — navigate items.
- `Enter` — activate highlighted item.
- `Escape` — close dropdown; focus returns to trigger.

Sub-menu (Mid-stream behavior):
- `ArrowRight` on sub-menu trigger → open sub-menu.
- `ArrowLeft` / `Escape` → close sub-menu, return to parent menu.

**Note**: The connection row calls `runAfterMenuClose(action)` before opening dialogs/overlays to avoid interaction lock issues. This means the dialog opens on the next animation frame after the dropdown closes.

---

## Escape behaviour

| Context | Escape result |
|---|---|
| Default/workspace `<Select>` popover open | Closes Select; focus returns to `SelectTrigger` |
| Connection `⋯` dropdown open | Closes dropdown; focus returns to the `⋯` button |
| Sub-menu (mid-stream) open | Closes sub-menu; focus returns to sub-menu trigger |
| Fullscreen overlay (OnboardingWizard) open | Closes overlay; `handleCloseApiSetup()` is called; OAuth is cancelled if in progress. Focus should return to "Add connection" or the connection's `⋯` button — **TODO**: verify focus restoration after overlay close |
| Rename connection dialog open | Closes dialog; focus returns to the `⋯` button that triggered rename |
| No overlay open | Propagates to `DismissibleLayerProvider` (no layer → no-op) |

---

## Global shortcuts active on this page

| Shortcut | Action |
|---|---|
| `Mod+,` | Open settings |
| `Mod+B` | Toggle sidebar |
| `Mod+.` | Toggle focus mode |
| `Mod+1` / `Mod+2` / `Mod+3` | Zone focus |
| `Mod+/` | Show keyboard shortcuts |

---

## Test invariants

- [ ] "Add connection" button is keyboard-reachable and activatable (Tab + Enter).
- [ ] All `SettingsMenuSelectRow` (`<Select>` components) open on `Enter`/`Space` and close on `Escape`.
- [ ] After closing a Select, focus returns to the `SelectTrigger` that opened it.
- [ ] Toggle switches (`role="switch"`) are Tab-reachable and toggled by `Space`.
- [ ] Workspace expand/collapse buttons open/close the animated section on `Enter`/`Space`.
- [ ] Connection `⋯` menu opens on `Enter`/`Space`; menu items are navigable with arrow keys.
- [ ] Fullscreen overlay traps focus within itself while open (no Tab escape to background).
- [ ] `Escape` closes the fullscreen overlay.
- [ ] After rename dialog closes, focus returns to the triggering `⋯` button.
- [ ] No axe violations (wcag2a + wcag2aa) on the "no connections" empty-state branch.
- [ ] No axe violations on the branch with at least one connection rendered.
