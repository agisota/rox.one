# T117 - Vite Jotai Production Warning Gate

Status: DONE

## Context

The current private macOS release build is functional, but production build
output still includes deprecated Jotai Babel plugin warnings:

```text
[DEPRECATED] jotai/babel/plugin-debug-label is deprecated and will be removed in v3.
[DEPRECATED] jotai/babel/plugin-react-refresh is deprecated and will be removed in v3.
```

Those plugins are useful for development labels/HMR, but production builds do
not need to execute the deprecated Babel transforms.

## Goal

Remove deprecated `jotai/babel` warnings from production Vite build output while
preserving the current dev-mode Jotai HMR/debug-label behavior.

## Scope

- Add a focused validation gate that runs the production Electron renderer and
  WebUI Vite builds and fails if deprecated Jotai Babel warnings appear.
- Gate only the warning class being fixed in this ticket.
- Change Vite configs so Jotai Babel plugins are used only for `vite serve`,
  not production `vite build`.
- Do not add `jotai-babel` or any other dependency in this slice.

## Out of scope

- Rechunking Vite bundles or failing on existing large chunk warnings.
- Enabling ASAR.
- Apple signing/notarization.
- Changing runtime UI behavior.
- Upgrading Jotai or adding the separate `jotai-babel` package.

## Constraints

- Follow `AGENTS.md`: worklog before tests, tests/validation before
  implementation, then targeted/full relevant checks.
- Preserve existing dev HMR/debug-label intent.
- Keep the change scoped to Vite build-warning hygiene.

## Validation Commands

- `bun run scripts/validate-vite-build-warnings.ts`
- `bun run electron:build`
- `bun run validate:release`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Worklog captures repo context before implementation | DONE |
| Focused warning gate exists and fails before the Vite config change | DONE |
| Electron renderer production build emits no deprecated `jotai/babel` warning | DONE |
| WebUI production build emits no deprecated `jotai/babel` warning | DONE |
| Dev-mode Jotai Babel plugin intent remains documented in config | DONE |
| No new dependencies are added | DONE |
| Full relevant validation passes | DONE |
| Worklog is complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T117-vite-jotai-production-warning-gate.md`.
