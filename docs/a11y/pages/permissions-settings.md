# Permissions Settings Page — Keyboard Navigation Spec

Route: Settings → Permissions (`settings/permissions`). Opened via `Mod+,` then "Permissions" in the navigator, or deep link `rox://settings/permissions`.
Component: `PermissionsSettingsPage`, `PermissionsDataTable`, `EditPopover`, `EditButton`.
Context: Displays Explore-mode permission patterns from `~/.rox/permissions/default.json` (default) and `<workspace>/permissions.json` (custom). File-watcher keeps the default table live.
Last reviewed: 2026-05-14 (sourced from production code).

---

## Visual reference

```
┌──────────────────────────────────────────────────────────────┐
│ [Permissions]           [help ?]         [⋯ header menu]    │  ← PanelHeader
├──────────────────────────────────────────────────────────────┤
│  (ScrollArea)                                                │
│                                                              │
│  ┌ About Permissions ─────────────────────────────────────┐  │
│  │  (static text + [Learn more link])                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Default Permissions ──────────────────[Edit btn] ──────┐  │
│  │  ┌ PermissionsDataTable ────────────────────────────┐  │  │
│  │  │ (table with search input if searchable=true)      │  │  │
│  │  │ [search input]                                    │  │  │
│  │  │ [row] [row] … (read-only data rows)               │  │  │
│  │  │ [View fullscreen btn] (when fullscreen=true)      │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Workspace Customizations ──────────[Edit btn] ─────────┐  │
│  │  ┌ PermissionsDataTable ────────────────────────────┐  │  │
│  │  │ [search input]                                    │  │  │
│  │  │ [row] [row] … (read-only data rows)               │  │  │
│  │  │ [View fullscreen btn]                             │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

[EditPopover — opens when Edit btn is activated]
┌──────────────────────────────────────────────────────────────┐
│  AI-assisted editor / secondary: [Edit file btn]             │
│  (content defined by getEditConfig())                         │
│  [Close / submit actions]                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Tab sequence

### Loading state

While `isLoading` is true, a spinner is rendered. No interactive elements — not a tab stop.

### Loaded state

1. **Header menu button** (`⋯`).
2. **Help feature button** (from `HeaderMenu` `helpFeature="permissions"` prop — if rendered as a focusable element).
3. **"Learn more" link** (inside the About section; `<button type="button">` opening an external URL via `window.electronAPI.openUrl`).
4. **Default permissions Edit button** (`EditButton` → opens `EditPopover`).
5. **Default permissions search input** (inside `PermissionsDataTable`, when `searchable=true`).
6. **Default permissions "View fullscreen" button** (inside `PermissionsDataTable`, when `fullscreen=true`).
7. **Workspace customizations Edit button** (`EditButton`).
8. **Workspace customizations search input** (inside the second `PermissionsDataTable`).
9. **Workspace customizations "View fullscreen" button**.

Data rows inside `PermissionsDataTable` are **not** interactive (read-only display). They are not tab stops unless the table implementation adds row-level actions.

### EditPopover (when open)

`EditPopover` is a popover UI (component from `@/components/ui/EditPopover`). Its exact keyboard behaviour depends on the underlying popover primitive (likely Radix `Popover`).

Expected Tab sequence inside the popover:
1. Popover content / AI editor area (if it contains inputs or buttons).
2. **Secondary action button** ("Edit file" — opens the permissions file in an external editor via `window.electronAPI`).
3. Close / dismiss control.

### PermissionsDataTable fullscreen overlay

When the "View fullscreen" button is activated, a fullscreen overlay opens (`fullscreen=true` prop passes `fullscreenTitle` to the overlay). Focus should move inside the overlay.

Expected:
1. **Search input** (fullscreen version).
2. **Close fullscreen button**.

---

## Escape behaviour

| Context | Escape result |
|---|---|
| Default permissions `EditPopover` open | Closes popover; focus returns to Default Permissions `EditButton` |
| Workspace customizations `EditPopover` open | Closes popover; focus returns to Workspace `EditButton` |
| Fullscreen `PermissionsDataTable` overlay open | Closes fullscreen overlay; focus returns to "View fullscreen" button |
| No overlay | Propagates to `DismissibleLayerProvider` (no layer → no-op) |

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

- [ ] "Learn more" link is Tab-reachable and activatable with `Enter` (calls `window.electronAPI.openUrl`).
- [ ] Default permissions `Edit` button is Tab-reachable and opens a popover on `Enter`/`Space`.
- [ ] `Escape` closes the default permissions EditPopover; focus returns to the Edit button.
- [ ] Workspace customizations `Edit` button is Tab-reachable and opens a popover on `Enter`/`Space`.
- [ ] `Escape` closes the workspace customizations EditPopover; focus returns to its Edit button.
- [ ] Search inputs inside `PermissionsDataTable` are Tab-reachable.
- [ ] "View fullscreen" button opens fullscreen overlay; overlay is closeable via `Escape`.
- [ ] While loading (spinner state), no interactive elements are tab-accessible.
- [ ] Header menu button (`⋯`) is Tab-reachable.
- [ ] No axe violations (wcag2a + wcag2aa) on the loaded state (with both tables rendered).
- [ ] No axe violations on the empty state ("no default permissions" / "no custom permissions" placeholders).
- [ ] Live region or status announcement when file-watcher updates the default permissions table — **TODO**: not currently implemented; mark as gap.
