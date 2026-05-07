# T093 - React Hook Lint Cleanup

## Task summary

Resolve the remaining Electron React hook lint warnings so `bun run lint:electron` completes cleanly without suppressing `react-hooks/exhaustive-deps`.

## Repo context discovered

- The repo operating contract requires work from `docs/tickets/*.md`; this slice uses `docs/tickets/T093-react-hook-lint-cleanup.md`.
- Full Electron lint initially failed only on three React hook dependency warnings.
- Two warnings were in `apps/electron/src/renderer/App.tsx`.
- One warning was in `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`.
- The `App.tsx` warning for `handleInputChange` came from an effect that needed restore-input behavior before the callback declaration site, so fixing it safely required a stable ref bridge instead of only editing a dependency array.

## Files inspected

- `AGENTS.md`
- `package.json`
- `apps/electron/eslint.config.mjs`
- `apps/electron/src/renderer/App.tsx`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `docs/worklog/T053-product-mode-toolbar-lint.md`

## Tests or validation checks added first

- No new automated test file added; this task is scoped to hook dependency cleanup and lint validation.
- Failing validation was run first: `bun run lint:electron`
- Targeted failing validation was also captured with: `cd apps/electron && npx eslint src/renderer/App.tsx -f json`

## Expected failing output

- `App.tsx:1016` warning: missing `handleInputChange` dependency in a `useEffect`.
- `App.tsx:1372` warning: missing `store` dependency in `handleSendMessage` `useCallback`.
- `FreeFormInput.tsx:1352` warning: missing `richInputRef` dependency in `submitMessage` `useCallback`.

## Implementation changes

- Added `store` to the `handleSendMessage` dependency array in `App.tsx` because the callback reads session processing state from the Jotai store before optimistic send updates.
- Reworked the restore-input path inside the session event effect to call `handleInputChangeRef.current(...)` instead of closing over `handleInputChange` directly.
- Added `handleInputChangeRef` and sync it to the current `handleInputChange` callback during render so the session event subscription can use the latest draft updater without triggering a dependency cycle or block-scoped use-before-declaration issue.
- Added `richInputRef` to the `submitMessage` dependency array in `FreeFormInput.tsx` and removed unrelated unused dependencies from that array.
- Preserved existing runtime behavior; changes are limited to hook dependency correctness and stable callback wiring.

## Validation commands run

- `bun run lint:electron`
- `cd apps/electron && npx eslint src/renderer/App.tsx src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `bun run typecheck:electron`
- `git diff --check`
- `bun run lint`
- `bun run validate:docs`
- `bun run electron:build`

## Passing output summary

- Full Electron lint passed with no reported warnings or errors.
- Targeted ESLint run for the two touched files passed.
- Electron typecheck passed after the stable-ref adjustment avoided hook declaration ordering issues.
- `git diff --check` passed.
- Full aggregate lint passed with 0 warnings / 0 errors.
- Documentation validation passed: 11 skills, 94 tickets, and required architecture docs validated.
- Electron build completed successfully after the renderer hook wiring changes; Vite still reports the pre-existing large chunk warnings.

## Build output summary

- `bun run electron:build` passed. No WebUI/Viewer build was required because this slice only touches Electron renderer source.

## Remaining risks

- The restore-input event path now depends on `handleInputChangeRef.current` being kept in sync after `handleInputChange` is declared; future refactors should preserve that relationship.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Electron hook lint warnings identified | Pass | Initial `bun run lint:electron` reported exactly three warnings. |
| Minimal scoped fix applied | Pass | Only `App.tsx`, `FreeFormInput.tsx`, and this worklog changed. |
| Full Electron lint passes | Pass | `bun run lint:electron` passed. |
| Touched files typecheck cleanly in Electron app | Pass | `bun run typecheck:electron` passed. |
| No unrelated runtime files modified | Pass | Did not touch `events.jsonl` or `.claude`; final diff is scoped. |
