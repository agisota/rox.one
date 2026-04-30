# T003 — White-label brand config layer

## 1. Task summary

T003 adds a centralized white-label brand configuration surface for the Agent Workbench Suite fork without changing runtime behavior beyond visible shell/settings branding.

Goal:
- define a typed brand config model;
- provide Agent Workbench defaults;
- preserve ROX fallback behavior when config is absent;
- consume brand config in visible Electron shell/menu/icon/settings surfaces;
- keep T003 scoped away from settings persistence, IPC, packaging, or asset replacement.

## 2. Repo context discovered

The existing branding surface was small and mostly logo/viewer constants in `packages/shared/src/branding.ts`.

Visible brand usage is split across:
- Electron main menu labels and docs links;
- renderer top bar menu/help actions;
- icon/logo components;
- settings/account UI.

The repo already has Bun test and TypeScript validation commands. The worktree initially had no `node_modules`, so `bun install --frozen-lockfile` was required before typecheck commands could resolve `node` and `bun` type definitions.

## 3. Files inspected

- `packages/shared/src/branding.ts`
- `apps/electron/src/main/menu.ts`
- `apps/electron/src/renderer/components/app-shell/TopBar.tsx`
- `apps/electron/src/renderer/components/icons/RoxAgentsLogo.tsx`
- `apps/electron/src/renderer/components/icons/RoxAgentsSymbol.tsx`
- `apps/electron/src/renderer/components/icons/RoxAppIcon.tsx`
- `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx`
- `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts`
- `apps/electron/src/renderer/components/ui/__tests__/status-icon.test.ts`
- `apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts`
- `apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`

## 4. Tests added first

Added/iterated test coverage before implementation:
- `packages/shared/src/__tests__/branding.test.ts`
- initial React icon render test, later replaced because this repo's current Bun test path does not resolve the React JSX runtime cleanly from the new worktree;
- `apps/electron/src/renderer/components/icons/__tests__/brand-icon-copy.test.ts`
- `apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts`

The final icon coverage tests the pure copy helpers used by the icon components rather than trying to introduce a new React component harness in T003.

## 5. Expected failing test output

Initial red phase for shared branding test:

```text
SyntaxError: Export named 'validateBrandConfig' not found in module '/Users/marklindgreen/Projects/rox/worktrees/T003-white-label-brand-config/packages/shared/src/branding.ts'.
```

Initial red phase for React icon test:

```text
error: Cannot find module 'react/jsx-dev-runtime' from '/Users/marklindgreen/Projects/rox/worktrees/T003-white-label-brand-config/apps/electron/src/renderer/components/icons/__tests__/brand-icons.test.tsx'
```

After the shared implementation, the React render test still failed because the worktree had no installed dependencies yet:

```text
error: Cannot find package 'react' from '/Users/marklindgreen/Projects/rox/worktrees/T003-white-label-brand-config/apps/electron/src/renderer/components/icons/RoxAgentsLogo.tsx'
```

Typecheck also initially failed before dependency hydration:

```text
error TS2688: Cannot find type definition file for 'bun'.
error TS2688: Cannot find type definition file for 'node'.
```

After dependency hydration, `typecheck:electron` exposed a real missing import in `TopBar.tsx`:

```text
Cannot find name 'getBrandDocsUrl'.
Cannot find name 'AGENT_WORKBENCH_BRAND_CONFIG'.
```

## 6. Implementation changes

Shared brand layer:
- added `BrandConfig`, `BrandConfigInput`, and `BrandValidationResult`;
- added `FALLBACK_BRAND_CONFIG` preserving ROX naming;
- added `AGENT_WORKBENCH_BRAND_CONFIG` for the white-label product defaults;
- added `validateBrandConfig`, `resolveBrandConfig`, and `getBrandDocsUrl`;
- retained existing `ROX_LOGO`, `ROX_LOGO_HTML`, and `VIEWER_URL` exports.

Renderer/main consumption:
- Electron menu now uses `AGENT_WORKBENCH_BRAND_CONFIG.productName` and `getBrandDocsUrl`;
- TopBar docs links now use the brand docs resolver;
- icon/logo components accept an optional brand config and default to Agent Workbench copy;
- Account settings now renders a brand summary section for product, legal, support, and docs metadata.

Testability:
- extracted pure icon copy helpers into `brand-icon-copy.ts`;
- extracted account brand summary rows into `account-brand-summary.ts`.

## 7. Validation commands run

```bash
bun test packages/shared/src/__tests__/branding.test.ts apps/electron/src/renderer/components/icons/__tests__/brand-icon-copy.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts
bun install --frozen-lockfile
bun run typecheck:shared
bun run typecheck:electron
git diff --check -- packages/shared/src/branding.ts packages/shared/src/__tests__/branding.test.ts apps/electron/src/renderer/components/icons apps/electron/src/main/menu.ts apps/electron/src/renderer/components/app-shell/TopBar.tsx apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx apps/electron/src/renderer/pages/settings/account-brand-summary.ts apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts
```

## 8. Passing test output summary

Targeted tests:

```text
9 pass
0 fail
15 expect() calls
Ran 9 tests across 3 files.
```

Typecheck:
- `bun run typecheck:shared` passed.
- `bun run typecheck:electron` passed.

Whitespace/static diff check:
- `git diff --check ...` passed with no output.

## 9. Build output summary

No full desktop packaging build was run for T003. This task changed shared config and visible Electron UI consumption, so targeted tests plus shared/electron typechecks were used as the validation gate.

## 10. Remaining risks

- Runtime user-editable brand persistence is intentionally deferred; T003 provides the config layer and visible consumption points only.
- IPC/main-to-renderer brand synchronization is not added yet because current defaults are static and shared.
- Packaged app icon replacement is not implemented; asset refs point to the existing `assets/pzdrk.png` path.
- Provider/service names in API setup surfaces were intentionally not renamed because those are integration/provider labels, not product shell branding.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Brand config exists | PASS | `packages/shared/src/branding.ts` defines typed config and defaults. |
| Default Agent Workbench config exists | PASS | `AGENT_WORKBENCH_BRAND_CONFIG` added. |
| Missing config falls back safely | PASS | `resolveBrandConfig(undefined)` test preserves ROX fallback. |
| App shell/menu consumes config | PASS | Electron menu and TopBar use brand config/doc URL helpers. |
| Settings/about-style brand metadata visible | PASS | Account settings brand summary rows added and tested. |
| Invalid config rejected | PASS | Schema-style validation tests reject empty/invalid fields. |
| Tests pass | PASS | Targeted Bun tests passed, 9/9. |
| Typechecks pass | PASS | Shared and Electron typechecks passed. |
| Full packaging build | NOT RUN | Out of T003 scope; no packaging changes made. |
