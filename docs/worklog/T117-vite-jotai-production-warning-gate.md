# T117 - Vite Jotai Production Warning Gate Worklog

## 1. Task summary

Remove deprecated Jotai Babel plugin warnings from production Vite builds by
making the plugins dev-server-only and adding a focused release warning gate.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 19]
```

## 2. Repo context discovered

- T116 left the app built and smoke-verified, with only existing production
  caveats remaining.
- `apps/electron/vite.config.ts` and `apps/webui/vite.config.ts` both configure
  deprecated `jotai/babel/plugin-debug-label` and
  `jotai/babel/plugin-react-refresh` in the React plugin for all Vite commands.
- The installed `jotai@2.19.1` package marks these entrypoints deprecated and
  recommends the separate `jotai-babel` package, but this slice avoids adding a
  new dependency.
- The plugins are development ergonomics for atom labels/HMR; production
  `vite build` does not need to run them.
- Existing Vite large chunk warnings are a separate T092 follow-up class and
  should remain non-fatal in this ticket.
- `asar: false` is a separate T091 follow-up. Enabling ASAR touches packaged
  runtime source path assumptions and needs a deeper runtime contract.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `apps/electron/vite.config.ts`
- `apps/webui/vite.config.ts`
- `apps/viewer/vite.config.ts`
- `docs/tickets/T091-packaged-release-hardening.md`
- `docs/worklog/T091-packaged-release-hardening.md`
- `docs/tickets/T092-bundle-performance-budget.md`
- `docs/worklog/T092-bundle-performance-budget.md`
- `node_modules/jotai/package.json`
- `node_modules/jotai/babel/plugin-debug-label.d.ts`
- `node_modules/jotai/babel/plugin-react-refresh.d.ts`

## 4. Tests added first

- Add `scripts/validate-vite-build-warnings.ts`.
- The gate runs:
  - `bun run electron:build:renderer`
  - `bun run webui:build`
- The gate fails only if production build output contains deprecated
  `jotai/babel` warning text or if a build command exits non-zero.
- A temporary package-script alias was used during the red run, then reverted
  because `validate:release` intentionally treats `package.json` dependency
  surface changes as audit-worthy. The stable command is the direct Bun script.

## 5. Expected failing test output

Red command before implementation:

```bash
bun run scripts/validate-vite-build-warnings.ts
```

Result: FAIL because both production Vite builds still ran deprecated
`jotai/babel` Babel plugins.

Observed failures:

```text
[vite-build-warnings] electron renderer emitted deprecated Jotai Babel warning(s):
[vite-build-warnings] webui emitted deprecated Jotai Babel warning(s):
[vite-build-warnings] deprecated Jotai Babel warning gate failed
```

## 6. Implementation changes

- `apps/electron/vite.config.ts` now exports `defineConfig(({ command }) => ...)`
  and passes the Jotai Babel plugin config to `@vitejs/plugin-react` only when
  `command === 'serve'`.
- `apps/webui/vite.config.ts` applies the same `vite serve` gate for the WebUI
  React plugin.
- Both configs keep a short comment explaining that the deprecated
  `jotai/babel` transforms are dev-only until an explicit `jotai-babel`
  migration is approved.
- `scripts/validate-vite-build-warnings.ts` captures Electron renderer and
  WebUI production build output, fails on the deprecated Jotai warning class,
  and leaves unrelated existing Vite warnings non-fatal.
- No dependency, lockfile, or package-script change remains in the final diff.

## 7. Validation commands run

```bash
bun run scripts/validate-vite-build-warnings.ts
bun run electron:build
bun run validate:release
git diff --check
git status --short -- package.json bun.lock apps/electron/package.json
```

## 8. Passing test output summary

- Focused gate:

```text
[vite-build-warnings] electron renderer passed deprecated Jotai warning gate
[vite-build-warnings] webui passed deprecated Jotai warning gate
[vite-build-warnings] production Vite builds emitted no deprecated Jotai Babel warnings
```

- Full release validation:

```text
4767 pass
13 skip
0 fail
Ran 4780 tests across 408 files.
[mac-arm-build-workflow] ok: Mac ARM workflow contract passed
[private-release-pipeline] ok: private release workflow, scripts, and artifact gates passed
```

- `git diff --check`: passed with no output.
- `git status --short -- package.json bun.lock apps/electron/package.json`:
  passed with no output.

## 9. Build output summary

- `bun run electron:build` completed successfully after the Vite config change.
- `bun run validate:release` rebuilt Electron main, preload, renderer,
  resources, and assets successfully.
- Deprecated Jotai Babel warnings are absent from production Vite build output.
- Existing non-target Vite warnings remain:
  - Rollup circular chunk warning for `InputContainer` re-exported through
    `apps/electron/src/renderer/components/app-shell/input/index.ts` and used
    by `apps/electron/src/renderer/playground/registry/chat.tsx`.
  - Existing large chunk warnings.

## 10. Remaining risks

- Dev servers still use deprecated `jotai/babel` entrypoints for labels/HMR by
  design. A real `jotai-babel` migration should be a separate dependency-bearing
  ticket.
- The Rollup circular chunk warning should become the next narrow build-hygiene
  ticket because Vite warns it can affect execution order.
- Vite chunk-size warnings remain non-fatal and belong to the existing bundle
  performance follow-up.
- ASAR, signing, and notarization remain separate release-hardening work.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Worklog captures repo context before implementation | Done | Sections 1-5 |
| Focused warning gate exists and fails before the Vite config change | Done | Section 5 red run |
| Electron renderer production build emits no deprecated `jotai/babel` warning | Done | `bun run scripts/validate-vite-build-warnings.ts` |
| WebUI production build emits no deprecated `jotai/babel` warning | Done | `bun run scripts/validate-vite-build-warnings.ts` |
| Dev-mode Jotai Babel plugin intent remains documented in config | Done | Comments in both Vite configs |
| No new dependencies are added | Done | Lockfile/package status guard clean |
| Full relevant validation passes | Done | `bun run validate:release` |
| Worklog is complete | Done | Sections 1-10 |
| Scoped Lore commit exists | Done | This T117 Lore commit |
