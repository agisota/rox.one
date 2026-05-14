# Account Settings Page — Keyboard Navigation Spec

Route: Settings → Account (`settings/account`). Opened via `Mod+,` then selecting "Account" in the settings navigator, or via deep link `rox://settings/account`.
Component: `AccountSettingsPage`, `AccountAuthPanel`.
Last reviewed: 2026-05-14 (sourced from production code).

---

## Visual reference

```
┌──────────────────────────────────────────────────────────────┐
│ [← back] [Account]                          [⋯ header menu] │  ← PanelHeader
├──────────────────────────────────────────────────────────────┤
│  (ScrollArea)                                                │
│                                                              │
│  ┌ Profile card ──────────────────────────────────────────┐  │
│  │ [avatar]  Display Name / email / role                  │  │
│  │           VDI: -- │ XP: -- │ Teams: N                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Balance section ───────────────────────────────────────┐  │
│  │  [Top-up button]                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Profile section ───────────────────────────────────────┐  │
│  │  Email (read-only) / verification status               │  │
│  │  [Resend verification btn]                             │  │
│  │  [Display name input]                                  │  │
│  │  [Save button]                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Teams section ─────────────────────────────────────────┐  │
│  │  [New team name input]  [Create team btn]               │  │
│  │  [Team selector (Select)]  [New space input]  [Create]  │  │
│  │  [Invite team selector]  [Create invite btn]            │  │
│  │  [Join code input]  [Join btn]                          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Security section ──────────────────────────────────────┐  │
│  │  [Current password input]  [New password input]         │  │
│  │  [Change password btn]  [Send reset link btn]           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Active sessions ───────────────────────────────────────┐  │
│  │  [Revoke btn] × N  [Revoke others btn]                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ Logout section ────────────────────────────────────────┐  │
│  │  [Logout btn (destructive)]                             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  (Unauthenticated branch replaces all sections above with    │
│   AccountAuthPanel — login / register / reset tab strip)     │
└──────────────────────────────────────────────────────────────┘
```

---

## Tab sequence

### Authenticated branch

1. **Header menu button** (`⋯`) — opens "Open in new window" dropdown.
2. **Top-up balance button** — triggers billing intent flow.
3. **Resend verification button** (conditional — only when email is unverified).
4. **Display name input** (`<input type="text">`).
5. **Save profile button**.
6. **Create team name input** (`<input type="text">`).
7. **Create team button**.
8. **Team-for-Space selector** (`<SelectTrigger>` — opens `SelectContent` popover with arrow keys).
9. **New space name input**.
10. **Create Space button**.
11. **Team-for-invite selector** (`<SelectTrigger>`).
12. **Create invite button**.
13. **Join code input**.
14. **Join (accept invite) button**.
15. **Revoke session buttons** (one per active session).
16. **Revoke other sessions button**.
17. **Logout button** (destructive).

### Unauthenticated branch (`AccountAuthPanel`)

1. **Header menu button**.
2. **Auth tab strip** — Login / Register / Reset tabs (native browser tab behaviour or custom roving tabindex; **TODO**: verify implementation is roving tabindex, not independent Tab stops).
3. **Email input**.
4. **Password input** (Login / Register tabs).
5. **Display name input** (Register tab only).
6. **Submit button** (Sign in / Create account / Send reset).
7. **Refresh button** (triggers account data reload).

### Select popover keyboard (Radix UI `Select`)
- `Enter` / `Space` on `SelectTrigger` — opens `SelectContent`.
- `ArrowUp` / `ArrowDown` — move highlight inside the open select.
- `Enter` — confirms selection, closes popover.
- `Escape` — closes popover without changing value; focus returns to `SelectTrigger`.

---

## Escape behaviour

| Context | Escape result |
|---|---|
| Team/Space selector open (`<SelectContent>`) | Closes selector; focus returns to `SelectTrigger` |
| Header menu dropdown open | Closes dropdown; focus returns to `⋯` button |
| No overlay open | Propagates to `DismissibleLayerProvider` (no registered layer on this page → no-op) |

---

## Global shortcuts active on this page

| Shortcut | Action |
|---|---|
| `Mod+,` | Open settings (no-op if already on settings) |
| `Mod+B` | Toggle sidebar |
| `Mod+.` | Toggle focus mode |
| `Mod+1` / `Mod+2` / `Mod+3` | Jump to sidebar / navigator / chat zone |
| `Mod+[` / `Mod+]` | Session back / forward |
| `Mod+/` | Show keyboard shortcuts |

---

## Test invariants

- [ ] All form inputs on the page (`text`, `password`) are reachable via Tab.
- [ ] Each `<button>` element is reachable via Tab and activatable with `Enter` or `Space`.
- [ ] `SelectTrigger` (team selectors) opens the dropdown on `Enter` / `Space` and closes on `Escape`.
- [ ] After closing a Select popover, focus returns to the trigger button.
- [ ] Password inputs have `type="password"` (characters masked).
- [ ] Display name input is pre-populated with the current display name on page load.
- [ ] The logout button has a destructive visual style distinguishable from other buttons (not a keyboard test, but aids visual a11y).
- [ ] No axe violations (wcag2a + wcag2aa) on the authenticated branch.
- [ ] No axe violations on the unauthenticated (`AccountAuthPanel`) branch.
- [ ] Tab order on authenticated branch matches the DOM order (top-to-bottom, inside `ScrollArea`).
