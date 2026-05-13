# T280 — Visual Polish v2 (CSS-only)

Status: DONE

- **Milestone:** M.12
- **Branch:** `feat/M12-visual-polish-v2-v2`
- **Type:** Polish / UI

## Scope

CSS-only polish layer for the Electron renderer:

1. New stylesheet `apps/electron/src/renderer/styles/visual-polish-v2.css`
   with spacing / focus-ring / hover / active / disabled / motion tokens.
2. Single `@import` line wired into
   `apps/electron/src/renderer/index.css` after the Tailwind `@source`
   directives.
3. Targeted polish for four high-traffic surfaces:
   - Primary CTA (default button)
   - Secondary / outline / ghost buttons
   - Composer textarea (and shadcn inputs)
   - Settings sidebar item / dropdown-menu items
4. Audit doc: `docs/release/visual-polish-v2-audit.md`
5. Worklog: `docs/worklog/T280-visual-polish-v2.md`

## Constraints

- CSS-only — no renderer JS/TSX changes beyond the import line.
- Tailwind v4 — polish injected after `@source` directives.
- All values reference existing `--foreground` / `--accent` / `--ring`
  tokens. Palette unchanged.
- WCAG 2.2 AA preserved (contrast, focus ring ≥3:1, motion respects
  `prefers-reduced-motion`).
- `:where()` selectors keep specificity 0 so components keep override.

## Validation

| Check                          | Result   | Notes                                     |
| ------------------------------ | -------- | ----------------------------------------- |
| `validate:bundle-budget`       | see worklog | CSS-only delta                         |
| `validate:bundle-policy`       | see worklog |                                        |
| `validate:rebrand`             | pre-existing failure on main (108 findings, unrelated) |
| `validate:agent-contract`      | see worklog |                                        |
| `validate:roadmap`             | see worklog |                                        |
| Visual diff (manual)           | covered by audit doc | per-surface before/after |

## Files

- `apps/electron/src/renderer/styles/visual-polish-v2.css` (NEW, 188 LOC)
- `apps/electron/src/renderer/index.css` (+4 lines — import wire)
- `docs/release/visual-polish-v2-audit.md` (NEW)
- `docs/tickets/T280-visual-polish-v2.md` (this file)
- `docs/worklog/T280-visual-polish-v2.md`

## Rollback

Revert the import line in `index.css` and remove the polish stylesheet.

## Follow-up

T281 — adopt `--vp2-space-*` tokens in per-component paddings; extend
focus-ring coverage to Radix slider/toggle primitives.
