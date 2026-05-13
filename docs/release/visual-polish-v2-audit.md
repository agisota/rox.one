# Visual Polish v2 — Audit (T280)

CSS-only polish pass. No JS / TSX modifications beyond a single `@import`
line in `apps/electron/src/renderer/index.css`. All values reference the
existing 6-color palette in `:root` / `.dark` — palette is untouched.

## Tokens added

| Token group       | Variables                                                   | Purpose                              |
| ----------------- | ----------------------------------------------------------- | ------------------------------------ |
| Spacing rhythm    | `--vp2-space-{2xs,xs,sm,md,lg}`                             | Compose paddings without magic px    |
| Focus ring        | `--vp2-focus-{color,width,offset}`                          | 2px accent ring on interactive nodes |
| Motion            | `--vp2-{ease,dur-fast,dur-base,dur-slow}`                   | Consistent transitions               |
| Interaction surf. | `--vp2-{hover-bg,active-bg,disabled-opacity}`               | Standardize wash on hover/active     |

Dark mode bumps focus-color alpha 0.55 → 0.7 and hover/active wash 0.04 →
0.06 / 0.07 → 0.10 for visibility against the deeper background.

## Surfaces touched (4 components)

### 1. Primary CTA — `[data-slot="button"].bg-foreground`

- **Before:** flat solid foreground rectangle; hover only changed bg/90.
- **After:** subtle inset 1px highlight (white 8% alpha) at rest, deeper
  inset (14%) + 1px drop-shadow (22% black) on hover, 0.985 scale on active.
- **Contrast:** unchanged — the highlight layer is a 1px wash, foreground/
  background text/bg pair stays at original AA.

### 2. Secondary / outline / ghost — `[data-slot="button"].bg-foreground/5`, `.border`, etc.

- **Before:** three different hover opacities (`/3`, `/5`, `/10`) across variants.
- **After:** all share `--vp2-hover-bg` (4% light / 6% dark) and
  `--vp2-active-bg` (7% / 10%). Consistent affordance across the variant set.

### 3. Composer textarea — `[data-slot="textarea"], [data-slot="input"]`

- **Before:** instant border swap, no caret styling, no resting hover state.
- **After:** transitions on border/box-shadow/bg (150ms ease), hover
  bumps border opacity 0.15 → 0.22 (still under AA threshold for incidental
  UI), accent-colored caret for visibility especially in scenic mode,
  placeholder explicitly set to 45% foreground for contrast clarity.
- **Contrast:** placeholder at 45% foreground passes WCAG 1.4.11 (≥3:1 vs
  background) for both light and dark.

### 4. Settings sidebar item — `.session-item`, `.source-item`, `.import-item`, `[data-slot="dropdown-menu-item"]`

- **Before:** hover/selected only swapped background, no "you are here"
  marker, no transition (instant flicker).
- **After:** 90ms ease transition on bg/color, 2px accent bar on the
  left edge of `[data-selected]` rows (inset 6px top/bottom so it reads
  as a marker, not a divider).
- **Contrast:** marker uses `--accent` token directly — already AA against
  both `--background` variants per the palette `@property` registration.

## Accessibility

- `:where()` selectors keep specificity 0 so components can override.
- All transitions inherit `[data-reduced-motion='true']` collapse (existing
  rule in `index.css`).
- `forced-colors: active` and `prefers-contrast: more` paths in `index.css`
  are not touched; ring/contrast escalations there continue to apply.
- Caret accent and selected marker survive in light/dark.

## Rollback

Single-file revert: delete `apps/electron/src/renderer/styles/visual-polish-v2.css`
and remove the `@import "./styles/visual-polish-v2.css";` line from
`apps/electron/src/renderer/index.css`.

## Follow-up (T281)

- Audit per-component padding migration to `--vp2-space-*` tokens.
- Extend focus-ring coverage to Radix `[data-radix-slider-thumb]` etc.
- Consider promoting `--vp2-ease` to a global `--ease-standard` if other
  motion code lands.
