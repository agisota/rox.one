# T118 - InputContainer Rollup Circular Chunk Warning Worklog

## 1. Task summary

Remove the targeted Rollup circular chunk warning for `InputContainer` by
changing the playground import path and protecting it with a focused production
renderer build warning gate.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 20]
```

## 2. Repo context discovered

- T117 left production builds clean of deprecated Jotai Babel warnings, but the
  Electron renderer build still emits the `InputContainer` Rollup circular chunk
  warning.
- The warning points at
  `apps/electron/src/renderer/playground/registry/chat.tsx`.
- `chat.tsx` imports `ChatInputZone` and `InputContainer` through
  `@/components/app-shell/input`.
- `@/components/app-shell/input/index.ts` reexports both components.
- `ChatInputZone.tsx` imports `InputContainer` directly, so importing
  `InputContainer` back through the barrel makes Rollup split chunks through a
  circular reexport path.
- Rollup's own warning suggests changing the import in `chat.tsx` directly or
  changing `manualChunks`; the direct import is narrower and lower risk.

## 3. Files inspected

- `docs/tickets/T117-vite-jotai-production-warning-gate.md`
- `docs/worklog/T117-vite-jotai-production-warning-gate.md`
- `apps/electron/src/renderer/playground/registry/chat.tsx`
- `apps/electron/src/renderer/components/app-shell/input/index.ts`
- `apps/electron/src/renderer/components/app-shell/input/InputContainer.tsx`
- `apps/electron/src/renderer/components/app-shell/input/ChatInputZone.tsx`
- `apps/electron/vite.config.ts`

## 4. Tests added first

- Add `scripts/validate-electron-rollup-warnings.ts`.
- The gate runs `bun run electron:build:renderer`.
- The gate fails only if output contains the targeted `InputContainer` circular
  chunk warning. Existing large chunk warnings stay non-fatal.

## 5. Expected failing test output

Red command before implementation:

```bash
bun run scripts/validate-electron-rollup-warnings.ts
```

Actual result before implementation: FAIL because the current Electron renderer
build emitted the targeted `InputContainer` circular chunk warning.

```text
[electron-rollup-warnings] targeted InputContainer circular chunk warning emitted: Export "InputContainer" of module "apps\/electron\/src\/renderer\/components\/app-shell\/input\/InputContainer\.tsx" was reexported through module "apps\/electron\/src\/renderer\/components\/app-shell\/input\/index\.ts", while both modules are dependencies of each other and will end up in different chunks by current Rollup settings
```

## 6. Implementation changes

- Added `scripts/validate-electron-rollup-warnings.ts` as a focused renderer
  production build gate.
- Changed `apps/electron/src/renderer/playground/registry/chat.tsx` to import
  `ChatInputZone` from `@/components/app-shell/input/ChatInputZone` and
  `InputContainer` from `@/components/app-shell/input/InputContainer`.
- Left `@/components/app-shell/input/index.ts` unchanged so public barrel
  exports remain stable.
- Did not change `manualChunks`, chunk-size policy, or runtime component logic.

## 7. Validation commands run

```bash
bun run scripts/validate-electron-rollup-warnings.ts
bun run electron:build
bun run validate:release
git diff --check
git status --short -- package.json bun.lock apps/electron/package.json
```

## 8. Passing test output summary

Focused gate after implementation:

```text
[electron-rollup-warnings] targeted InputContainer circular chunk warning absent
```

Full release validation:

```text
4767 pass
13 skip
0 fail
Ran 4780 tests across 408 files.
[mac-arm-build-workflow] ok: Mac ARM workflow contract passed
[private-release-pipeline] ok: private release workflow, scripts, and artifact gates passed
```

## 9. Build output summary

`bun run electron:build` and the build step inside `bun run validate:release`
both completed successfully. The renderer build no longer emits the targeted
`InputContainer` circular chunk warning.

The existing Rollup large chunk warning remains and is intentionally non-fatal
in this slice:

```text
(!) Some chunks are larger than 500 kB after minification.
```

## 10. Remaining risks

- Bundle-size warnings remain tracked separately from this focused circular
  reexport fix.
- No browser visual pass was run for the playground entry; this was an
  import-only change covered by typecheck, renderer build, `electron:build`,
  and `validate:release`.
- ASAR, signing, and notarization remain outside this ticket.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Worklog captures repo context before implementation | Done | Sections 1-5 |
| Focused Rollup warning gate exists and fails before the import change | Done | Section 5 |
| Electron renderer build no longer emits targeted `InputContainer` circular chunk warning | Done | Sections 8-9 |
| Bundle-size warnings remain non-fatal | Done | Section 9 |
| Runtime component barrel exports remain unchanged | Done | Section 6 |
| Full relevant validation passes | Done | Sections 7-8 |
| Worklog is complete | Done | Sections 1-10 |
| Scoped Lore commit exists | Done | This T118 Lore commit |
