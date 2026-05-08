# T096 - Private RC Verification Stabilization Worklog

## 1. Task summary

Stabilize the private/local fake-provider-safe RC handoff after T094/T095 exposed
live verification blockers. This slice fixes only local verification
hermeticity/determinism and records fresh evidence; it does not implement public
production providers or infrastructure.

## 2. Red evidence reproduced

Initial full-suite reproduction:

```bash
bun test
```

Result: FAIL.

```text
4707 pass
14 fail
13 skip
1 snapshots
12103 expect() calls
4734 tests across 398 files
```

Failure clusters:

- `packages/shared/src/__tests__/unified-network-interceptor.schema.test.ts`:
  10 failures with `EPERM` while writing
  `/Users/marklindgreen/.rox/config.json`.
- `apps/electron/src/main/handlers/__tests__/session-watcher.test.ts`: 3
  failures where watcher push events were not emitted.
- `apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts`: 1
  failure where the expected client watcher event was not emitted.
- `bun run electron:smoke` inside the sandboxed command wrapper exited with
  `SIGABRT` before startup markers and produced no recent `Electron*.crash`.

Counter-check:

```bash
HOME=/private/tmp/craft-bun-test-home bun test packages/shared/src/__tests__/unified-network-interceptor.schema.test.ts
```

Result: PASS, confirming the config failure was real-home hermeticity.

## 3. Root causes

- `packages/shared/src/interceptor-common.ts` resolved interceptor config through
  `homedir()` and ignored the existing `CRAFT_CONFIG_DIR` override used by the
  config subsystem.
- The schema test saved/restored the real `~/.rox/config.json` instead of using
  a test-owned config directory.
- Session watcher tests depended on real recursive `fs.watch` delivery, which
  was not deterministic enough for Bun/macOS test runs in this environment.
- Electron itself was able to start; the `SIGABRT` reproduced only inside the
  sandboxed command surface. A GUI-capable non-sandbox run reached
  `CRAFT_SERVER_URL=`, `App initialized successfully`, and the smoke pass marker.

## 4. Implementation changes

- Routed interceptor config/error fallback paths through `getConfigDir()` so
  `CRAFT_CONFIG_DIR` controls test and subprocess config lookup.
- Reworked the unified network interceptor schema test to create a temp
  `CRAFT_CONFIG_DIR`, clean only that temp directory, and assert it does not use
  the real ROX config path.
- Added a narrow session watcher factory seam in `server-core` and exported it
  only as `_setSessionFileWatcherFactoryForTesting`.
- Updated Electron session watcher tests to inject deterministic fake watcher
  emitters while preserving real temp directories and lifecycle cleanup.

## 5. Targeted validation

| Command | Result | Evidence |
|---|---|---|
| `bun test packages/shared/src/__tests__/unified-network-interceptor.schema.test.ts` | PASS | `19 pass`, `0 fail`, `41 expect() calls` |
| `bun test apps/electron/src/main/handlers/__tests__/session-watcher.test.ts` | PASS | `3 pass`, repeated twice |
| `bun test apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts` | PASS | `2 pass`, repeated twice |
| `bun run electron:smoke` | PASS | GUI-capable non-sandbox run reached `[smoke] Electron headless startup passed` |

## 6. Full validation matrix

| Command | Result | Evidence |
|---|---|---|
| `bun run validate:docs` | PASS | `11 skills`, `96 tickets`, `7 required docs` before T096 docs; re-run after T096 recorded in section 7 |
| `git diff --check` | PASS | No whitespace errors |
| `bun run typecheck:all` | PASS | Exit 0 |
| `bun run lint` | PASS | Exit 0 |
| `bun run test:shared:all` | PASS | `73 pass`, `0 fail`, `161 expect() calls`, 4 files |
| `bun test` | PASS | `4722 pass`, `13 skip`, `0 fail`, `1 snapshots`, `12133 expect() calls`, 398 files |
| `bun run validate:e2e-core-scenarios` | PASS | `[e2e-core] ok: core scenario suite contract passed` |
| `bun run electron:smoke` | PASS | `[smoke] Electron headless startup passed` |
| `bun run validate:mac-arm-build-workflow` | PASS | `[mac-arm-build-workflow] ok` |
| `bun run validate:packaged-artifacts` | PASS | DMG/ZIP/blockmap/latest metadata verified |
| `bun run report:bundle-artifacts` | PASS | Non-fatal size warnings only |

Packaged artifact hashes:

```text
ROX-ONE-arm64.dmg bffb62ba827eff5d16e709ff3f59fef79ba279315ffe11768a96912d134c34a5
ROX-ONE-arm64.zip 053913f3ebbccbb1f85dc526c865be8b8cdc2bf1d3c11a69e167471b885b7255
```

Bundle report warnings remain non-fatal T092 evidence, not a Phase 1 failure.

## 7. Final docs/staging checks

After adding this T096 ticket/worklog and updating release docs, rerun:

```bash
bun run validate:docs
git diff --check
git diff --cached --check
```

Current final doc/whitespace checks:

| Command | Result | Evidence |
|---|---|---|
| `bun run validate:docs` | PASS | `11 skills`, `97 tickets`, `7 required docs` |
| `git diff --check` | PASS | No whitespace errors |

Run `git diff --cached --check` after explicit staging. Runtime artifacts remain
excluded from staging:

```text
events.jsonl
.claude/
.ouroboros/
.omx/state/
```

## 8. Remaining risks

- Public production remains blocked by real provider orchestration, hosted
  durable workers, production persistence, public share infrastructure, ROX ID
  email verification, payments, signed/notarized distribution, and external
  audit.
- Electron smoke requires a GUI-capable launch surface; the sandboxed command
  wrapper still exits with `SIGABRT` before app markers and is treated as an
  environment constraint, not a repo startup failure.
- Bundle size warnings remain observational under T092 until a separate
  chunk-splitting policy/CI gate is implemented.
