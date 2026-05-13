# T342 - WhatsApp worker music-metadata build contract

Status: DONE
Phase: post-rebase build repair
Ticket: docs/tickets/T342-whatsapp-worker-music-metadata-build-contract.md

## 1. Task summary

Repair the WhatsApp worker build contract after the current dependency pinning
made `music-metadata` require the `module-sync` export condition for the
Baileys CommonJS bundle path.

## 2. Repo context discovered

`bun run build` failed during `electron:build:main` before reaching the Electron
main bundle. The failing step was the duplicated WhatsApp worker esbuild command
inside `scripts/electron-build-main.ts`.

The standalone `scripts/build-wa-worker.ts` uses the same esbuild shape and is
called by server packaging through `scripts/build-server.ts`, so both worker
build entry points need the same condition to avoid build-surface drift.

`music-metadata@11.12.2` exports the Node-compatible root through the
`module-sync` condition. A one-off esbuild command with
`--conditions=module-sync` produced a syntactically valid CJS worker bundle in
`/tmp`, proving the dependency is present and the failure is an export-condition
selection issue rather than a missing package.

## 3. Files inspected

- `scripts/electron-build-main.ts`
- `scripts/build-wa-worker.ts`
- `scripts/build-server.ts`
- `package.json`
- `bun.lock`
- `node_modules/music-metadata/package.json`

## 4. Tests added first

No new test file was needed. The existing build gates are executable contract
tests for the worker bundle:

- `bun run build:wa-worker`
- `bun run build`

## 5. Expected failing test output

`bun run build:wa-worker` failed with:

- `Could not resolve "music-metadata"`
- `None of the conditions in the package definition ("import", "module-sync", "types") match any of the currently active conditions ("default", "module", "node", "require")`
- `Consider enabling the "module-sync" condition`

`bun run build` failed at the same WhatsApp worker step during
`electron:build:main`.

## 6. Implementation changes

- Added `--conditions=module-sync` to the standalone WhatsApp worker esbuild
  command in `scripts/build-wa-worker.ts`.
- Added the same esbuild condition to the duplicated Electron build worker
  command in `scripts/electron-build-main.ts`.
- Left package manifests and lockfiles unchanged.

## 7. Validation commands run

- `bun run build:wa-worker` (red)
- One-off `/tmp` esbuild reproduction with `--conditions=module-sync` followed
  by `node --check /tmp/rox-wa-worker-test.cjs` (green)
- `bun run build:wa-worker`
- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `git diff --check`

## 8. Passing test output summary

- `bun run build:wa-worker`: worker bundle built successfully and node syntax
  verification passed.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 3 existing React hook warnings and 0 errors.
- `bun test`: 6190 pass, 13 skip, 0 fail, 1 snapshot, 25152 expect calls.
- `git diff --check`: clean.

## 9. Build output summary

`bun run build` exited 0. The WhatsApp worker built during
`electron:build:main` (`worker.cjs`, 5.6 MB), then Electron main, preload,
renderer, resources, and asset stages completed successfully.

## 10. Remaining risks

No dependency or lockfile changes were made. The duplicated worker build
commands still need to remain aligned if either build script changes later.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Worker bundle resolves `music-metadata` | Green | `bun run build:wa-worker` exit 0 |
| Full build passes the worker step | Green | `bun run build` exit 0; worker bundle built during `electron:build:main` |
| No dependency changes | Green | No package manifest or lockfile diff |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
