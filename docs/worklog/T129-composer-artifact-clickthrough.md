# T129 - Composer artifact click-through and visibility pass

Status: verified

## Scope

Fix the composer/workbench action surface where buttons looked available but did not perform visible local work, then verify the six composer actions with real prompt examples in the running ROX.ONE Electron app.

Covered composer actions:

- `Улучшить prompt`
- `TDD Plan`
- `Проверить`
- `Разъебать`
- `Собрать ТЗ`
- `Ревью`

## Root cause

`ComposerArtifactPanel` rendered the workbench artifact screens inside the composer, but most child actions were not wired. Only the prompt replacement path had a callback. Buttons such as TDD handoff, review insertion, spec export, preset save, and agent-plan preparation could therefore render as active controls while producing no visible state transition.

The second defect was spatial: generated plans/specs could make the artifact/editor surface too tall, pushing the action row out of the useful viewport and making the UI feel stuck even when the panel had internal scroll.

## Implementation

- Wired local callbacks for Prompt Lab, TDD Plan, Review Gate, and Spec Builder inside `ComposerArtifactPanel`.
- Added visible status updates after internal artifact actions.
- Added deterministic local transitions between artifacts instead of requiring an external model runtime for planning actions.
- Inserted generated markdown back into composer for plan/spec/review flows.
- Saved Spec Builder presets through ROX preferences instead of `localStorage`.
- Reduced the composer editor and artifact panel height so action controls stay reachable.
- Russianized compact workbench copy and button labels for the embedded composer surface.
- Updated workbench tests for the Russian labels.

## Manual verification

Running app target:

- Title: `ROX.ONE`
- Renderer: `apps/electron/dist/renderer/index.html`
- CDP endpoint: existing Electron debug port `127.0.0.1:9223`

Click-through evidence:

- JSON: `/tmp/rox-composer-clickthrough-2026-05-09-v7.json`
- Screenshot: `/tmp/rox-composer-clickthrough-2026-05-09-v7.png`

Result:

- Runtime exceptions: `0`
- Missing expected controls: `[]`
- Each of the six composer toolbar actions opened its expected artifact screen.
- Internal artifact buttons produced visible state changes or inserted generated output into composer.
- Toolbar controls `Исследовать`, `Задачи`, and `Информация` remained clickable.

Representative prompt used during verification:

```text
Собери ТЗ для экрана "Опыт": синхронизация сессий, демо-контент, MCP presets, проверки UX и evidence журнал.
```

## Automated verification

```bash
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx
bun run lint:electron
bun run typecheck:electron
bun run electron:build
```

Observed targeted test result:

- `21 pass`
- `0 fail`
- `103 expect() calls`

## Log review

Expected local state logs:

- Skills load from `/Users/marklindgreen/.rox/workspaces/my-workspace`.
- Sessions continue to persist and refresh while the app is running.

Remaining non-blocking warnings:

- Several icon strings are still reported as unknown icon formats, for example `palette`, `rocket`, `network`, and `wand`.
- `automations.json` can be missing in a fresh workspace, producing an empty automation list.
- Vite still reports large chunk warnings during renderer build.

Remaining functional blocker outside this slice:

- Real Pi execution still fails until `piServerPath` is configured:
  `piServerPath not configured. Cannot spawn Pi subprocess.`

## Acceptance matrix

| Area | Status | Evidence |
| --- | --- | --- |
| Composer action callbacks | Pass | CDP click-through and unit/component tests |
| Embedded artifact visibility | Pass | Reduced panel/editor height and screenshot evidence |
| Russian embedded workbench copy | Pass | Updated screens and tests |
| Production build | Pass | `bun run electron:build` |
| Real Pi runtime execution | Blocked | Requires `piServerPath` configuration |

