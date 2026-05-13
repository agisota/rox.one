# T236 - Composer line-numbers gutter (expanded mode)

Status: DONE
Phase: M.10

## Context

M.10 Composer Pillar 4 spec (T233, on `main`) defines five Pillar 4
sub-features. T234 (composer history) and T235 (emphasis toolbar)
already merged. T236 ships the third Pillar 4 sub-feature: a
line-numbers gutter that renders to the left of the textarea when the
composer is in expanded mode, giving authors a quick visual anchor
when drafting long prompts.

## Scope

- `apps/electron/src/renderer/components/app-shell/input/line-numbers.ts` —
  pure helpers:
  - `countLines(value: string): number` — counts `\n` + 1; empty
    string → 1; trailing newline counted; CRLF normalised to LF
    semantics; defensive non-string guard.
  - `buildLineNumbers(value: string): readonly number[]` — convenience
    `[1..N]` array for the gutter's `.map` render path.
- `apps/electron/src/renderer/components/app-shell/input/LineNumbersGutter.tsx` —
  presentational gutter component:
  - `value: string` + `visible: boolean` props.
  - `aria-hidden="true"` so screen readers don't re-read decorative
    line numbers.
  - Fixed-width column with `font-mono`, `leading-6` (matches the
    textarea's 1.5 line-height at 16px base), `tabular-nums`,
    right-aligned via `items-end`.
  - Carries the `.line-numbers-gutter` class as a CSS hook for future
    theme adjustments without re-deriving the layout in styles.
- `FreeFormInput.tsx` wiring (extension only) — wraps the existing
  `RichTextInput` in a flex row so the gutter sits beside it, visible
  iff `isEmptySession && !compactMode`. No other surface in
  `FreeFormInput.tsx` is touched.
- bun:test coverage for the pure helpers in
  `__tests__/line-numbers.test.ts` (13 cases).
- RTL coverage for the gutter component in
  `__tests__/line-numbers-gutter.rtl.test.tsx` (7 cases).

## Out of scope

- No i18n strings — line numbers are numeric and locale-stable.
- `EmphasisToolbar.tsx`, `emphasis-mode.ts` (T235 surfaces),
  `composer-history.ts` (T234 surface) — untouched.
- T237 (paste-image preview dialog) — follow-up.

## Validation gates

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/line-numbers.test.ts` —
  13 pass / 0 fail.
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.
- RTL test added with the same conventions as the 10 other
  `*.rtl.test.tsx` files; the shared vitest infra has a pre-existing
  main-baseline `react/jsx-dev-runtime` resolution failure that
  affects all 11 RTL tests on this worktree, not just T236's.

## Follow-ups

- **T237** — paste-image preview dialog.
- **T238** — voice-input toolbar slot.
