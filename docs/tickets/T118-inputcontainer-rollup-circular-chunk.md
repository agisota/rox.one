# T118 - InputContainer Rollup Circular Chunk Warning

Status: DONE

## Context

Production Electron renderer builds still emit a Rollup circular chunk warning:

```text
Export "InputContainer" of module "apps/electron/src/renderer/components/app-shell/input/InputContainer.tsx" was reexported through module "apps/electron/src/renderer/components/app-shell/input/index.ts" while both modules are dependencies of each other and will end up in different chunks by current Rollup settings.
```

Vite recommends changing the import in
`apps/electron/src/renderer/playground/registry/chat.tsx` to point directly to
the exporting module or changing `manualChunks`. This slice should take the
smallest import-only path.

## Goal

Remove the targeted `InputContainer` Rollup circular chunk warning from the
Electron renderer production build without changing runtime UI behavior or
bundle strategy.

## Scope

- Add a focused validation gate that runs the Electron renderer production build
  and fails if the targeted `InputContainer` circular chunk warning appears.
- Change playground imports to point directly at `ChatInputZone` and
  `InputContainer` component modules.
- Leave bundle-size warnings non-fatal.
- Avoid Rollup `manualChunks` changes in this slice.

## Out of scope

- Rechunking production bundles.
- Changing public barrel exports.
- Refactoring `ChatInputZone` or `InputContainer`.
- ASAR, signing, or notarization.
- Packaged artifact generation.

## Constraints

- Follow `AGENTS.md`: worklog before validation, red before implementation,
  then targeted/full relevant checks.
- Keep the diff narrow and reversible.
- Preserve playground behavior.

## Validation Commands

- `bun run scripts/validate-electron-rollup-warnings.ts`
- `bun run electron:build`
- `bun run validate:release`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Worklog captures repo context before implementation | DONE |
| Focused Rollup warning gate exists and fails before the import change | DONE |
| Electron renderer build no longer emits targeted `InputContainer` circular chunk warning | DONE |
| Bundle-size warnings remain non-fatal | DONE |
| Runtime component barrel exports remain unchanged | DONE |
| Full relevant validation passes | DONE |
| Worklog is complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T118-inputcontainer-rollup-circular-chunk.md`.
