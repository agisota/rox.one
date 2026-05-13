# T236 worklog — Composer line-numbers gutter (expanded mode)

## 1. Goal

Ship the third M.10 Pillar 4 sub-feature: a line-numbers gutter
rendered to the left of the composer textarea when the composer is in
expanded mode. The gutter is decorative (sighted-only); screen
readers ignore it via `aria-hidden`.

## 2. Approach

TDD-first.

- **line-numbers.ts** — pure module exposing `countLines` and
  `buildLineNumbers`. No DOM. Counts `\n` + 1 with a defensive
  non-string guard so the gutter render path never throws on a stray
  `undefined`. CRLF normalises to LF semantics (only the `\n`
  increments); lone `\r` is ignored to match how modern textareas
  normalise line endings.
- **LineNumbersGutter.tsx** — presentational component. Returns
  `null` when `visible={false}` so the compact composer keeps zero
  DOM cost. When visible, renders one `<span>` per row with
  `tabular-nums` so digits don't shift width. Layout is inline
  Tailwind on the `.line-numbers-gutter` class — the class itself is
  preserved as a CSS hook for future theme adjustments without
  re-deriving the layout.
- **FreeFormInput.tsx** — wrapped the existing `RichTextInput` in a
  flex row so the gutter sits beside it. Visibility flag is
  `isEmptySession && !compactMode` — the compact inline composer
  stays unchanged.

## 3. Test coverage

```
$ bun test apps/electron/src/renderer/components/app-shell/input/__tests__/line-numbers.test.ts
13 pass · 0 fail · 16 expect() calls
```

The pure helper is unit-tested (13 cases: empty, single line, one
newline, trailing/leading newline, multi-line, consecutive
newlines, CRLF, lone CR, non-string guard, `buildLineNumbers`
sequence + length).

The RTL test
(`__tests__/line-numbers-gutter.rtl.test.tsx`) covers 7 cases:
hidden when `visible={false}`, single row for empty value, one row
per visual line for multi-line value, trailing newline counted,
visibility toggle across re-renders, growth re-render, `aria-hidden`
invariant.

## 4. Decisions

- **Tailwind on a marker class.** The spec called for either a CSS
  module or inline Tailwind; the cheaper, lower-blast-radius option
  is inline Tailwind on a stable `.line-numbers-gutter` class so
  future theme work can latch onto the class without re-deriving the
  layout.
- **`leading-6` to match the textarea.** The composer textarea uses
  the default 1.5 line-height at the 16px base; `leading-6` (24px) is
  the matching row height. Documented at the top of the component so
  the relationship is obvious if either side changes.
- **`tabular-nums`.** Without it, the gutter would jitter when the
  digit count crosses 9 → 10 / 99 → 100; with it, every digit takes
  the same advance width and rows stay anchored.
- **`aria-hidden`.** Line numbers are decorative; the textarea
  contents are what matters to assistive tech, so we let SR readers
  announce the textarea directly.
- **No i18n.** Numbers are universal — adding eight locale entries
  for `"1"`, `"2"`, … would expand the i18n surface for zero benefit.

## 5. Files touched

| Path                                                                                            | Status |
| ----------------------------------------------------------------------------------------------- | ------ |
| `apps/electron/src/renderer/components/app-shell/input/line-numbers.ts`                         | new    |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/line-numbers.test.ts`          | new    |
| `apps/electron/src/renderer/components/app-shell/input/LineNumbersGutter.tsx`                   | new    |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/line-numbers-gutter.rtl.test.tsx` | new |
| `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`                       | edited (extension only) |
| `docs/tickets/T236-composer-line-numbers-gutter.md`                                             | new    |
| `docs/worklog/T236-composer-line-numbers-gutter.md`                                             | new    |

## 6. Deviations

- **RTL test infra has a pre-existing baseline failure.** All 11
  `*.rtl.test.tsx` files in `apps/electron/src/` (10 prior + T236's)
  fail to load under `bun run test:rtl` because the vitest dependency
  graph in this worktree can't resolve `react/jsx-dev-runtime`. The
  T236 test follows the same conventions as the 10 prior RTL tests —
  this is an infra baseline issue, not a T236 regression. Mirrors the
  `validate:rebrand` pre-existing baseline failure that T235 noted.

## 7. Validation matrix

| Gate                                                                                            | Result |
| ----------------------------------------------------------------------------------------------- | ------ |
| `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/line-numbers.test.ts` | pass (13/13) |
| `bun run validate:agent-contract`                                                               | pass   |
| `bun run validate:roadmap`                                                                      | pass   |
| `bun run test:rtl` (gutter + 10 prior)                                                          | pre-existing main-baseline `react/jsx-dev-runtime` resolution failure across all 11 RTL files; not a T236 regression |

## 8. Follow-ups

- **T237** — paste-image preview dialog.
- **T238** — voice-input toolbar slot.

## 9. Closeout

- Pure helper + bun:test land in the first branch commit.
- Gutter component + RTL test land in the second commit.
- `FreeFormInput.tsx` wiring lands in the third commit.
- Ticket + worklog land in this final commit.
