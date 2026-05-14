# Team Management Settings Page — Keyboard Navigation Spec

Route: Settings → Team management (`settings/team-management`). Opened via `Mod+,` then "Team management" in the settings navigator, or deep link `rox://settings/team-management`.
Component: `TeamManagementSettingsPage`, `TeamManagementPanel` (from `@/components/settings/rbac`), `RolesPanelContext`.
RBAC note: This page uses an actor-grouped view (T231). Data is fetched via `invokeOnServer` IPC.
Last reviewed: 2026-05-14 (sourced from production code).

---

## Visual reference

```
┌──────────────────────────────────────────────────────────────┐
│ [Team management]                           [⋯ header menu] │  ← PanelHeader
├──────────────────────────────────────────────────────────────┤
│  (ScrollArea)                                                │
│                                                              │
│  ┌ TeamManagementPanel ───────────────────────────────────┐  │
│  │  (Actor-grouped RBAC UI — rendered by rbac component)   │  │
│  │  The exact interactive elements depend on the rbac       │  │
│  │  component implementation in @/components/settings/rbac. │  │
│  │  Typical elements expected:                              │  │
│  │  [member row] [role selector] [remove btn]               │  │
│  │  [invite form / invite btn]                              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Note**: The `TeamManagementPanel` component is imported from `@/components/settings/rbac`. Its internal structure determines the detailed Tab sequence. The spec below reflects the expected pattern for a team management RBAC UI; verify against the actual component implementation.

---

## Tab sequence

The `TeamManagementSettingsPage` wrapper provides only the `PanelHeader` and `ScrollArea`; all interactive content comes from `TeamManagementPanel` via `RolesPanelContext`.

Expected Tab sequence (based on typical RBAC management UI pattern):

1. **Header menu button** (`⋯`).
2. **Team/actor list items** — each member row contains:
   - 2a. Member identity (static — not a tab stop unless clickable).
   - 2b. **Role selector** (dropdown/select for role assignment — if present).
   - 2c. **Remove / revoke button** (if user has permission).
3. **Invite member form** (if present):
   - 3a. **Email / username input**.
   - 3b. **Role selector for new invite**.
   - 3c. **Send invite button**.

RPC transport: `rpcClient.invoke` calls `window.electronAPI.invokeOnServer('', '', channel, ...args)`. The UI is data-driven from the server; if the server is unreachable, the panel renders an error state. Focus behaviour in error states is not specified here — **TODO**: verify error-state focusable elements.

---

## Escape behaviour

| Context | Escape result |
|---|---|
| Role selector dropdown open (if Radix `Select`) | Closes selector; focus returns to trigger |
| Confirmation dialog for member removal (if present) | Closes dialog; focus returns to Remove button |
| Header menu dropdown open | Closes dropdown; focus returns to `⋯` button |
| No overlay | Propagates to `DismissibleLayerProvider` (no layer → no-op) |

**TODO**: The exact overlay/dialog behaviour of `TeamManagementPanel` requires review of the rbac component implementation. Mark any dialog patterns found there in a follow-up.

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

- [ ] Header menu button (`⋯`) is Tab-reachable and opens a dropdown on `Enter`/`Space`.
- [ ] All buttons within `TeamManagementPanel` are Tab-reachable.
- [ ] Role selectors (if present) open on `Enter`/`Space` and close on `Escape`, returning focus to the trigger.
- [ ] "Open in new window" from the header menu (`⋯`) is activatable by keyboard.
- [ ] When `invokeOnServer` is unavailable, an error state renders without crashing; error UI has no keyboard traps.
- [ ] No axe violations (wcag2a + wcag2aa) on the empty/loading state (before IPC resolves).
- [ ] **TODO**: Add invariants specific to `TeamManagementPanel` once its internal Tab sequence is confirmed. This requires reading `apps/electron/src/renderer/components/settings/rbac/`.
