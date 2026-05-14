# T240-cheatsheet - Keyboard shortcuts cheatsheet overlay

Status: DONE
Phase: M.10

## Context

M.10 Pillar 4 shipped many keyboard shortcuts (T234 history,
T235 emphasis, T236 line-numbers, T237 paste-image, T238 voice,
T239 ASR). T240-cheatsheet adds a discoverable cheatsheet overlay
listing every active shortcut grouped by context.

The ticket id uses the hyphenated `T240-cheatsheet` suffix because
T240 is already in use by M.7 (provider orchestration backbone).
The validator extracts `T\d{3}-` prefix only — both tickets map to
the same `T240` ID slot. Future work should migrate this slice to a
free numeric ID; documented as a follow-on in the worklog.

## Scope

- `apps/electron/src/renderer/components/keyboard-cheatsheet/shortcut-registry.ts` —
  pure data: `{ key, modifiers, description, section }`. Aggregates
  the known shortcuts from the codebase.
- `apps/electron/src/renderer/components/keyboard-cheatsheet/CheatsheetOverlay.tsx` —
  modal overlay using the existing UI Dialog primitive.
- bun:test coverage of the registry: 10 cases / 50 expect() calls.

## Out of scope (T240-cheatsheet-b)

- Global `Cmd+/` keydown listener wiring at the renderer entry
  point — the listener requires choosing a host component without
  duplicating existing key handlers (composer already intercepts
  Cmd+/ for the Pillar 4 spec; need to disambiguate).
- vitest+RTL coverage of the overlay component (depends on
  worktree node_modules; deferred to CI run).
- i18n keys — labels are kept inline in English for v1 per the
  brand-name-in-English rule; localized titles land in T240-cheatsheet-c
  after the wiring stabilizes.

## Validation

- `bun test shortcut-registry.test.ts` — 10 / 10 pass, 50 expects,
  ~48 ms.
- `bun run validate:rebrand`, `validate:agent-contract`,
  `validate:roadmap` all pass (no T240-cheatsheet content in the
  i18n surface yet).

## Follow-ups

- **T240-cheatsheet-b** — wire `Cmd+/` keydown listener; choose host
  component; add RTL coverage.
- **T240-cheatsheet-c** — i18n keys × 8 locales.
- **T240-cheatsheet-d** — extend registry with cheatsheet entries
  for the audit-log surface (T232), team management view (T231),
  RBAC admin UI (T228).
