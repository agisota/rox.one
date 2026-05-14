# Keyboard Navigation Spec — Template & Standards

Applies to: ROX One terminal (Electron app). WCAG 2.1 SC 2.1.1 (Keyboard) and 2.4.3 (Focus Order).

---

## 1. Tab sequence convention

Tab order follows the visual reading order: left-to-right, top-to-bottom.

| Zone | Tab stop order |
|---|---|
| Top bar / window chrome | 1st (skip-to-main bypasses it) |
| Left sidebar (session list) | 2nd |
| Navigator panel (settings list, sources list) | 3rd |
| Main content / chat panel | 4th |
| Right sidebar / preview pane | 5th |

Rules:
- Decorative icons, separators, and static text are **not** tab stops.
- Interactive elements inside collapsed sections are removed from tab order (`tabIndex=-1` or `inert`).
- Focus must never be trapped outside a modal / dialog layer. When a dialog closes, focus returns to the triggering element.
- Shift+Tab reverses the order precisely.

### Focus zones

The app uses a `data-focus-zone` attribute (values: `sidebar`, `navigator`, `chat`) to track which major zone has focus. Global shortcuts `Mod+1`, `Mod+2`, `Mod+3` jump directly to these zones.

---

## 2. Escape handling rules

Escape is handled in two layers (innermost wins):

### Layer A — Inline menus (bubble phase, handled first by the menu component)
Closes the open inline menu and returns focus to the composer input. Does **not** propagate further.

| Trigger | Escape behaviour |
|---|---|
| `@` mention menu open | Closes mention menu; cursor stays in composer |
| `/` slash command menu open | Closes slash command menu; cursor stays in composer |
| Label picker open | Closes label picker; cursor stays in composer |
| Rename dialog (modal) | Closes dialog; focus returns to triggering element |

### Layer B — DismissibleLayer registry (bubble phase, global handler)
When no inline menu is consuming Escape, the `DismissibleLayerProvider` processes the top-most registered overlay (highest priority, then most recently opened):

1. If the top layer has a `back()` function and `canBack()` returns true → navigate back one step, stay open.
2. Otherwise → close the top layer.

Only one layer is dismissed per Escape press.

### Layer C — chat.stopProcessing action (capture phase, action registry)
When no modal overlay is open (`!hasSelection` context key) and the chat zone has an active task, Escape sends the stop-processing signal (double-press required per the action description).

Priority order: inline menus > DismissibleLayer > stop-processing.

---

## 3. Focus visible requirements

- All interactive elements must display a visible focus indicator meeting **3:1** contrast ratio against adjacent colours (WCAG 2.4.11).
- The app uses `focus-visible:ring-1 focus-visible:ring-ring` (Tailwind utility) as the standard focus ring. Mouse users do not see the ring; keyboard users always do.
- Custom components that suppress the browser default outline must supply an equivalent ring via the same utility class.
- No element may set `outline: none` without a replacement indicator.

---

## 4. Skip-to-content landmark

**Status: TODO** — no skip link is present in the current codebase. The first focusable element inside the app chrome is the window-drag region, which is not reachable via keyboard. A `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>` landmark should be added at the top of the rendered HTML before the title bar.

Expected: pressing Tab once when the window gains focus lands on the skip link; pressing Enter moves focus to `#main-content` (the chat panel).

---

## 5. Common keyboard shortcuts (sourced from `actions/definitions.ts`)

These are the **actual registered hotkeys** in the action registry. Mac uses `⌘`; Windows/Linux uses `Ctrl`.

### General

| Action | Mac | Win/Linux |
|---|---|---|
| New chat | `⌘N` | `Ctrl+N` |
| New chat in panel | `⌘T` | `Ctrl+T` |
| Open settings | `⌘,` | `Ctrl+,` |
| Toggle theme | `⌘⇧A` | `Ctrl+Shift+A` |
| Search | `⌘F` | `Ctrl+F` |
| Show keyboard shortcuts | `⌘/` | `Ctrl+/` |
| New window | `⌘⇧N` | `Ctrl+Shift+N` |
| Quit | `⌘Q` | `Ctrl+Q` |

### Navigation

| Action | Mac | Win/Linux | When-clause |
|---|---|---|---|
| Focus sidebar | `⌘1` | `Ctrl+1` | always |
| Focus navigator | `⌘2` | `Ctrl+2` | always |
| Focus chat | `⌘3` | `Ctrl+3` | always |
| Go back | `⌘[` | `Ctrl+[` | always |
| Go forward | `⌘]` | `Ctrl+]` | always |
| Go back (arrow) | `⌘←` | `Ctrl+←` | `!inputFocus` |
| Go forward (arrow) | `⌘→` | `Ctrl+→` | `!inputFocus` |
| Focus next panel | `⌘⇧]` | `Ctrl+Shift+]` | always |
| Focus previous panel | `⌘⇧[` | `Ctrl+Shift+[` | always |

### View

| Action | Mac | Win/Linux |
|---|---|---|
| Toggle sidebar | `⌘B` | `Ctrl+B` |
| Toggle focus mode | `⌘.` | `Ctrl+.` |

### Chat

| Action | Mac / Win | When-clause |
|---|---|---|
| Stop processing (double-press) | `Escape` | `!hasSelection`, chat scope |
| Cycle permission mode | `Shift+Tab` | — |
| Next search match | `⌘G` | — |
| Previous search match | `⌘⇧G` | — |

### Navigator (scoped)

| Action | Mac / Win | When-clause |
|---|---|---|
| Select all items | `⌘A` / `Ctrl+A` | `navigatorFocus` |
| Clear selection | `Escape` | `navigatorFocus` |

---

## 6. Per-page spec format

Each page spec at `docs/a11y/pages/<page-name>.md` follows this template:

```
# <Page Name> — Keyboard Navigation Spec

Route / location: <how to reach it>
Last reviewed: <date>

## Visual reference
<ASCII sketch or component tree>

## Tab sequence
1. <element> — role / type
2. <element>
...

## Escape behaviour
- <overlay name>: <what Escape does>
- <overlay name>: <what Escape does>

## Global shortcuts active on this page
<subset of §5 table that is relevant>

## Test invariants
- [ ] <assertion RTL or Playwright tests should assert>
```

---

## 7. Conventions for `data-testid` on focus-critical elements

Per the a11y audit recommendation, focus-assertion tests need stable selectors. Convention:

- Composer input: `data-testid="chat-composer-input"`
- Send button: `data-testid="chat-send-button"`
- Settings nav item: `data-testid="settings-nav-{slug}"` (e.g. `settings-nav-account`)
- Permission mode selector: `data-testid="permission-mode-button"`
- Mention menu: `data-testid="mention-menu"`
- Slash command menu: `data-testid="slash-command-menu"`

These are **not yet added to production code**; they are captured here as the target state for an upcoming implementation PR.
