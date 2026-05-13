# T263 - Rebrand surface text completion

## 1. Task summary

Complete Phase R.1 by removing active user-visible legacy product text from
locale keys, HTML entrypoints, automations docs, and messaging playground demos.

## 2. Repo context discovered

- All locale files still contain `menu.craftMenu` and
  `onboarding.apiSetup.craftAgentsBackend`.
- `TopBar.tsx` and `APISetupStep.tsx` consume the legacy i18n keys.
- `apps/electron/resources/docs/automations.md` still references
  `~/.craft-agent/logs/messaging-gateway.log`.
- `apps/electron/src/renderer/playground/demos/messaging/*.tsx` still has
  visible `Craft Agents` labels.
- HTML source entrypoints are under `apps/electron/src/renderer/*.html` and
  `apps/webui/src/*.html`; several titles are not the canonical dotted
  `ROX.ONE`, and application-name meta tags are absent.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `.swarm/master-roadmap-log.md`
- `packages/shared/src/i18n/locales/*.json`
- `packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `apps/electron/src/renderer/components/onboarding/APISetupStep.tsx`
- `apps/electron/src/renderer/components/app-shell/TopBar.tsx`
- `README.md`
- `apps/electron/resources/docs/automations.md`
- `apps/electron/src/renderer/*.html`
- `apps/webui/src/*.html`
- `apps/electron/src/renderer/playground/demos/messaging/*.tsx`
- `scripts/__tests__/rox-brand-copy.test.ts`

## 4. Tests added first

Added `scripts/__tests__/rebrand-surface-text.test.ts` before implementation.
The test locks the R.1 surfaces:

- locale key rename across every `packages/shared/src/i18n/locales/*.json`;
- `TopBar.tsx` and `APISetupStep.tsx` consumer key usage;
- active README body copy before `## License`;
- automations doc log path;
- Electron/WebUI HTML title and application-name metadata;
- messaging playground demo labels.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-surface-text.test.ts`
- Result: exit 1.
- Expected failures:
  - `Expected to not contain: "\"menu.craftMenu\""` in locale JSON.
  - `apps/electron/resources/docs/automations.md` still contained
    `~/.craft-agent/logs/messaging-gateway.log`.
  - HTML entrypoints still contained titles such as `<title>New Tab</title>`.
  - Messaging playground demos still contained `Craft Agents`.

## 6. Implementation changes

- Renamed `menu.craftMenu` to `menu.appMenu` across all locale files and
  updated `TopBar.tsx`.
- Renamed `onboarding.apiSetup.craftAgentsBackend` to
  `onboarding.apiSetup.roxBackend` across all locale files and updated
  `APISetupStep.tsx`.
- Kept locale JSON keys sorted after the rename.
- Updated the renamed locale values to use the dotted `ROX.ONE` wordmark.
- Set Electron and WebUI source HTML entrypoints to `<title>ROX.ONE</title>`
  with `application-name` metadata.
- Updated bundled automations docs from `Craft Agent` / `~/.craft-agent/...`
  to `ROX.ONE` / `~/.rox/...`.
- Updated messaging playground demo labels from `Craft Agents` to `ROX.ONE`.
- Added a pending release-note improvement entry for the user-visible copy
  polish required by `apps/electron/resources/AGENTS.md`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-surface-text.test.ts`
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `bun run lint:i18n:parity`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`
- `bun run electron:smoke`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-surface-text.test.ts`: 5 pass, 0 fail,
  67 assertions.
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`: 37 pass,
  0 fail.
- `bun run lint:i18n:parity`: `i18n parity OK (7 locales, 1562 keys each)`.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:docs`: exit 0.
- `git diff --check`: exit 0.
- `bun test`: 5087 pass, 13 skip, 0 fail, 12841 assertions.
- `bun run validate:rebrand`: expected exit 1 until later phases; count is now
  4213 forbidden token findings outside the allowlist.
- `bun run electron:smoke`: exit 1 in this container after the build step
  because Electron could not initialize without an X server:
  `Missing X server or $DISPLAY`; the smoke timed out waiting for
  `CRAFT_SERVER_URL=` and `App initialized successfully`.

## 9. Build output summary

`bun run build` completed with exit 0. Electron main/preload/renderer/resources
and assets built successfully. Vite emitted the existing large chunk warning,
but the build completed and verified outputs.

## 10. Remaining risks

- `bun run validate:rebrand` is expected to remain non-zero after R.1 because
  later phases own package scope, env vars, identifiers, assets, docs, and
  community-link findings.
- Interactive Electron title smoke is environment-blocked in this container
  because no X server is available. R.1 source HTML title/meta coverage and
  `bun run build` passed, and the smoke build step completed before the launch
  environment failure.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Surface-text regression test fails before implementation and passes after | Pass | Red exit 1 before implementation; green 5 pass / 0 fail after implementation |
| Locale key rename is complete across all locale files | Pass | R.1 regression test and locale-parity test passed |
| Locale consumers use the new keys | Pass | R.1 regression test passed |
| README has no active body `Craft Agents` product prose | Pass | R.1 regression test passed |
| Automations docs use `~/.rox/logs/messaging-gateway.log` | Pass | R.1 regression test passed |
| HTML entrypoints use `ROX.ONE` title and application-name meta | Pass | R.1 regression test passed |
| Playground messaging demos use `ROX.ONE` | Pass | R.1 regression test passed |
| I18n parity passes | Pass | `locale-parity.test.ts` 37 pass / 0 fail; `lint:i18n:parity` OK |
| Relevant validation passes or expected rebrand-gate findings are documented | Pass | typecheck, lint, docs, full test, build, diff-check green; `validate:rebrand` expected 4213 findings; Electron smoke blocked by missing X server |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | T263 commit created on `chore/rebrand-R1-surface-text`; final SHA is recorded in git history and the phase roadmap log |
