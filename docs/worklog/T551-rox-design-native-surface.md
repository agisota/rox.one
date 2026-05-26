# T551 — Rox Design native surface integration

## Context
- User-visible regression: Rox Design appears as a foreign nested app in the right side of ROX instead of a native module surface.
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx` renders a dedicated design navigator placeholder card before the content panel.
- `apps/electron/src/renderer/pages/rox-design/RoxDesignPage.tsx` renders another React header above the native Electron view while the runtime is running.
- `apps/electron/src/main/rox-design-embed-skin.ts` injects the embedded runtime skin, branding bridge, and content zoom; current zoom is `0.60-0.68`, which makes embedded text too small.
- Existing embed bootstrap only replaces `Open Design` branding and does not localize common embedded labels or move upstream mode tabs into a ROX-native menu.

## Target
Make the `design` route behave as a first-class ROX workspace surface:

```text
GlobalSidebar -> RoxDesignRoute -> MainSurface -> NativeHost -> EmbeddedRoxDesignRuntime
```

The intermediate navigator panel is suppressed for `design`, the running host has no extra ROX React header, and the embedded runtime is adapted through CSS/JS bridge without editing vendored runtime files.

## State Model

```text
inactive
  -> starting
  -> running + native-view-attached
  -> hidden-on-unmount
  -> failed(retryable)
```

Invariant while `running`: no visible `Open Design`, no top upstream mode tab row, no second navigator placeholder panel, and the native host fills the available content surface.

## Options
- Patch vendored Rox Design runtime directly: fastest for one screenshot, brittle on every runtime update.
- Use ROX shell policy + embed skin/bootstrap: preferred; keeps vendor updates possible and scopes changes to integration layer.
- Rebuild Rox Design as a fully native ROX module: best long-term UX, too large for this regression ticket.

## Validation Plan
- Add focused tests for design navigator suppression policy.
- Add RTL coverage that the running `RoxDesignPage` exposes only the native host and no running header copy.
- Extend embed-skin tests for zoom, hidden upstream tabs, bottom-left mode menu, and Russian copy injection.
- Run targeted tests and relevant typecheck.

## Implementation
- Added `shouldSuppressNavigatorForNavigation` shell policy and wired `AppShell` so the `design` route removes the intermediate navigator width and resize handle.
- Simplified the running `RoxDesignPage` state to render only the native host surface, without the extra React header above the embedded Electron view.
- Updated the embed skin to use transparent shell background, larger content zoom, hidden upstream top tab rows, and a ROX-styled bottom-left mode menu.
- Added bootstrap relabeling for common Rox Design labels and brand copy. English source strings remain only as internal translation needles so the bridge can replace upstream runtime text.
- Kept all changes outside `apps/electron/resources/rox-design`; the vendored runtime remains untouched.

## Verification
- `bun test apps/electron/src/main/__tests__/rox-design-embed-skin.test.ts apps/electron/src/renderer/components/app-shell/__tests__/navigation-layout-policy.test.ts` — passed.
- `bun run test:rtl -- src/renderer/pages/rox-design/RoxDesignPage.rtl.test.tsx` — passed.
- `bun run typecheck:electron` — passed.
- Targeted eslint for touched Rox Design/AppShell files — passed.
- `bun run electron:build:renderer` — passed.
- `git diff --check` — passed.
- `bun run lint:electron` — still fails on unrelated existing `shadow-sm` / `shadow-xl` violations in `DesignArtifactCard.tsx:57` and `OnboardingPromptModal.tsx:81`.

## Remaining Risks
- No live Electron screenshot was captured in this turn; visual behavior is covered by shell/embed tests and renderer build, not by a fresh GUI smoke.
- The bottom-left menu clicks through to hidden upstream tab controls. If the vendored runtime changes its tab labels/classes, the bridge may need updated selectors.
