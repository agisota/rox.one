# T093 - React Hook Lint Cleanup

Status: DONE

## Summary
Remove the remaining React hook dependency warnings in the Electron renderer so `bun run lint` returns 0 warnings without changing runtime behavior.

## Scope
- Inspect the current renderer hook usage and lint baseline.
- Fix only the known `react-hooks/exhaustive-deps` warnings in:
  - `apps/electron/src/renderer/App.tsx`
  - `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- Keep changes minimal and behavior-preserving.

## Out of scope
- Broad hook refactors
- Non-hook lint issues
- Changes to `events.jsonl` or `.claude`
- Broad hook refactors or unrelated runtime/code changes

## Acceptance Criteria

| Criteria | Status |
|---|---|
| `bun run lint:electron` reports 0 warnings/errors | DONE |
| `bun run lint` reports 0 warnings/errors | DONE |
| `bun run typecheck:electron` passes | DONE |
| Hook dependency fixes are limited to App/FreeFormInput wiring | DONE |
| No unrelated local artifacts are staged | DONE |

## Validation
- Run `bun run lint:electron`
- Run `bun run lint`
