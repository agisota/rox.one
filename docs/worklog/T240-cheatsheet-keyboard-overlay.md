# T240-cheatsheet worklog — Keyboard shortcuts overlay

## 1. Goal

Discoverable cheatsheet overlay for the M.10 Pillar 4 keyboard
shortcuts. v1 ships the registry + overlay component; the global
keydown listener + RTL coverage + i18n land as T240-cheatsheet-b/c.

## 2. Approach

Two-layer:

- `shortcut-registry.ts` — pure data + helpers (group-by section,
  format key combo). bun:tested.
- `CheatsheetOverlay.tsx` — presentational modal that renders the
  registry grouped by section.

## 3. Test coverage

```
$ bun test shortcut-registry.test.ts
 10 pass / 0 fail / 50 expect() calls / 48 ms
```

## 4. Deviations

- **Wiring deferred to T240-cheatsheet-b**: the global `Cmd+/`
  listener needs disambiguation from the composer's existing
  `Cmd+/` (Pillar 4 spec). Choosing a host component without
  collision requires a small ADR; defer.
- **RTL coverage deferred**: the worktree lacks `node_modules`;
  `react/jsx-dev-runtime` cannot be resolved locally. CI runs RTL
  tests with proper deps; defer the RTL test to T240-cheatsheet-b.
- **i18n deferred to T240-cheatsheet-c**: labels are inline English
  for v1 (consistent with the brand-name-in-English rule). 8-locale
  expansion happens after the wiring stabilizes.
- **Ticket ID hyphenated**: `T240-cheatsheet` coexists with M.7's
  `T240-provider-orchestration-backbone` via the suffix pattern
  established by T241-adapters, T242-orchestrator-host-composition,
  T243-rpc, etc.

## 5. Files

| Path                                                                                                  | Status |
| ----------------------------------------------------------------------------------------------------- | ------ |
| `apps/electron/src/renderer/components/keyboard-cheatsheet/shortcut-registry.ts`                      | new    |
| `apps/electron/src/renderer/components/keyboard-cheatsheet/CheatsheetOverlay.tsx`                     | new    |
| `apps/electron/src/renderer/components/keyboard-cheatsheet/__tests__/shortcut-registry.test.ts`       | new    |
| `docs/tickets/T240-cheatsheet-keyboard-overlay.md`                                                    | new    |
| `docs/worklog/T240-cheatsheet-keyboard-overlay.md`                                                    | new    |

## 6. Validation

| Gate                                          | Result                                  |
| --------------------------------------------- | --------------------------------------- |
| `bun test shortcut-registry.test.ts`          | 10 / 10 pass, 50 expects                |
| `bun run validate:rebrand`                    | pass                                    |
| `bun run validate:agent-contract`             | pass                                    |
| `bun run validate:roadmap`                    | pass                                    |

## 7. Follow-ups

- **T240-cheatsheet-b** — wire `Cmd+/` + RTL coverage
- **T240-cheatsheet-c** — 3 i18n keys × 8 locales
- **T240-cheatsheet-d** — extend registry to cover RBAC admin /
  team mgmt / audit-log surfaces
